<?php

use App\Models\Solicitacao;
use Illuminate\Support\Carbon;

function criarSolicitacaoResumo(string $protocolo, string $prioridade, string $status, string $categoria = 'CONSULTA'): Solicitacao
{
    return Solicitacao::create([
        'protocolo'        => $protocolo,
        'nome_solicitante' => 'Solicitante '.$protocolo,
        'cpf_solicitante'  => '123.456.789-00',
        'data_nascimento'  => '1990-01-01',
        'categoria'        => $categoria,
        'prioridade'       => $prioridade,
        'status'           => $status,
        'descricao'        => 'Solicitação fictícia para o resumo do painel.',
        // chk_justificativa_urgente exige justificativa não vazia quando URGENTE.
        'justificativa_prioridade' => $prioridade === 'URGENTE'
            ? 'Justificativa fictícia para teste do resumo.'
            : null,
    ]);
}

function criarSolicitacaoComData(string $protocolo, string $prioridade, string $status, string $criadaEm): Solicitacao
{
    $solicitacao = criarSolicitacaoResumo($protocolo, $prioridade, $status);
    $solicitacao->timestamps = false;
    // created_at/updated_at não são fillable: update() os ignoraria silenciosamente.
    $solicitacao->forceFill(['created_at' => Carbon::parse($criadaEm), 'updated_at' => Carbon::parse($criadaEm)])->save();

    return $solicitacao;
}

test('resumo agrega status e prioridade aberta globalmente, sem paginação', function () {
    criarSolicitacaoResumo('SOL-2026-0001', 'URGENTE', 'RECEBIDA');
    criarSolicitacaoResumo('SOL-2026-0002', 'URGENTE', 'CONCLUIDA');
    criarSolicitacaoResumo('SOL-2026-0003', 'ALTA', 'EM_ANALISE');
    criarSolicitacaoResumo('SOL-2026-0004', 'BAIXA', 'CANCELADA');

    $response = $this->getJson('/api/v1/solicitacoes/resumo')->assertStatus(200);

    expect($response->json('data.status.RECEBIDA'))->toBe(1);
    expect($response->json('data.status.CONCLUIDA'))->toBe(1);
    expect($response->json('data.status.CANCELADA'))->toBe(1);
    expect($response->json('data.prioridade_aberta.URGENTE'))->toBe(1);
    expect($response->json('data.prioridade_aberta.ALTA'))->toBe(1);
    expect($response->json('data.prioridade_aberta.BAIXA'))->toBe(0);
    expect($response->json('data.total'))->toBe(4);
    expect($response->json('data.filtros_aplicados'))->toBe(['categoria' => null, 'prioridade' => null]);
    // URGENTE tem 1 solicitação aberta -> data de nascimento preenchida; BAIXA não tem nenhuma aberta -> null.
    expect($response->json('data.mais_antiga_aberta.URGENTE'))->not->toBeNull();
    expect($response->json('data.mais_antiga_aberta.BAIXA'))->toBeNull();
});

test('mais_antiga_aberta reflete a solicitação em aberto mais antiga daquela prioridade, ignorando encerradas', function () {
    criarSolicitacaoComData('SOL-2026-0040', 'URGENTE', 'RECEBIDA', '2026-09-10 08:00:00');
    criarSolicitacaoComData('SOL-2026-0041', 'URGENTE', 'EM_ANALISE', '2026-09-05 08:00:00');
    // Mais antiga de todas, mas encerrada — não deve contar como "esperando".
    criarSolicitacaoComData('SOL-2026-0042', 'URGENTE', 'CONCLUIDA', '2026-08-01 08:00:00');

    $response = $this->getJson('/api/v1/solicitacoes/resumo')->assertStatus(200);

    expect($response->json('data.mais_antiga_aberta.URGENTE'))
        ->toBe(Carbon::parse('2026-09-05 08:00:00')->toIso8601String());
});

test('resumo filtrado por categoria restringe os dois blocos', function () {
    criarSolicitacaoResumo('SOL-2026-0020', 'URGENTE', 'RECEBIDA', 'EXAME');
    criarSolicitacaoResumo('SOL-2026-0021', 'URGENTE', 'RECEBIDA', 'CONSULTA');
    criarSolicitacaoResumo('SOL-2026-0022', 'ALTA', 'EM_ANALISE', 'EXAME');

    $response = $this->getJson('/api/v1/solicitacoes/resumo?categoria=EXAME')->assertStatus(200);

    expect($response->json('data.status.RECEBIDA'))->toBe(1);
    expect($response->json('data.status.EM_ANALISE'))->toBe(1);
    expect($response->json('data.prioridade_aberta.URGENTE'))->toBe(1);
    expect($response->json('data.prioridade_aberta.ALTA'))->toBe(1);
    expect($response->json('data.total'))->toBe(2);
    expect($response->json('data.filtros_aplicados.categoria'))->toBe('EXAME');
});

test('resumo filtrado por prioridade restringe apenas a quebra por status, não a quebra por prioridade', function () {
    criarSolicitacaoResumo('SOL-2026-0030', 'URGENTE', 'RECEBIDA');
    criarSolicitacaoResumo('SOL-2026-0031', 'ALTA', 'RECEBIDA');
    criarSolicitacaoResumo('SOL-2026-0032', 'ALTA', 'EM_ANALISE');

    $response = $this->getJson('/api/v1/solicitacoes/resumo?prioridade=ALTA')->assertStatus(200);

    // "Andamento da fila" respeita o filtro de prioridade: só conta os ALTA.
    expect($response->json('data.status.RECEBIDA'))->toBe(1);
    expect($response->json('data.status.EM_ANALISE'))->toBe(1);
    expect($response->json('data.total'))->toBe(2);

    // "Prioridades em aberto" não é filtrado por prioridade — é a própria
    // dimensão que ele detalha, então continua mostrando todas as prioridades.
    expect($response->json('data.prioridade_aberta.URGENTE'))->toBe(1);
    expect($response->json('data.prioridade_aberta.ALTA'))->toBe(2);
});

test('categoria ou prioridade inválida no resumo retorna 422', function () {
    $this->getJson('/api/v1/solicitacoes/resumo?categoria=INVALIDA')->assertStatus(422);
    $this->getJson('/api/v1/solicitacoes/resumo?prioridade=INVALIDA')->assertStatus(422);
});

test('status_grupo=aberto filtra RECEBIDA, EM_ANALISE e AGENDADA', function () {
    criarSolicitacaoResumo('SOL-2026-0010', 'URGENTE', 'RECEBIDA');
    criarSolicitacaoResumo('SOL-2026-0011', 'URGENTE', 'AGENDADA');
    criarSolicitacaoResumo('SOL-2026-0012', 'URGENTE', 'CONCLUIDA');

    $response = $this->getJson('/api/v1/solicitacoes?status_grupo=aberto&prioridade=URGENTE')->assertStatus(200);

    expect($response->json('meta.total'))->toBe(2);
    expect($response->json('data.*.protocolo'))->toEqualCanonicalizing(['SOL-2026-0010', 'SOL-2026-0011']);
});

test('status_grupo inválido retorna 422', function () {
    $this->getJson('/api/v1/solicitacoes?status_grupo=invalido')->assertStatus(422);
});
