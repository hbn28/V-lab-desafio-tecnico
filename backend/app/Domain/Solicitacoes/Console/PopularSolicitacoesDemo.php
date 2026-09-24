<?php

namespace App\Domain\Solicitacoes\Console;

use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PopularSolicitacoesDemo extends Command
{
    protected $signature = 'solicitacoes:popular-demonstracao';

    protected $description = 'Insere 500 solicitações fictícias para demonstrar as telas';

    private const MARKER = '[DEMO-500]';

    public function handle(): int
    {
        DB::transaction(function (): void {
            // Evita duas cargas simultâneas e mantém toda a inserção atômica.
            DB::select('SELECT pg_advisory_xact_lock(50020260923)');

            if (DB::table('solicitacoes')->where('descricao', 'like', self::MARKER.'%')->exists()) {
                $this->info('A carga fictícia já está presente; nenhum registro foi duplicado.');

                return;
            }

            $status = array_merge(
                array_fill(0, 120, 'RECEBIDA'),
                array_fill(0, 100, 'EM_ANALISE'),
                array_fill(0, 140, 'AGENDADA'),
                array_fill(0, 90, 'CONCLUIDA'),
                array_fill(0, 50, 'CANCELADA'),
            );
            $this->embaralhar($status);

            $categorias = array_merge(
                array_fill(0, 125, 'CONSULTA'),
                array_fill(0, 125, 'EXAME'),
                array_fill(0, 125, 'VACINACAO'),
                array_fill(0, 125, 'OUTRO'),
            );
            $prioridades = array_merge(
                array_fill(0, 125, 'BAIXA'),
                array_fill(0, 125, 'MEDIA'),
                array_fill(0, 125, 'ALTA'),
                array_fill(0, 125, 'URGENTE'),
            );
            $this->embaralhar($categorias);
            $this->embaralhar($prioridades);
            $nomes = ['Alex', 'Breno', 'Camila', 'Davi', 'Elisa', 'Fabio', 'Giovana', 'Heitor', 'Iara', 'Joana', 'Kaique', 'Lara', 'Marina', 'Nilo', 'Olivia', 'Paulo', 'Rafaela', 'Sofia', 'Tania', 'Vitor'];
            $sobrenomes = ['Almeida', 'Barbosa', 'Campos', 'Dantas', 'Esteves', 'Ferreira', 'Gomes', 'Lima', 'Macedo', 'Nogueira', 'Oliveira', 'Pereira', 'Queiroz', 'Ribeiro', 'Santos', 'Teixeira', 'Vieira'];
            $descricoes = [
                'Atendimento de rotina solicitado.',
                'Avaliação de disponibilidade solicitada.',
                'Orientação sobre serviço solicitada.',
                'Retorno de atendimento solicitado.',
                'Solicitação de horário para atendimento.',
                'Pedido de informação sobre agenda.',
                'Acompanhamento administrativo solicitado.',
                'Encaminhamento para atendimento solicitado.',
            ];
            $ids = [];
            $protocolos = [];
            $cpfs = [];
            $agendadas = 0;
            $agora = CarbonImmutable::now();
            $fuso = config('agendamento.timezone', 'America/Recife');

            foreach ($status as $indice => $estado) {
                $id = $this->numeroLivre('id', $ids);
                $protocolo = (string) $this->numeroLivre('protocolo', $protocolos);
                $cpf = $this->cpfFicticioLivre($cpfs);
                $nome = '[DEMO] '.$nomes[random_int(0, count($nomes) - 1)].' '.$sobrenomes[random_int(0, count($sobrenomes) - 1)].' '.$sobrenomes[random_int(0, count($sobrenomes) - 1)];
                $nascimento = sprintf('%04d-%02d-%02d', random_int(1940, 2007), random_int(1, 12), random_int(1, 28));
                $categoria = $categorias[$indice];
                $prioridade = $prioridades[$indice];
                $criadoEm = $agora->subDays(random_int(31, 180))->subMinutes(random_int(0, 1439));
                $atualizadoEm = $criadoEm->addDays(random_int(0, 20));

                $pacienteId = DB::table('pacientes')->insertGetId([
                    'nome' => $nome,
                    'cpf' => $cpf,
                    'data_nascimento' => $nascimento,
                    'celular' => null,
                    'created_at' => $criadoEm,
                    'updated_at' => $criadoEm,
                ]);

                $agendamento = null;
                $agendadoPara = null;
                if ($estado === 'AGENDADA' || $estado === 'CONCLUIDA') {
                    $falta = $estado === 'AGENDADA' && ++$agendadas % 4 === 0;
                    $dia = $agora->setTimezone($fuso)->addDays($estado === 'CONCLUIDA' || $falta ? -random_int(1, 28) : random_int(1, 35));
                    $modalidade = random_int(0, 1) === 0 ? 'HORARIO' : 'TURNO';
                    $turno = ['MANHA', 'TARDE', 'NOITE'][random_int(0, 2)];
                    $hora = $modalidade === 'HORARIO'
                        ? ['MANHA' => random_int(7, 11), 'TARDE' => random_int(13, 17), 'NOITE' => random_int(18, 20)][$turno].':'.['00', '30'][random_int(0, 1)]
                        : null;
                    if ($falta || $estado === 'CONCLUIDA') {
                        $atualizadoEm = $dia->endOfDay()->utc();
                    }
                    $agendamento = [
                        'data_agendada' => $dia->toDateString(),
                        'modalidade' => $modalidade,
                        'hora_agendada' => $hora,
                        'turno' => $turno,
                        'status' => $falta ? 'FALTA' : ($estado === 'CONCLUIDA' ? 'REALIZADO' : 'AGENDADO'),
                        'resultado_em' => $falta || $estado === 'CONCLUIDA' ? $dia->endOfDay()->utc() : null,
                        'falta_registrada_em' => $falta ? $dia->endOfDay()->utc() : null,
                        'falta_corrigida_em' => null,
                        'created_at' => $criadoEm,
                        'updated_at' => $atualizadoEm,
                    ];
                    if ($hora !== null) {
                        $agendadoPara = $dia->setTime((int) substr($hora, 0, 2), (int) substr($hora, 3, 2))->utc();
                    }
                }

                DB::table('solicitacoes')->insert([
                    'id' => $id,
                    'paciente_id' => $pacienteId,
                    'protocolo' => $protocolo,
                    'nome_solicitante' => $nome,
                    'cpf_solicitante' => substr($cpf, 0, 3).'.'.substr($cpf, 3, 3).'.'.substr($cpf, 6, 3).'-'.substr($cpf, 9),
                    'data_nascimento' => $nascimento,
                    'categoria' => $categoria,
                    'prioridade' => $prioridade,
                    'status' => $estado,
                    'descricao' => self::MARKER.' '.$descricoes[random_int(0, count($descricoes) - 1)],
                    'justificativa_prioridade' => $prioridade === 'URGENTE' ? 'Prioridade fictícia para demonstração; sem informação clínica real.' : null,
                    'agendado_para' => $agendadoPara,
                    'created_at' => $criadoEm,
                    'updated_at' => $atualizadoEm,
                ]);

                if ($estado === 'EM_ANALISE') {
                    DB::table('entradas_fila')->insert([
                        'solicitacao_id' => $id,
                        'entrou_em' => $atualizadoEm,
                        'encerrada_em' => null,
                        'motivo_encerramento' => null,
                        'created_at' => $atualizadoEm,
                        'updated_at' => $atualizadoEm,
                    ]);
                }
                if ($agendamento !== null) {
                    $agendamentoId = DB::table('agendamentos')->insertGetId(['solicitacao_id' => $id] + $agendamento);
                    if ($agendamento['status'] === 'FALTA' && $agendadas % 8 === 0) {
                        $contatoEm = $agendamento['falta_registrada_em']->addHours(random_int(1, 12));
                        DB::table('tentativas_contato')->insert([
                            'agendamento_id' => $agendamentoId,
                            'resultado' => ['SEM_RESPOSTA', 'RECADO', 'CONFIRMOU_RETORNO', 'NUMERO_INVALIDO'][random_int(0, 3)],
                            'realizada_em' => $contatoEm,
                            'created_at' => $contatoEm,
                            'updated_at' => $contatoEm,
                        ]);
                    }
                }
            }

            $this->info('500 solicitações fictícias inseridas com IDs e protocolos únicos de oito dígitos.');
        });

        return self::SUCCESS;
    }

    private function numeroLivre(string $coluna, array &$usados): int
    {
        do {
            $numero = random_int(10_000_000, 99_999_999);
            $valor = $coluna === 'protocolo' ? (string) $numero : $numero;
        } while (isset($usados[$numero]) || DB::table('solicitacoes')->where($coluna, $valor)->exists());

        $usados[$numero] = true;

        return $numero;
    }

    private function cpfFicticioLivre(array &$usados): string
    {
        do {
            $base = '0'.str_pad((string) random_int(0, 99_999_999), 8, '0', STR_PAD_LEFT);
            $soma = 0;
            for ($indice = 0; $indice < 9; $indice++) {
                $soma += (int) $base[$indice] * (10 - $indice);
            }
            $digitoCorreto = ($soma * 10) % 11;
            $digitoCorreto = $digitoCorreto === 10 ? 0 : $digitoCorreto;
            // Primeiro dígito verificador deliberadamente errado: não identifica uma pessoa real.
            $cpf = $base.(($digitoCorreto + 1) % 10).random_int(0, 9);
        } while (isset($usados[$cpf]) || DB::table('pacientes')->where('cpf', $cpf)->exists());

        $usados[$cpf] = true;

        return $cpf;
    }

    private function embaralhar(array &$valores): void
    {
        for ($i = count($valores) - 1; $i > 0; $i--) {
            $outro = random_int(0, $i);
            [$valores[$i], $valores[$outro]] = [$valores[$outro], $valores[$i]];
        }
    }
}
