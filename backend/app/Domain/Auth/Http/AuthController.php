<?php

namespace App\Domain\Auth\Http;

use App\Domain\Auth\Actions\CadastrarOperador;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController
{
    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();
        if (isset($credentials['login'])) {
            $login = $credentials['login'];
            unset($credentials['login']);
            $credentials[str_contains($login, '@') ? 'email' : 'username'] = $login;
        }
        if (! Auth::guard('web')->attempt($credentials)) {
            return response()->json(['message' => 'Credenciais inválidas.', 'errors' => []], 422);
        }

        /** @var User $user */
        $user = Auth::guard('web')->user();
        if (! $user->is_active) {
            Auth::guard('web')->logout();

            return response()->json(['message' => 'Credenciais inválidas.', 'errors' => []], 422);
        }

        $request->session()->regenerate();

        return response()->json(['data' => $this->publicUser($user)]);
    }

    /** Informa à tela de login se o cadastro público está aberto. */
    public function statusCadastro(): JsonResponse
    {
        return response()->json(['data' => ['habilitado' => (bool) config('cadastro.publico')]]);
    }

    /**
     * Cadastro público: a conta nasce sempre ATENDENTE e ativa — perfil e status
     * nunca vêm do corpo da requisição. Administradores só são criados pelo
     * comando `operadores:criar`.
     */
    public function cadastrar(CadastroRequest $request, CadastrarOperador $cadastrarOperador): JsonResponse
    {
        if (! config('cadastro.publico')) {
            return response()->json([
                'message' => 'O cadastro de novas contas está desativado. Peça uma conta ao administrador.',
                'errors' => [],
            ], 403);
        }

        $user = $cadastrarOperador->execute($request->validated());

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return response()->json(['data' => $this->publicUser($user)], 201);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->publicUser($request->user())]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['data' => null]);
    }

    private function publicUser(User $user): array
    {
        return $user->only(['id', 'name', 'username', 'email', 'role']);
    }
}
