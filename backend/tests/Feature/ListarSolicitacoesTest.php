<?php

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
        'cpf_solicitante'  => '111.222.333-44',
        'data_nascimento'  => '1992-07-10',
        'categoria'        => 'CONSULTA',
        'prioridade'       => 'BAIXA',
        'descricao'        => 'Consulta de rotina anual para checkup geral completo.',
    ])->assertStatus(201);

    $all      = $this->getJson('/api/v1/solicitacoes')->assertStatus(200);
    $filtered = $this->getJson('/api/v1/solicitacoes?status=RECEBIDA')->assertStatus(200);
    $empty    = $this->getJson('/api/v1/solicitacoes?status=CONCLUIDA')->assertStatus(200);

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
        'cpf_solicitante' => '123.456.789-00',
        'data_nascimento' => '1985-06-15',
        'categoria' => 'CONSULTA',
        'descricao' => 'Solicitação fictícia para testar a ordem operacional.',
        'justificativa_prioridade' => null,
    ];

    $criar = function (string $nome, string $protocolo, string $prioridade, string $status, string $criadaEm) use ($base): void {
        $solicitacao = Solicitacao::create($base + [
            'nome_solicitante' => $nome,
            'protocolo' => $protocolo,
            'prioridade' => $prioridade,
            'status' => $status,
        ]);
        $solicitacao->timestamps = false;
        $solicitacao->update([
            'created_at' => Carbon::parse($criadaEm),
            'updated_at' => Carbon::parse($criadaEm),
        ]);
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
