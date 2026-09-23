<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Agendamento;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class ListarFaltas
{
    public function execute(array $filtros): LengthAwarePaginator
    {
        $query = Agendamento::query()
            ->where('status', 'FALTA')
            ->with(['solicitacao.paciente', 'solicitacao.agendamentoAtivo', 'ultimaTentativaContato']);

        if ($data = $filtros['data'] ?? null) {
            $query->whereDate('data_agendada', $data);
        }
        $dataDe = $filtros['data_de'] ?? null;
        $dataAte = $filtros['data_ate'] ?? null;
        if ($dataDe || $dataAte) {
            $query->when($dataDe, fn (Builder $q) => $q->whereDate('data_agendada', '>=', $dataDe))
                ->when($dataAte, fn (Builder $q) => $q->whereDate('data_agendada', '<=', $dataAte));
        }
        if ($prioridade = $filtros['prioridade'] ?? null) {
            $query->whereHas('solicitacao', fn (Builder $solicitacao) => $solicitacao->where('prioridade', $prioridade));
        }
        if ($resultado = $filtros['resultado_contato'] ?? null) {
            $query->whereHas('ultimaTentativaContato', fn (Builder $tentativa) => $tentativa->where('resultado', $resultado));
        }
        if ($termo = trim($filtros['q'] ?? '')) {
            $termo = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $termo);
            $like = "%{$termo}%";
            $query->whereHas('solicitacao', fn (Builder $solicitacao) => $solicitacao
                ->whereRaw("protocolo ILIKE ? ESCAPE '!'", [$like])
                ->orWhereRaw("nome_solicitante ILIKE ? ESCAPE '!'", [$like]));
        }

        $this->ordenar($query, $filtros);

        return $query->paginate((int) ($filtros['per_page'] ?? 15));
    }

    private function ordenar(Builder $query, array $filtros): void
    {
        $ordenarPor = $filtros['ordenar_por'] ?? 'prioridade';
        $direcao = $filtros['direcao'] ?? 'asc';

        if ($ordenarPor === 'data') {
            $query->orderBy('data_agendada', $direcao)
                ->orderBy('hora_agendada', $direcao)
                ->orderBy('falta_registrada_em', $direcao);
        } elseif ($ordenarPor === 'horario') {
            $query->orderBy('data_agendada', $direcao)
                ->orderByRaw('CASE WHEN hora_agendada IS NULL THEN 1 ELSE 0 END '.$direcao)
                ->orderBy('hora_agendada', $direcao)
                ->orderByRaw("CASE turno WHEN 'MANHA' THEN 1 WHEN 'TARDE' THEN 2 WHEN 'NOITE' THEN 3 ELSE 4 END ".$direcao);
        } else {
            $query->orderByRaw("(SELECT CASE prioridade WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 END FROM solicitacoes WHERE solicitacoes.id = agendamentos.solicitacao_id) ASC")
                ->orderBy('agendamentos.data_agendada')
                ->orderByRaw('CASE WHEN agendamentos.hora_agendada IS NULL THEN 1 ELSE 0 END')
                ->orderBy('agendamentos.hora_agendada')
                ->orderBy('agendamentos.falta_registrada_em');
        }

        $query->orderBy('agendamentos.id');
    }
}
