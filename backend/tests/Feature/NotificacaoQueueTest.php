<?php

use App\Domain\Solicitacoes\Events\SolicitacaoStatusAtualizado;
use App\Domain\Solicitacoes\Listeners\CriarNotificacoesOperacionais;
use App\Models\NotificacaoOperacional;
use App\Models\Solicitacao;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\QueryException;
use Illuminate\Events\CallQueuedListener;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

final class RetryProbeJob implements ShouldQueue
{
    use InteractsWithQueue, Queueable, SerializesModels;

    public static int $executions = 0;

    public int $tries = 3;

    public int $backoff = 0;

    public function handle(): void
    {
        self::$executions++;
        if (self::$executions === 1) {
            throw new RuntimeException('falha transitória de teste');
        }
    }
}
function eventoStatusPara(Solicitacao $solicitacao): SolicitacaoStatusAtualizado
{
    return new SolicitacaoStatusAtualizado(
        eventId: (string) Str::uuid(),
        requestId: (string) Str::uuid(),
        solicitacaoId: $solicitacao->id,
        protocolo: $solicitacao->protocolo,
        statusAnterior: 'RECEBIDA',
        statusNovo: 'EM_ANALISE',
    );
}

test('evento apos commit enfileira o listener e rollback descarta o job', function () {
    $solicitacao = Solicitacao::factory()->create();
    $event = eventoStatusPara($solicitacao);
    Queue::fake();

    DB::transaction(function () use ($event) {
        event($event);
        Queue::assertNothingPushed();
    });

    Queue::assertPushed(CallQueuedListener::class, fn (CallQueuedListener $job) => $job->class === CriarNotificacoesOperacionais::class
        && $job->data[0]->eventId === $event->eventId
    );

    Queue::fake();
    try {
        DB::transaction(function () use ($event) {
            event($event);
            throw new RuntimeException('rollback intencional do teste');
        });
    } catch (RuntimeException $exception) {
        expect($exception->getMessage())->toBe('rollback intencional do teste');
    }

    Queue::assertNothingPushed();
});

test('worker database executa o listener e a transicao confirmada permanece mesmo sem worker', function () {
    Config::set('queue.default', 'database');
    Config::set('queue.connections.database.connection', 'pgsql_test');
    Config::set('queue.connections.database.table', 'jobs');

    User::query()->whereKey(auth()->id())->update(['is_active' => false]);
    $active = User::factory()->create(['is_active' => true]);
    $inactive = User::factory()->create(['is_active' => false]);
    $solicitacao = Solicitacao::factory()->create();

    $response = $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", ['status' => 'EM_ANALISE']);
    $response->assertOk();
    expect($solicitacao->fresh()->status)->toBe('EM_ANALISE')
        ->and(DB::table('jobs')->count())->toBe(1);

    $payload = DB::table('jobs')->value('payload');
    expect($payload)
        ->not->toContain($solicitacao->nome_solicitante)
        ->not->toContain($solicitacao->cpf_solicitante)
        ->not->toContain($solicitacao->descricao);
    if ($solicitacao->paciente?->celular) {
        expect($payload)->not->toContain($solicitacao->paciente->celular);
    }

    Artisan::call('queue:work', [
        'connection' => 'database',
        '--once' => true,
        '--tries' => 3,
        '--quiet' => true,
    ]);

    expect(DB::table('jobs')->count())->toBe(0)
        ->and(NotificacaoOperacional::query()->where('user_id', $active->id)->count())->toBe(1)
        ->and(NotificacaoOperacional::query()->where('user_id', $inactive->id)->count())->toBe(0)
        ->and($solicitacao->fresh()->status)->toBe('EM_ANALISE');
});

test('database worker retries a transient queued job', function () {
    Config::set('queue.default', 'database');
    Config::set('queue.connections.database.connection', 'pgsql_test');
    Config::set('queue.connections.database.table', 'jobs');
    RetryProbeJob::$executions = 0;
    Queue::connection('database')->push(new RetryProbeJob);

    Artisan::call('queue:work', [
        'connection' => 'database',
        '--once' => true,
        '--tries' => 3,
        '--quiet' => true,
    ]);
    $job = DB::table('jobs')->first();
    expect($job)->not->toBeNull()
        ->and($job->attempts)->toBe(1)
        ->and(DB::table('failed_jobs')->count())->toBe(0);

    Artisan::call('queue:work', [
        'connection' => 'database',
        '--once' => true,
        '--tries' => 3,
        '--quiet' => true,
    ]);
    expect(DB::table('jobs')->count())->toBe(0)
        ->and(DB::table('failed_jobs')->count())->toBe(0)
        ->and(RetryProbeJob::$executions)->toBe(2);
});
test('falha do listener e retry sao observaveis sem dados pessoais no log', function () {
    $listener = app(CriarNotificacoesOperacionais::class);
    $active = User::factory()->create(['is_active' => true]);
    $solicitacao = Solicitacao::factory()->create();
    $validEvent = eventoStatusPara($solicitacao);
    $listener->handle($validEvent);
    $listener->handle($validEvent);
    expect(NotificacaoOperacional::query()->where('user_id', $active->id)->count())->toBe(1);
    $solicitacao = Solicitacao::factory()->create();
    $event = new SolicitacaoStatusAtualizado(
        eventId: (string) Str::uuid(),
        requestId: (string) Str::uuid(),
        solicitacaoId: $solicitacao->id,
        protocolo: $solicitacao->protocolo,
        statusAnterior: 'RECEBIDA',
        statusNovo: str_repeat('invalid-status-', 4),
    );
    Log::spy();

    expect(fn () => $listener->handle($event))->toThrow(QueryException::class);
    Log::shouldHaveReceived('error')->with('notificacoes_falharam', Mockery::on(
        fn (array $context) => array_keys($context) === ['event_id', 'request_id']
            && $context['event_id'] === $event->eventId
            && $context['request_id'] === $event->requestId
    ));
    expect($listener->tries)->toBe(3)->and($listener->backoff)->toBe(5);
});
