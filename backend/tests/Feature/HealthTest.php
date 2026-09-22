<?php

use Illuminate\Support\Facades\DB;

test('health check retorna ok quando banco está disponível', function () {
    $response = $this->getJson('/api/v1/health');

    $response->assertStatus(200)
        ->assertJson(['status' => 'ok', 'db' => 'ok']);
});

test('health check retorna 503 quando banco falha', function () {
    DB::shouldReceive('select')->andThrow(new Exception('Connection refused'));

    $response = $this->getJson('/api/v1/health');

    $response->assertStatus(503)
        ->assertJson(['status' => 'degraded', 'db' => 'error']);

    expect($response->getContent())->not->toContain('Connection refused');
});
