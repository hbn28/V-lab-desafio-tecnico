<?php

use App\Domain\Auth\Console\CriarOperador;
use App\Domain\Solicitacoes\Console\PopularSolicitacoesDemo;
use App\Http\Middleware\RequestId;
use App\Providers\AppServiceProvider;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withProviders([AppServiceProvider::class])
    ->withCommands([CriarOperador::class, PopularSolicitacoesDemo::class])
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        apiPrefix: '',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->statefulApi();
        $middleware->appendToGroup('api', [
            RequestId::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            return response()->json(['message' => 'Autenticação necessária.', 'errors' => []], 401);
        });

        $exceptions->render(function (AuthorizationException $e, Request $request) {
            return response()->json(['message' => 'Acesso não permitido.', 'errors' => []], 403);
        });

        $exceptions->render(function (AccessDeniedHttpException $e, Request $request) {
            return response()->json(['message' => 'Acesso não permitido.', 'errors' => []], 403);
        });

        $exceptions->render(function (TokenMismatchException $e, Request $request) {
            return response()->json(['message' => 'Sessão expirada. Entre novamente.', 'errors' => []], 419);
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            return response()->json([
                'message' => 'Recurso não encontrado.',
                'errors' => [],
            ], 404);
        });

        $exceptions->render(function (MethodNotAllowedHttpException $e, Request $request) {
            return response()->json([
                'message' => 'Método HTTP não permitido.',
                'errors' => [],
            ], 405);
        });

        $exceptions->render(function (TooManyRequestsHttpException $e, Request $request) {
            return response()->json([
                'message' => 'Muitas requisições. Tente novamente mais tarde.',
                'errors' => [],
            ], 429);
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            return response()->json([
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'Erro interno do servidor.',
                    'errors' => [],
                ], 500);
            }
        });
    })->create();
