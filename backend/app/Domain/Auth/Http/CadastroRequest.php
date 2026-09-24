<?php

namespace App\Domain\Auth\Http;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class CadastroRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'username' => is_string($this->input('username')) ? trim($this->input('username')) : $this->input('username'),
            'email' => is_string($this->input('email')) && trim($this->input('email')) !== '' ? trim($this->input('email')) : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'min:3', 'max:50', 'regex:/^[a-zA-Z0-9._-]+$/', Rule::unique('users', 'username')],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'confirmed', Password::min(8)],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Informe seu nome.',
            'name.max' => 'O nome pode ter no máximo 255 caracteres.',
            'username.required' => 'Escolha um nome de usuário.',
            'username.min' => 'O usuário precisa ter pelo menos 3 caracteres.',
            'username.max' => 'O usuário pode ter no máximo 50 caracteres.',
            'username.regex' => 'Use apenas letras, números, ponto, hífen ou sublinhado no usuário, sem espaços.',
            'username.unique' => 'Este usuário já está em uso.',
            'email.email' => 'Informe um e-mail válido.',
            'email.unique' => 'Este e-mail já está cadastrado.',
            'password.required' => 'Crie uma senha.',
            'password.confirmed' => 'A confirmação da senha não confere.',
            'password.min' => 'A senha precisa ter pelo menos 8 caracteres.',
        ];
    }
}
