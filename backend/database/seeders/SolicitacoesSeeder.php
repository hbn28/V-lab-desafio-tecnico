<?php

namespace Database\Seeders;

use App\Models\Solicitacao;
use Illuminate\Database\Seeder;

class SolicitacoesSeeder extends Seeder
{
    public function run(): void
    {
        $fixtures = [
            ['protocolo' => 'SOL-2025-0001', 'nome_solicitante' => 'Maria Silva',    'cpf_solicitante' => '111.222.333-44', 'data_nascimento' => '1985-03-12', 'categoria' => 'CONSULTA',  'prioridade' => 'ALTA',    'status' => 'RECEBIDA',   'descricao' => 'Consulta de rotina em cardiologia.',            'justificativa_prioridade' => null],
            ['protocolo' => 'SOL-2025-0002', 'nome_solicitante' => 'João Santos',    'cpf_solicitante' => '222.333.444-55', 'data_nascimento' => '1970-07-20', 'categoria' => 'EXAME',     'prioridade' => 'URGENTE', 'status' => 'EM_ANALISE', 'descricao' => 'Exame de sangue com resultado alterado.',       'justificativa_prioridade' => 'Paciente com suspeita de quadro grave confirmada por médico.'],
            ['protocolo' => 'SOL-2025-0003', 'nome_solicitante' => 'Ana Oliveira',   'cpf_solicitante' => '333.444.555-66', 'data_nascimento' => '1992-11-05', 'categoria' => 'VACINACAO', 'prioridade' => 'BAIXA',   'status' => 'AGENDADA',   'descricao' => 'Vacinação de rotina anual.',                   'justificativa_prioridade' => null],
            ['protocolo' => 'SOL-2025-0004', 'nome_solicitante' => 'Pedro Costa',    'cpf_solicitante' => '444.555.666-77', 'data_nascimento' => '1978-01-30', 'categoria' => 'CONSULTA',  'prioridade' => 'MEDIA',   'status' => 'CONCLUIDA',  'descricao' => 'Consulta com especialista em ortopedia.',       'justificativa_prioridade' => null],
            ['protocolo' => 'SOL-2025-0005', 'nome_solicitante' => 'Lucia Ferreira', 'cpf_solicitante' => '555.666.777-88', 'data_nascimento' => '1965-09-18', 'categoria' => 'OUTRO',     'prioridade' => 'BAIXA',   'status' => 'CANCELADA',  'descricao' => 'Solicitação de atendimento domiciliar.',        'justificativa_prioridade' => null],
            ['protocolo' => 'SOL-2025-0006', 'nome_solicitante' => 'Carlos Souza',   'cpf_solicitante' => '666.777.888-99', 'data_nascimento' => '1990-04-22', 'categoria' => 'EXAME',     'prioridade' => 'MEDIA',   'status' => 'RECEBIDA',   'descricao' => 'Exame de imagem para diagnóstico.',             'justificativa_prioridade' => null],
            ['protocolo' => 'SOL-2025-0007', 'nome_solicitante' => 'Fernanda Lima',  'cpf_solicitante' => '777.888.999-00', 'data_nascimento' => '1988-06-14', 'categoria' => 'CONSULTA',  'prioridade' => 'URGENTE', 'status' => 'EM_ANALISE', 'descricao' => 'Consulta de emergência pós-cirurgia.',          'justificativa_prioridade' => 'Complicação pós-operatória relatada pelo médico assistente.'],
            ['protocolo' => 'SOL-2025-0008', 'nome_solicitante' => 'Roberto Alves',  'cpf_solicitante' => '888.999.000-11', 'data_nascimento' => '1948-02-28', 'categoria' => 'VACINACAO', 'prioridade' => 'ALTA',    'status' => 'AGENDADA',   'descricao' => 'Vacinação contra gripe para idoso acamado.',    'justificativa_prioridade' => null],
            ['protocolo' => 'SOL-2025-0009', 'nome_solicitante' => 'Camila Rocha',   'cpf_solicitante' => '999.000.111-22', 'data_nascimento' => '1995-12-03', 'categoria' => 'EXAME',     'prioridade' => 'BAIXA',   'status' => 'RECEBIDA',   'descricao' => 'Exame preventivo anual de rotina.',             'justificativa_prioridade' => null],
            ['protocolo' => 'SOL-2025-0010', 'nome_solicitante' => 'Marcos Pereira', 'cpf_solicitante' => '000.111.222-33', 'data_nascimento' => '1982-08-07', 'categoria' => 'CONSULTA',  'prioridade' => 'MEDIA',   'status' => 'CONCLUIDA',  'descricao' => 'Consulta de acompanhamento pós-exames.',        'justificativa_prioridade' => null],
        ];

        $fuso   = config('agendamento.timezone');
        $amanha = now($fuso)->addDay()->setTime(9, 0)->utc();
        $depois = now($fuso)->addDays(2)->setTime(14, 30)->utc();
        $agenda = ['SOL-2025-0003' => $amanha, 'SOL-2025-0008' => $depois];

        foreach ($fixtures as $dados) {
            // chk_agendada_com_horario: AGENDADA exige horário; os demais estados iniciais não podem tê-lo.
            $dados['agendado_para'] = $agenda[$dados['protocolo']] ?? null;

            Solicitacao::firstOrCreate(
                ['protocolo' => $dados['protocolo']],
                $dados
            );
        }
    }
}
