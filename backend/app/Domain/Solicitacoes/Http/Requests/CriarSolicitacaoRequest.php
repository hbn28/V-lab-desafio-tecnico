<?php

namespace App\Domain\Solicitacoes\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CriarSolicitacaoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nome_solicitante' => ['required', 'string', 'max:255'],
            'cpf_solicitante' => ['required', 'string', 'max:14', 'regex:/^\d{3}\.\d{3}\.\d{3}-\d{2}$/'],
            'data_nascimento' => ['required', 'date_format:Y-m-d', 'before:today', 'after:1900-01-01'],
            'categoria' => ['required', 'string', 'in:CONSULTA,EXAME,VACINACAO,OUTRO'],
            'prioridade' => ['required', 'string', 'in:BAIXA,MEDIA,ALTA,URGENTE'],
            'descricao' => ['required', 'string', 'max:2000'],
            'justificativa_prioridade' => ['nullable', 'string', 'max:1000'],
            // campos que não devem ser aceitos
            'id' => ['prohibited'],
            'protocolo' => ['prohibited'],
            'status' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'nome_solicitante.required' => 'O nome do solicitante é obrigatório.',
            'nome_solicitante.max' => 'O nome do solicitante não pode ter mais de 255 caracteres.',

            'cpf_solicitante.required' => 'O CPF do solicitante é obrigatório.',
            'cpf_solicitante.max' => 'O CPF não pode ter mais de 14 caracteres.',
            'cpf_solicitante.regex' => 'O CPF deve estar no formato 000.000.000-00.',

            'data_nascimento.required' => 'A data de nascimento é obrigatória.',
            'data_nascimento.date_format' => 'A data de nascimento deve estar no formato AAAA-MM-DD.',
            'data_nascimento.before' => 'A data de nascimento deve ser anterior à data de hoje.',
            'data_nascimento.after' => 'A data de nascimento deve ser posterior a 01/01/1900.',

            'categoria.required' => 'A categoria é obrigatória.',
            'categoria.in' => 'A categoria deve ser uma das seguintes: CONSULTA, EXAME, VACINACAO, OUTRO.',

            'prioridade.required' => 'A prioridade é obrigatória.',
            'prioridade.in' => 'A prioridade deve ser uma das seguintes: BAIXA, MEDIA, ALTA, URGENTE.',

            'descricao.required' => 'A descrição é obrigatória.',
            'descricao.max' => 'A descrição não pode ter mais de 2000 caracteres.',

            'justificativa_prioridade.max' => 'A justificativa não pode ter mais de 1000 caracteres.',

            'id.prohibited' => 'O campo id não é permitido.',
            'protocolo.prohibited' => 'O campo protocolo não é permitido.',
            'status.prohibited' => 'O campo status não é permitido.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if (
                $this->input('prioridade') === 'URGENTE' &&
                blank(trim($this->input('justificativa_prioridade', '')))
            ) {
                $validator->errors()->add(
                    'justificativa_prioridade',
                    'A justificativa é obrigatória para prioridade URGENTE.'
                );
            }
        });
    }
}
