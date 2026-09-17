<?php

namespace Database\Seeders;

use App\Models\Solicitacao;
use Illuminate\Database\Seeder;

class SolicitacoesSeeder extends Seeder
{
    public function run(): void
    {
        $fixtures = [
            ['protocolo' => 'SOL-2025-0001', 'nome_solicitante' => 'Maria Silva',    'categoria' => 'CONSULTA',  'prioridade' => 'ALTA',    'status' => 'RECEBIDA',    'descricao' => 'Consulta de rotina em cardiologia.',            'justificativa_prioridade' => null],
            ['protocolo' => 'SOL-2025-0002', 'nome_solicitante' => 'João Santos',    'categoria' => 'EXAME',     'prioridade' => 'URGENTE', 'status' => 'EM_ANALISE',  'descricao' => 'Exame de sangue com resultado alterado.',       'justificativa_prioridade' => 'Paciente com suspeita de quadro grave confirmada por médico.'],
            ['protocolo' => 'SOL-2025-0003', 'nome_solicitante' => 'Ana Oliveira',   'categoria' => 'VACINACAO', 'prioridade' => 'BAIXA',   'status' => 'AGENDADA',    'descricao' => 'Vacinação de rotina anual.',                   'justificativa_prioridade' => null],
            ['protocolo' => 'SOL-2025-0004', 'nome_solicitante' => 'Pedro Costa',    'categoria' => 'CONSULTA',  'prioridade' => 'MEDIA',   'status' => 'CONCLUIDA',   'descricao' => 'Consulta com especialista em ortopedia.',       'justificativa_prioridade' => null],
            ['protocolo' => 'SOL-2025-0005', 'nome_solicitante' => 'Lucia Ferreira', 'categoria' => 'OUTRO',     'prioridade' => 'BAIXA',   'status' => 'CANCELADA',   'descricao' => 'Solicitação de atendimento domiciliar.',        'justificativa_prioridade' => null],
            ['protocolo' => 'SOL-2025-0006', 'nome_solicitante' => 'Carlos Souza',   'categoria' => 'EXAME',     'prioridade' => 'MEDIA',   'status' => 'RECEBIDA',    'descricao' => 'Exame de imagem para diagnóstico.',             'justificativa_prioridade' => null],
            ['protocolo' => 'SOL-2025-0007', 'nome_solicitante' => 'Fernanda Lima',  'categoria' => 'CONSULTA',  'prioridade' => 'URGENTE', 'status' => 'EM_ANALISE',  'descricao' => 'Consulta de emergência pós-cirurgia.',          'justificativa_prioridade' => 'Complicação pós-operatória relatada pelo médico assistente.'],
            ['protocolo' => 'SOL-2025-0008', 'nome_solicitante' => 'Roberto Alves',  'categoria' => 'VACINACAO', 'prioridade' => 'ALTA',    'status' => 'AGENDADA',    'descricao' => 'Vacinação contra gripe para idoso acamado.',    'justificativa_prioridade' => null],
            ['protocolo' => 'SOL-2025-0009', 'nome_solicitante' => 'Camila Rocha',   'categoria' => 'EXAME',     'prioridade' => 'BAIXA',   'status' => 'RECEBIDA',    'descricao' => 'Exame preventivo anual de rotina.',             'justificativa_prioridade' => null],
            ['protocolo' => 'SOL-2025-0010', 'nome_solicitante' => 'Marcos Pereira', 'categoria' => 'CONSULTA',  'prioridade' => 'MEDIA',   'status' => 'CONCLUIDA',   'descricao' => 'Consulta de acompanhamento pós-exames.',        'justificativa_prioridade' => null],
        ];

        foreach ($fixtures as $dados) {
            Solicitacao::firstOrCreate(
                ['protocolo' => $dados['protocolo']],
                $dados
            );
        }
    }
}
