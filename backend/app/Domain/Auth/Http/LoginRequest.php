<?php

namespace App\Domain\Auth\Http;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'login' => ['required_without:email', 'string'],
            'email' => ['required_without:login', 'email'],
            'password' => ['required', 'string'],
        ];
    }
}
