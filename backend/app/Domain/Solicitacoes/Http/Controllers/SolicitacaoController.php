<?php

namespace App\Domain\Solicitacoes\Http\Controllers;

use App\Domain\Solicitacoes\Actions\AtualizarStatusSolicitacao;
use App\Domain\Solicitacoes\Actions\CriarSolicitacao;
use App\Domain\Solicitacoes\Http\Requests\AtualizarStatusRequest;
use App\Domain\Solicitacoes\Http\Requests\CriarSolicitacaoRequest;
use App\Domain\Solicitacoes\Http\Requests\ListarSolicitacoesRequest;
use App\Domain\Solicitacoes\Http\Resources\SolicitacaoResource;
use App\Models\Solicitacao;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\ResourceCollection;

class SolicitacaoController
{
    public function __construct(
        private readonly CriarSolicitacao $criarSolicitacao,
        private readonly AtualizarStatusSolicitacao $atualizarStatus,
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
        $query = Solicitacao::query()
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($status = $request->validated('status')) {
            $query->where('status', $status);
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

    public function show(int $id): JsonResponse
    {
        $solicitacao = Solicitacao::findOrFail($id);

        return (new SolicitacaoResource($solicitacao))->response();
    }

    public function updateStatus(AtualizarStatusRequest $request, int $id): JsonResponse
    {
        $solicitacao = Solicitacao::findOrFail($id);
        $atualizada  = $this->atualizarStatus->execute($solicitacao, $request->validated('status'));

        return (new SolicitacaoResource($atualizada))->response();
    }
}
