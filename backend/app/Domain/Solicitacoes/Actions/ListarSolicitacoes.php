<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Domain\Solicitacoes\Support\HorarioAgendamento;
use App\Models\Solicitacao;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * Listagem paginada de solicitações. A ordenação é server-side e depende do
 * recorte pedido, para continuar estável com paginação:
 *
 *  - agenda de um dia (data_agendada): horário marcado, depois turno;
 *  - histórico (status_grupo=encerrado): evento mais recente primeiro;
 *  - status AGENDADA: horário já combinado (ADR 003);
 *  - fila padrão: abertas antes das encerradas, maior prioridade, mais antiga (ADR 001).
 */
class ListarSolicitacoes
{
    private const ORDEM_PRIORIDADE = "CASE prioridade WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 END ASC";

    /**
     * @param  array{status?: ?string, status_grupo?: ?string, categoria?: ?string, prioridade?: ?string, data_agendada?: ?string, per_page?: ?int}  $filtros
     */
    public function execute(array $filtros): LengthAwarePaginator
    {
        $statusGrupo = $filtros['status_grupo'] ?? null;
        $dataAgendada = $filtros['data_agendada'] ?? null;
        // Com data_agendada o status já está restrito a AGENDADA (a Request rejeita combinações incompatíveis).
        $status = $dataAgendada ? 'AGENDADA' : ($filtros['status'] ?? null);

        $query = Solicitacao::query()->with(['paciente', 'agendamentoAtivo']);

        if ($dataAgendada) {
            $this->agendaDoDia($query, $dataAgendada);
        } elseif ($statusGrupo === 'encerrado') {
            // Histórico não é fila operacional: o evento mais recente vem primeiro.
            $query->whereIn('status', ['CONCLUIDA', 'CANCELADA'])
                ->orderByDesc('updated_at')
                ->orderByDesc('id');
        } elseif ($status === 'AGENDADA') {
            // Já tem hora marcada: quem decide a ordem deixa de ser a prioridade
            // administrativa e passa a ser o horário já combinado (ADR 003).
            $query->orderBy('agendado_para')
                ->orderByRaw(self::ORDEM_PRIORIDADE)
                ->orderBy('protocolo')
                ->orderBy('id');
        } else {
            // A fila operacional é estável e explicável: demandas abertas,
            // maior prioridade e, em empate, maior tempo de espera.
            $query->orderByRaw("CASE WHEN status IN ('CONCLUIDA', 'CANCELADA') THEN 1 ELSE 0 END ASC")
                ->orderByRaw(self::ORDEM_PRIORIDADE)
                ->orderBy('created_at')
                ->orderBy('id');
        }

        if ($status) {
            $query->where('status', $status);
        } elseif (! $dataAgendada && $statusGrupo === 'aberto') {
            // Usado pelo drill-down do painel: "Urgente em aberto" etc.
            // não corresponde a um único status, e sim a RECEBIDA/EM_ANALISE/AGENDADA.
            $query->whereNotIn('status', ['CONCLUIDA', 'CANCELADA']);
        }

        $query->when($filtros['categoria'] ?? null, fn ($q, $categoria) => $q->where('categoria', $categoria))
            ->when($filtros['prioridade'] ?? null, fn ($q, $prioridade) => $q->where('prioridade', $prioridade));

        return $query->paginate((int) ($filtros['per_page'] ?? 15));
    }

    /**
     * Agenda diária: intervalo UTC semiaberto do dia operacional (modalidade HORARIO,
     * via agendado_para) OU o agendamento ativo por turno daquele mesmo dia operacional
     * (modalidade TURNO, que nunca grava agendado_para).
     */
    private function agendaDoDia(Builder $query, string $dataAgendada): void
    {
        [$inicio, $fim] = HorarioAgendamento::limitesUtcDoDia($dataAgendada, config('agendamento.timezone'));

        $query->where(function (Builder $sub) use ($inicio, $fim, $dataAgendada) {
            // Semiaberto [$inicio, $fim): um agendado_para exatamente à meia-noite do
            // dia seguinte não pode vazar para o filtro do dia anterior.
            $sub->where('agendado_para', '>=', $inicio)
                ->where('agendado_para', '<', $fim)
                ->orWhereHas('agendamentoAtivo', function (Builder $ativo) use ($dataAgendada) {
                    $ativo->where('modalidade', 'TURNO')->where('data_agendada', $dataAgendada);
                });
        })
            // HORARIO primeiro, em ordem cronológica; TURNO (sem agendado_para) fica depois,
            // ordenado por MANHA/TARDE/NOITE via subquery no agendamento ativo.
            ->orderBy('agendado_para')
            ->orderByRaw(
                "(SELECT CASE turno WHEN 'MANHA' THEN 1 WHEN 'TARDE' THEN 2 WHEN 'NOITE' THEN 3 ELSE 4 END ".
                'FROM agendamentos WHERE agendamentos.solicitacao_id = solicitacoes.id '.
                "AND agendamentos.status = 'AGENDADO' LIMIT 1)"
            )
            ->orderByRaw(self::ORDEM_PRIORIDADE)
            ->orderBy('protocolo')
            ->orderBy('id');
    }
}
