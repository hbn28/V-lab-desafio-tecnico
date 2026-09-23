<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Domain\Solicitacoes\Support\HorarioAgendamento;
use App\Models\Solicitacao;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class ListarSolicitacoes
{
    public function execute(array $filtros): LengthAwarePaginator
    {
        $statusGrupo = $filtros['status_grupo'] ?? null;
        $dataAgendada = $filtros['data_agendada'] ?? null;
        $status = $dataAgendada ? 'AGENDADA' : ($filtros['status'] ?? null);
        $contexto = $statusGrupo === 'encerrado' ? 'historico' : ($status === 'AGENDADA' ? 'agendadas' : 'fila');

        $query = Solicitacao::query()->with(['paciente', 'agendamentoAtivo']);

        if ($statusGrupo === 'encerrado') {
            $query->whereIn('status', ['CONCLUIDA', 'CANCELADA']);
            if ($status) {
                $query->where('status', $status);
            }
        } else {
            if ($statusGrupo === 'aberto') {
                $query->whereNotIn('status', ['CONCLUIDA', 'CANCELADA']);
            }
            if ($status) {
                $query->where('status', $status);
            }
            if ($status === 'AGENDADA') {
                // Uma solicitação com agendamento em FALTA continua AGENDADA
                // por regra de domínio, mas não pertence mais à agenda futura.
                $query->where(function (Builder $agendadas) {
                    $agendadas->whereHas('agendamentoAtivo')
                        ->orWhereDoesntHave('agendamentos');
                });
            }
        }

        if ($categoria = $filtros['categoria'] ?? null) {
            $query->where('categoria', $categoria);
        }
        if ($prioridade = $filtros['prioridade'] ?? null) {
            $query->where('prioridade', $prioridade);
        }
        if ($termo = trim($filtros['q'] ?? '')) {
            $termo = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $termo);
            $like = "%{$termo}%";
            $query->where(function (Builder $busca) use ($like) {
                $busca->whereRaw("protocolo ILIKE ? ESCAPE '!'", [$like])
                    ->orWhereRaw("nome_solicitante ILIKE ? ESCAPE '!'", [$like]);
            });
        }

        if ($dataAgendada) {
            [$inicio, $fim] = HorarioAgendamento::limitesUtcDoDia($dataAgendada, config('agendamento.timezone'));
            $query->where(function (Builder $dia) use ($inicio, $fim, $dataAgendada) {
                $dia->where(function (Builder $horario) use ($inicio, $fim) {
                    $horario->where('agendado_para', '>=', $inicio)->where('agendado_para', '<', $fim);
                })->orWhereHas('agendamentoAtivo', fn (Builder $turno) => $turno->where('modalidade', 'TURNO')->where('data_agendada', $dataAgendada));
            });
        }

        $colunaData = match ($contexto) {
            'historico' => 'updated_at',
            'agendadas' => 'agendado_para',
            default => 'created_at',
        };
        $timezone = config('agendamento.timezone');
        $dataDe = $filtros['data_de'] ?? null;
        $dataAte = $filtros['data_ate'] ?? null;
        if ($dataDe || $dataAte) {
            $inicio = $dataDe ? HorarioAgendamento::limitesUtcDoDia($dataDe, $timezone)[0] : null;
            $fim = $dataAte ? HorarioAgendamento::limitesUtcDoDia($dataAte, $timezone)[1] : null;
            $query->where(function (Builder $range) use ($contexto, $colunaData, $inicio, $fim, $dataDe, $dataAte) {
                $range->where(function (Builder $instante) use ($colunaData, $inicio, $fim) {
                    if ($inicio) {
                        $instante->where($colunaData, '>=', $inicio);
                    }
                    if ($fim) {
                        $instante->where($colunaData, '<', $fim);
                    }
                });

                if ($contexto === 'agendadas') {
                    $range->orWhereHas('agendamentoAtivo', function (Builder $turno) use ($dataDe, $dataAte) {
                        $turno->where('modalidade', 'TURNO')
                            ->when($dataDe, fn (Builder $query) => $query->where('data_agendada', '>=', $dataDe))
                            ->when($dataAte, fn (Builder $query) => $query->where('data_agendada', '<=', $dataAte));
                    });
                }
            });
        }

        $this->ordenar($query, $filtros, $contexto, $colunaData, $dataAgendada !== null);

        return $query->paginate((int) ($filtros['per_page'] ?? 15));
    }

    private function ordenar(Builder $query, array $filtros, string $contexto, string $colunaData, bool $diaExato): void
    {
        $ordenarPor = $filtros['ordenar_por'] ?? null;
        $direcao = $filtros['direcao'] ?? 'asc';
        if ($ordenarPor === 'data' || $ordenarPor === 'horario') {
            if ($contexto === 'agendadas') {
                $this->ordenarPorDataAgenda($query, $direcao);
                if ($ordenarPor === 'horario') {
                    $query->orderByRaw("CASE WHEN (SELECT modalidade FROM agendamentos WHERE agendamentos.solicitacao_id = solicitacoes.id AND agendamentos.status = 'AGENDADO' LIMIT 1) = 'TURNO' THEN 1 ELSE 0 END ASC")
                        ->orderBy('agendado_para', $direcao);
                    $this->ordenarTurno($query);
                }
            } else {
                $query->orderBy($colunaData, $direcao);
            }
            $query->orderByRaw("CASE prioridade WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 END ASC")
                ->orderBy('protocolo')->orderBy('id');

            return;
        }

        if ($ordenarPor === 'prioridade') {
            if ($contexto === 'fila') {
                $query->orderByRaw("CASE WHEN status IN ('CONCLUIDA', 'CANCELADA') THEN 1 ELSE 0 END ASC");
            }
            $query->orderByRaw("CASE prioridade WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 END ASC");
            if ($contexto === 'agendadas') {
                $this->ordenarPorDataAgenda($query);
                $query->orderByRaw("CASE WHEN (SELECT modalidade FROM agendamentos WHERE agendamentos.solicitacao_id = solicitacoes.id AND agendamentos.status = 'AGENDADO' LIMIT 1) = 'TURNO' THEN 1 ELSE 0 END ASC")
                    ->orderBy('agendado_para');
                $this->ordenarTurno($query);
            } else {
                $query->orderBy($colunaData, $contexto === 'historico' ? 'desc' : 'asc');
            }
            $query->orderBy('protocolo')->orderBy('id');

            return;
        }

        if ($contexto === 'historico') {
            $query->orderByDesc('updated_at')->orderByDesc('id');
        } elseif ($contexto === 'agendadas' || $diaExato) {
            $this->ordenarPorDataAgenda($query);
            $query->orderByRaw("CASE WHEN (SELECT modalidade FROM agendamentos WHERE agendamentos.solicitacao_id = solicitacoes.id AND agendamentos.status = 'AGENDADO' LIMIT 1) = 'TURNO' THEN 1 ELSE 0 END ASC");
            $query->orderBy('agendado_para');
            $this->ordenarTurno($query);
            $query->orderByRaw("CASE prioridade WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 END ASC")
                ->orderBy('protocolo')->orderBy('id');
        } else {
            $query->orderByRaw("CASE WHEN status IN ('CONCLUIDA', 'CANCELADA') THEN 1 ELSE 0 END ASC")
                ->orderByRaw("CASE prioridade WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 END ASC")
                ->orderBy('created_at')->orderBy('id');
        }
    }

    private function ordenarTurno(Builder $query): void
    {
        $query->orderByRaw(
            "(SELECT CASE turno WHEN 'MANHA' THEN 1 WHEN 'TARDE' THEN 2 WHEN 'NOITE' THEN 3 ELSE 4 END ".
            "FROM agendamentos WHERE agendamentos.solicitacao_id = solicitacoes.id AND agendamentos.status = 'AGENDADO' LIMIT 1)"
        );
    }

    private function ordenarPorDataAgenda(Builder $query, string $direcao = 'asc'): void
    {
        $query->orderByRaw(
            "COALESCE((SELECT data_agendada FROM agendamentos WHERE agendamentos.solicitacao_id = solicitacoes.id AND agendamentos.status = 'AGENDADO' LIMIT 1), DATE(agendado_para AT TIME ZONE ?)) {$direcao}",
            [config('agendamento.timezone')]
        );
    }
}
