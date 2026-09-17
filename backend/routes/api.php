<?php

use App\Domain\Health\HealthController;
use App\Domain\Solicitacoes\Http\Controllers\SolicitacaoController;
use Illuminate\Support\Facades\Route;

Route::prefix('api/v1')->group(function () {
    Route::get('/health', HealthController::class);

    Route::post('/solicitacoes', [SolicitacaoController::class, 'store']);
    Route::get('/solicitacoes', [SolicitacaoController::class, 'index']);
    Route::get('/solicitacoes/{id}', [SolicitacaoController::class, 'show']);
    Route::patch('/solicitacoes/{id}/status', [SolicitacaoController::class, 'updateStatus']);
});
