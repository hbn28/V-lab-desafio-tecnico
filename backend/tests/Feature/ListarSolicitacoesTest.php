<?php

use App\Models\Agendamento;
use App\Models\Paciente;
use App\Models\Solicitacao;
use Illuminate\Support\Carbon;

test('lista solicitações vazia retorna estrutura correta', function () {
    $response = $this->getJson('/api/v1/solicitacoes');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data',
            'meta' => ['total', 'per_page', 'current_page', 'last_page'],
            'links' => ['first', 'last', 'next', 'prev'],
        ])
        ->assertJsonPath('data', [])
        ->assertJsonPath('meta.total', 0);
});

test('filtra por status', function () {
    $this->postJson('/api/v1/solicitacoes', [
        'nome_solicitante' => 'Ana Beatriz',
        'cpf_solicitante' => '111.222.333-44',
        'data_nascimento' => '1992-07-10',
        'categoria' => 'CONSULTA',
        'prioridade' => 'BAIXA',
        'descricao' => 'Consulta de rotina anual para checkup geral completo.',
    ])->assertStatus(201);

    $all = $this->getJson('/api/v1/solicitacoes')->assertStatus(200);
    $filtered = $this->getJson('/api/v1/solicitacoes?status=RECEBIDA')->assertStatus(200);
    $empty = $this->getJson('/api/v1/solicitacoes?status=CONCLUIDA')->assertStatus(200);

    expect($all->json('meta.total'))->toBe(1);
    expect($filtered->json('meta.total'))->toBe(1);
    expect($empty->json('meta.total'))->toBe(0);
});

test('status inválido no filtro retorna 422', function () {
    $response = $this->getJson('/api/v1/solicitacoes?status=INVALIDO');

    $response->assertStatus(422);
});

test('filtra o histórico encerrado sem misturar solicitações abertas', function () {
    Solicitacao::factory()->create([
        'status' => 'RECEBIDA',
        'protocolo' => 'SOL-2026-0101',
    ]);
    Solicitacao::factory()->create([
        'status' => 'CONCLUIDA',
        'protocolo' => 'SOL-2026-0102',
        'updated_at' => Carbon::parse('2026-09-17 08:00:00'),
    ]);
    Solicitacao::factory()->create([
        'status' => 'CANCELADA',
        'protocolo' => 'SOL-2026-0103',
        'updated_at' => Carbon::parse('2026-09-18 08:00:00'),
    ]);

    $response = $this->getJson('/api/v1/solicitacoes?status_grupo=encerrado');

    $response->assertOk();
    expect($response->json('data.*.protocolo'))->toBe([
        'SOL-2026-0103',
        'SOL-2026-0102',
    ]);
});

test('per_page inválido retorna 422', function () {
    $response = $this->getJson('/api/v1/solicitacoes?per_page=200');

    $response->assertStatus(422);
});

test('ordena a fila por situação, prioridade e tempo de espera', function () {
    $base = [
        'paciente_id' => Paciente::factory()->create()->id,
        'cpf_solicitante' => '123.456.789-00',
        'data_nascimento' => '1985-06-15',
        'categoria' => 'CONSULTA',
        'descricao' => 'Solicitação fictícia para testar a ordem operacional.',
    ];

    // chk_justificativa_urgente exige justificativa não vazia quando URGENTE; o array
    // literal abaixo vence o `+` com $base porque não repetimos essa chave em $base.
    $criar = function (string $nome, string $protocolo, string $prioridade, string $status, string $criadaEm) use ($base): void {
        $solicitacao = Solicitacao::create($base + [
            'nome_solicitante' => $nome,
            'protocolo' => $protocolo,
            'prioridade' => $prioridade,
            'status' => $status,
            'justificativa_prioridade' => $prioridade === 'URGENTE'
                ? 'Justificativa fictícia para teste da ordem operacional.'
                : null,
        ]);
        $solicitacao->timestamps = false;
        // created_at/updated_at não são fillable: update() os ignoraria silenciosamente.
        $solicitacao->forceFill([
            'created_at' => Carbon::parse($criadaEm),
            'updated_at' => Carbon::parse($criadaEm),
        ])->save();
    };

    $criar('Baixa antiga', 'SOL-2026-0001', 'BAIXA', 'RECEBIDA', '2026-09-01 08:00:00');
    $criar('Urgente recente', 'SOL-2026-0002', 'URGENTE', 'RECEBIDA', '2026-09-17 08:00:00');
    $criar('Alta antiga', 'SOL-2026-0003', 'ALTA', 'EM_ANALISE', '2026-09-02 08:00:00');
    $criar('Urgente antiga', 'SOL-2026-0004', 'URGENTE', 'RECEBIDA', '2026-09-01 07:00:00');
    $criar('Urgente encerrada', 'SOL-2026-0005', 'URGENTE', 'CONCLUIDA', '2026-08-01 08:00:00');

    $response = $this->getJson('/api/v1/solicitacoes')->assertStatus(200);

    expect($response->json('data.*.protocolo'))->toBe([
        'SOL-2026-0004',
        'SOL-2026-0002',
        'SOL-2026-0003',
        'SOL-2026-0001',
        'SOL-2026-0005',
    ]);
});

test('filtra o dia operacional e ordena horário prioridade protocolo', function () {
    $criar = fn (string $protocolo, string $prioridade, string $utc) => Solicitacao::factory()->create([
        'protocolo' => $protocolo,
        'prioridade' => $prioridade,
        'justificativa_prioridade' => $prioridade === 'URGENTE' ? 'Teste fictício.' : null,
        'status' => 'AGENDADA',
        'agendado_para' => $utc,
    ]);
    $criar('SOL-2026-0203', 'BAIXA', '2026-09-25T12:00:00Z');
    $criar('SOL-2026-0202', 'URGENTE', '2026-09-25T12:00:00Z');
    $criar('SOL-2026-0201', 'ALTA', '2026-09-25T11:00:00Z');
    $criar('SOL-2026-0204', 'URGENTE', '2026-09-26T03:00:00Z');

    $response = $this->getJson('/api/v1/solicitacoes?data_agendada=2026-09-25');
    $response->assertOk();
    expect($response->json('data.*.protocolo'))->toBe([
        'SOL-2026-0201', 'SOL-2026-0202', 'SOL-2026-0203',
    ]);
});

test('horários exatos aparecem antes dos itens ordenados por turno na agenda', function () {
    $turno = Solicitacao::factory()->create(['status' => 'AGENDADA', 'agendado_para' => null]);
    Agendamento::factory()->create([
        'solicitacao_id' => $turno->id,
        'data_agendada' => '2026-09-25',
        'modalidade' => 'TURNO',
        'turno' => 'MANHA',
    ]);
    $horario = Solicitacao::factory()->create([
        'status' => 'AGENDADA',
        'agendado_para' => '2026-09-25T12:00:00Z',
    ]);

    $response = $this->getJson('/api/v1/solicitacoes?data_agendada=2026-09-25')->assertOk();

    expect($response->json('data.*.id'))->toBe([$horario->id, $turno->id]);
});

test('ordenação de data da agenda usa a data local também nos itens por turno', function () {
    $turno = Solicitacao::factory()->create(['status' => 'AGENDADA', 'agendado_para' => null]);
    Agendamento::factory()->create(['solicitacao_id' => $turno->id, 'data_agendada' => '2026-09-22', 'turno' => 'TARDE']);
    $horario = Solicitacao::factory()->create(['status' => 'AGENDADA', 'agendado_para' => '2026-09-30T12:00:00Z']);
    Agendamento::factory()->create(['solicitacao_id' => $horario->id, 'modalidade' => 'HORARIO', 'data_agendada' => '2026-09-30', 'hora_agendada' => '09:00']);

    $this->getJson('/api/v1/solicitacoes?status=AGENDADA&ordenar_por=data&direcao=asc')->assertOk()
        ->assertJsonPath('data.*.id', [$turno->id, $horario->id]);
});

test('ordenação explícita por prioridade mantém prioridade como chave antes da data da agenda', function () {
    $urgente = Solicitacao::factory()->create(['status' => 'AGENDADA', 'prioridade' => 'URGENTE', 'justificativa_prioridade' => 'Teste fictício.', 'agendado_para' => null]);
    Agendamento::factory()->create(['solicitacao_id' => $urgente->id, 'data_agendada' => '2026-09-30', 'turno' => 'TARDE']);
    $baixa = Solicitacao::factory()->create(['status' => 'AGENDADA', 'prioridade' => 'BAIXA', 'agendado_para' => null]);
    Agendamento::factory()->create(['solicitacao_id' => $baixa->id, 'data_agendada' => '2026-09-22', 'turno' => 'MANHA']);

    $this->getJson('/api/v1/solicitacoes?status=AGENDADA&ordenar_por=prioridade')->assertOk()
        ->assertJsonPath('data.*.id', [$urgente->id, $baixa->id]);
});

test('status explícito restringe corretamente o grupo de histórico', function () {
    $concluida = Solicitacao::factory()->create(['status' => 'CONCLUIDA']);
    Solicitacao::factory()->create(['status' => 'CANCELADA']);

    $this->getJson('/api/v1/solicitacoes?status_grupo=encerrado&status=CONCLUIDA')->assertOk()
        ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $concluida->id);
});

test('grupo aberto continua excluindo estados encerrados junto com status explícito', function () {
    Solicitacao::factory()->create(['status' => 'CONCLUIDA']);

    $this->getJson('/api/v1/solicitacoes?status_grupo=aberto&status=CONCLUIDA')->assertOk()
        ->assertJsonPath('meta.total', 0);
});

test('agenda diária exclui solicitações cujo agendamento já virou falta', function () {
    $solicitacao = Solicitacao::factory()->create([
        'status' => 'AGENDADA',
        'agendado_para' => '2026-09-25T17:30:00Z',
    ]);
    Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'data_agendada' => '2026-09-25',
        'modalidade' => 'HORARIO',
        'hora_agendada' => '14:30',
        'turno' => 'TARDE',
        'status' => 'FALTA',
    ]);

    $this->getJson('/api/v1/solicitacoes?data_agendada=2026-09-25')->assertOk()
        ->assertJsonPath('meta.total', 0);
});

test('rejeita combinações incompatíveis da agenda', function (string $query, string $campo) {
    $this->getJson("/api/v1/solicitacoes?$query")
        ->assertStatus(422)->assertJsonStructure(['errors' => [$campo]]);
})->with([
    ['data_agendada=2026-09-25&status=EM_ANALISE', 'status'],
    ['data_agendada=2026-09-25&status_grupo=encerrado', 'status_grupo'],
    ['data_agendada=25-09-2026', 'data_agendada'],
]);

test('agenda aceita grupo aberto e pagina resultados', function () {
    Solicitacao::factory()->count(3)->create([
        'status' => 'AGENDADA', 'agendado_para' => '2026-09-25T12:00:00Z',
    ]);
    $response = $this->getJson('/api/v1/solicitacoes?data_agendada=2026-09-25&status_grupo=aberto&per_page=2&page=2');
    $response->assertOk()->assertJsonPath('meta.total', 3)->assertJsonCount(1, 'data');
});

test('filtra a fila por status AGENDADA e ordena por agendado_para, não por prioridade (ADR 003)', function () {
    $criar = fn (string $protocolo, string $prioridade, string $utc) => Solicitacao::factory()->create([
        'protocolo' => $protocolo,
        'prioridade' => $prioridade,
        'justificativa_prioridade' => $prioridade === 'URGENTE' ? 'Teste fictício.' : null,
        'status' => 'AGENDADA',
        'agendado_para' => $utc,
    ]);
    // Prioridade BAIXA agendada mais cedo deve vir antes de uma URGENTE agendada mais tarde:
    // uma vez marcada a hora, quem decide a ordem é o compromisso, não a prioridade administrativa.
    $criar('SOL-2026-0301', 'BAIXA', '2026-09-25T11:00:00Z');
    $criar('SOL-2026-0302', 'URGENTE', '2026-09-26T09:00:00Z');
    $criar('SOL-2026-0303', 'ALTA', '2026-09-25T11:00:00Z'); // empate de horário com 0301: desempata por prioridade

    Solicitacao::factory()->create(['status' => 'RECEBIDA', 'prioridade' => 'URGENTE',
        'justificativa_prioridade' => 'Teste fictício.']);

    $response = $this->getJson('/api/v1/solicitacoes?status=AGENDADA')->assertOk();

    expect($response->json('data.*.protocolo'))->toBe([
        'SOL-2026-0303', 'SOL-2026-0301', 'SOL-2026-0302',
    ]);
    expect($response->json('data.*.status'))->each->toBe('AGENDADA');
});

test('busca por nome acentuado e protocolo, sem tratar curingas como padrão SQL', function () {
    Solicitacao::factory()->create(['nome_solicitante' => 'João da Silva', 'protocolo' => 'SOL-2026-0401']);
    Solicitacao::factory()->create(['nome_solicitante' => 'Maria Santos', 'protocolo' => 'SOL-2026-0402']);

    $this->getJson('/api/v1/solicitacoes?q=Jo%C3%A3o&per_page=1')
        ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.protocolo', 'SOL-2026-0401');

    $this->getJson('/api/v1/solicitacoes?q=SOL-2026-0402')
        ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.protocolo', 'SOL-2026-0402');
});

test('valida os parâmetros de busca e ordenação', function (string $query, string $campo) {
    $this->getJson("/api/v1/solicitacoes?$query")
        ->assertUnprocessable()->assertJsonStructure(['message', 'errors' => [$campo]]);
})->with([
    ['ordenar_por=campo_sql', 'ordenar_por'],
    ['direcao=ascendente', 'direcao'],
    ['q='.str_repeat('x', 101), 'q'],
]);

test('aplica período inclusivo no fuso operacional e ordenação de data nos resultados completos', function () {
    $dentroMaisNovo = Solicitacao::factory()->create(['protocolo' => 'SOL-2026-0502']);
    $dentroMaisAntigo = Solicitacao::factory()->create(['protocolo' => 'SOL-2026-0501']);
    $fora = Solicitacao::factory()->create(['protocolo' => 'SOL-2026-0500']);

    $dentroMaisNovo->forceFill(['created_at' => '2026-09-11T02:59:59Z'])->save();
    $dentroMaisAntigo->forceFill(['created_at' => '2026-09-10T03:00:00Z'])->save();
    $fora->forceFill(['created_at' => '2026-09-10T02:59:59Z'])->save();

    $this->getJson('/api/v1/solicitacoes?data_de=2026-09-10&data_ate=2026-09-10&ordenar_por=data&direcao=asc')
        ->assertOk()->assertJsonPath('meta.total', 2)
        ->assertJsonPath('data.0.protocolo', 'SOL-2026-0501')
        ->assertJsonPath('data.1.protocolo', 'SOL-2026-0502');

    $this->getJson('/api/v1/solicitacoes?ordenar_por=data&direcao=desc')
        ->assertOk()->assertJsonPath('data.0.protocolo', 'SOL-2026-0502');
});

test('listagens omitem data de nascimento e mascaram CPF, detalhe mantém campos para edição', function () {
    $solicitacao = Solicitacao::factory()->create([
        'cpf_solicitante' => '123.456.789-00',
        'data_nascimento' => '1985-06-15',
    ]);

    $this->getJson('/api/v1/solicitacoes')
        ->assertOk()
        ->assertJsonMissingPath('data.0.data_nascimento')
        ->assertJsonPath('data.0.cpf_solicitante', '***.456.789-**');

    $this->getJson("/api/v1/solicitacoes/{$solicitacao->id}")
        ->assertOk()
        ->assertJsonPath('data.data_nascimento', '1985-06-15')
        ->assertJsonPath('data.cpf_solicitante', '123.456.789-00');
});
