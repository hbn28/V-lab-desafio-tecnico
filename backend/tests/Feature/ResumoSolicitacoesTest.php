<?php

use App\Models\Solicitacao;

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
    ]);
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
