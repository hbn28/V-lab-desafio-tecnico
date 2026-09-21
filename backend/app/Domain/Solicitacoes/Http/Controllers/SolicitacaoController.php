<?php

namespace App\Domain\Solicitacoes\Http\Controllers;

use App\Domain\Solicitacoes\Actions\ApagarSolicitacao;
use App\Domain\Solicitacoes\Actions\AtualizarSolicitacao;
use App\Domain\Solicitacoes\Actions\AtualizarStatusSolicitacao;
use App\Domain\Solicitacoes\Actions\CriarSolicitacao;
use App\Domain\Solicitacoes\Actions\ObterResumoSolicitacoes;
use App\Domain\Solicitacoes\Actions\ReagendarSolicitacao;
use App\Domain\Solicitacoes\Http\Requests\AtualizarSolicitacaoRequest;
use App\Domain\Solicitacoes\Http\Requests\AtualizarStatusRequest;
use App\Domain\Solicitacoes\Http\Requests\CriarSolicitacaoRequest;
use App\Domain\Solicitacoes\Http\Requests\ListarSolicitacoesRequest;
use App\Domain\Solicitacoes\Http\Requests\ReagendarSolicitacaoRequest;
use App\Domain\Solicitacoes\Http\Requests\ResumoSolicitacoesRequest;
use App\Domain\Solicitacoes\Http\Resources\SolicitacaoResource;
use App\Domain\Solicitacoes\Support\HorarioAgendamento;
use App\Models\Solicitacao;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Http\Response;

class SolicitacaoController
{
    public function __construct(
        private readonly CriarSolicitacao $criarSolicitacao,
        private readonly AtualizarSolicitacao $atualizarSolicitacao,
        private readonly AtualizarStatusSolicitacao $atualizarStatus,
        private readonly ApagarSolicitacao $apagarSolicitacao,
        private readonly ReagendarSolicitacao $reagendarSolicitacao,
        private readonly ObterResumoSolicitacoes $obterResumo,
    ) {}

    public function store(CriarSolicitacaoRequest $request): JsonResponse
    {
        $solicitacao = $this->criarSolicitacao->execute($request->validated());

        return (new SolicitacaoResource($solicitacao))
            ->response()
            ->setStatusCode(201);
    }

    public function index(ListarSolicitacoesRequest $request): ResourceCollection
    {
        $statusGrupo = $request->validated('status_grupo');
        $query = Solicitacao::query();

        if ($dataAgendada = $request->validated('data_agendada')) {
            // Agenda diária: intervalo UTC semiaberto do dia operacional, por horário e, em empate, prioridade.
            [$inicio, $fim] = HorarioAgendamento::limitesUtcDoDia(
                $dataAgendada,
                config('agendamento.timezone'),
            );
            $query->where('status', 'AGENDADA')
                ->where('agendado_para', '>=', $inicio)
                ->where('agendado_para', '<', $fim)
                ->orderBy('agendado_para')
                ->orderByRaw("CASE prioridade WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 END ASC")
                ->orderBy('protocolo')
                ->orderBy('id');
        } elseif ($statusGrupo === 'encerrado') {
            // Histórico não é fila operacional: o evento mais recente vem primeiro.
            $query->whereIn('status', ['CONCLUIDA', 'CANCELADA'])
                ->orderByDesc('updated_at')
                ->orderByDesc('id');
        } else {
            // A fila operacional é estável e explicável: demandas abertas,
            // maior prioridade e, em empate, maior tempo de espera.
            $query->orderByRaw("CASE WHEN status IN ('CONCLUIDA', 'CANCELADA') THEN 1 ELSE 0 END ASC")
                ->orderByRaw("CASE prioridade WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 END ASC")
                ->orderBy('created_at')
                ->orderBy('id');
        }

        // Com data_agendada o status já está restrito a AGENDADA (a Request rejeita combinações incompatíveis).
        $status = $dataAgendada ? null : $request->validated('status');
        if ($status) {
            $query->where('status', $status);
        } elseif (! $dataAgendada && $statusGrupo === 'aberto') {
            // Usado pelo drill-down do painel: "Urgente em aberto" etc.
            // não corresponde a um único status, e sim a RECEBIDA/EM_ANALISE/AGENDADA.
            $query->whereNotIn('status', ['CONCLUIDA', 'CANCELADA']);
        }
        if ($categoria = $request->validated('categoria')) {
            $query->where('categoria', $categoria);
        }
        if ($prioridade = $request->validated('prioridade')) {
            $query->where('prioridade', $prioridade);
        }

        $perPage = (int) ($request->validated('per_page') ?? 15);
        $paginated = $query->paginate($perPage);

        return SolicitacaoResource::collection($paginated);
    }

    public function resumo(ResumoSolicitacoesRequest $request): JsonResponse
    {
        $resumo = $this->obterResumo->execute(
            $request->validated('categoria'),
            $request->validated('prioridade'),
        );

        return response()->json(['data' => $resumo]);
    }

    public function show(int $id): JsonResponse
    {
        $solicitacao = Solicitacao::findOrFail($id);

        return (new SolicitacaoResource($solicitacao))->response();
    }

    public function update(AtualizarSolicitacaoRequest $request, int $id): JsonResponse
    {
        $solicitacao = Solicitacao::findOrFail($id);
        $atualizada  = $this->atualizarSolicitacao->execute($solicitacao, $request->validated());

        return (new SolicitacaoResource($atualizada))->response();
    }

    public function updateStatus(AtualizarStatusRequest $request, int $id): JsonResponse
    {
        $solicitacao = Solicitacao::findOrFail($id);
        $atualizada  = $this->atualizarStatus->execute(
            $solicitacao,
            $request->validated('status'),
            $request->agendadoPara(),
        );

        return (new SolicitacaoResource($atualizada))->response();
    }

    public function updateAgendamento(ReagendarSolicitacaoRequest $request, int $id): JsonResponse
    {
        $solicitacao = Solicitacao::findOrFail($id);
        $atualizada  = $this->reagendarSolicitacao->execute($solicitacao, $request->agendadoPara());

        return (new SolicitacaoResource($atualizada))->response();
    }

    public function destroy(int $id): Response
    {
        $solicitacao = Solicitacao::findOrFail($id);
        $this->apagarSolicitacao->execute($solicitacao);

        return response()->noContent();
    }
}
