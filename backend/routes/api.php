<?php

use App\Domain\Auth\Http\AuthController;
use App\Domain\Health\HealthController;
use App\Domain\Notificacoes\Http\Controllers\NotificacaoController;
use App\Domain\Solicitacoes\Http\Controllers\SolicitacaoController;
use App\Http\Middleware\EnsureActiveUser;
use Illuminate\Support\Facades\Route;

// {id} só casa com dígitos: /solicitacoes/abc cai em 404, não em TypeError/500.
Route::prefix('api/v1')->group(function () {
    Route::get('/health', HealthController::class);
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware(['web', 'throttle:5,1']);
    Route::get('/auth/me', [AuthController::class, 'me'])->middleware(['web', 'auth:sanctum', EnsureActiveUser::class]);
    Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware(['web', 'auth:sanctum', EnsureActiveUser::class]);

    Route::middleware(['web', 'auth:web', EnsureActiveUser::class])->group(function () {
        Route::get('/notificacoes', [NotificacaoController::class, 'index']);
        Route::patch('/notificacoes/{id}/lida', [NotificacaoController::class, 'markRead'])->whereNumber('id');
        Route::post('/solicitacoes', [SolicitacaoController::class, 'store']);
        Route::get('/solicitacoes/resumo', [SolicitacaoController::class, 'resumo']);
        Route::get('/fila', [SolicitacaoController::class, 'fila']);
        Route::get('/solicitacoes', [SolicitacaoController::class, 'index']);
        Route::get('/solicitacoes/{id}', [SolicitacaoController::class, 'show'])->whereNumber('id');
        Route::put('/solicitacoes/{id}', [SolicitacaoController::class, 'update'])->whereNumber('id');
        Route::patch('/solicitacoes/{id}/status', [SolicitacaoController::class, 'updateStatus'])->whereNumber('id');
        Route::patch('/solicitacoes/{id}/agendamento', [SolicitacaoController::class, 'updateAgendamento'])->whereNumber('id');
        Route::delete('/solicitacoes/{id}', [SolicitacaoController::class, 'destroy'])->whereNumber('id');

        Route::get('/faltas', [SolicitacaoController::class, 'faltas']);
        Route::post('/agendamentos/{id}/falta', [SolicitacaoController::class, 'registrarFalta'])->whereNumber('id');
        Route::post('/agendamentos/{id}/tentativas-contato', [SolicitacaoController::class, 'registrarTentativaContato'])->whereNumber('id');
        Route::post('/agendamentos/{id}/reagendar-apos-falta', [SolicitacaoController::class, 'reagendarAposFalta'])->whereNumber('id');
    });
});
