<?php

namespace App\Domain\Solicitacoes\Http\Controllers;

use App\Domain\Solicitacoes\Actions\ApagarSolicitacao;
use App\Domain\Solicitacoes\Actions\AtualizarSolicitacao;
use App\Domain\Solicitacoes\Actions\AtualizarStatusSolicitacao;
use App\Domain\Solicitacoes\Actions\CriarSolicitacao;
use App\Domain\Solicitacoes\Actions\ListarFaltas;
use App\Domain\Solicitacoes\Actions\ListarSolicitacoes;
use App\Domain\Solicitacoes\Actions\ObterResumoSolicitacoes;
use App\Domain\Solicitacoes\Actions\ReagendarAposFalta;
use App\Domain\Solicitacoes\Actions\ReagendarSolicitacao;
use App\Domain\Solicitacoes\Actions\RegistrarFaltaAgendamento;
use App\Domain\Solicitacoes\Actions\RegistrarTentativaContato;
use App\Domain\Solicitacoes\Http\Requests\AtualizarSolicitacaoRequest;
use App\Domain\Solicitacoes\Http\Requests\AtualizarStatusRequest;
use App\Domain\Solicitacoes\Http\Requests\CriarSolicitacaoRequest;
use App\Domain\Solicitacoes\Http\Requests\ListarFaltasRequest;
use App\Domain\Solicitacoes\Http\Requests\ListarFilaRequest;
use App\Domain\Solicitacoes\Http\Requests\ListarSolicitacoesRequest;
use App\Domain\Solicitacoes\Http\Requests\ReagendarAposFaltaRequest;
use App\Domain\Solicitacoes\Http\Requests\ReagendarSolicitacaoRequest;
use App\Domain\Solicitacoes\Http\Requests\RegistrarTentativaContatoRequest;
use App\Domain\Solicitacoes\Http\Requests\ResumoSolicitacoesRequest;
use App\Domain\Solicitacoes\Http\Resources\AgendamentoResource;
use App\Domain\Solicitacoes\Http\Resources\EntradaFilaResource;
use App\Domain\Solicitacoes\Http\Resources\SolicitacaoResource;
use App\Domain\Solicitacoes\Http\Resources\TentativaContatoResource;
use App\Models\Agendamento;
use App\Models\EntradaFila;
use App\Models\Solicitacao;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class SolicitacaoController
{
    public function __construct(
        private readonly CriarSolicitacao $criarSolicitacao,
        private readonly AtualizarSolicitacao $atualizarSolicitacao,
        private readonly AtualizarStatusSolicitacao $atualizarStatus,
        private readonly ApagarSolicitacao $apagarSolicitacao,
        private readonly ReagendarSolicitacao $reagendarSolicitacao,
        private readonly ObterResumoSolicitacoes $obterResumo,
        private readonly RegistrarFaltaAgendamento $registrarFaltaAgendamento,
        private readonly RegistrarTentativaContato $registrarTentativaContato,
        private readonly ReagendarAposFalta $reagendarAposFalta,
        private readonly ListarSolicitacoes $listarSolicitacoes,
        private readonly ListarFaltas $listarFaltas,
    ) {}

    public function store(CriarSolicitacaoRequest $request): JsonResponse
    {
        Gate::authorize('create', Solicitacao::class);
        $solicitacao = $this->criarSolicitacao->execute($request->validated());

        return (new SolicitacaoResource($solicitacao))
            ->response()
            ->setStatusCode(201);
    }

    public function index(ListarSolicitacoesRequest $request): ResourceCollection
    {
        Gate::authorize('viewAny', Solicitacao::class);
        $paginated = $this->listarSolicitacoes->execute($request->validated());

        return SolicitacaoResource::collection($paginated);
    }

    public function resumo(ResumoSolicitacoesRequest $request): JsonResponse
    {
        Gate::authorize('viewAny', Solicitacao::class);
        $resumo = $this->obterResumo->execute(
            $request->validated('categoria'),
            $request->validated('prioridade'),
        );

        return response()->json(['data' => $resumo]);
    }

    public function fila(ListarFilaRequest $request): ResourceCollection
    {
        Gate::authorize('viewAny', Solicitacao::class);
        $query = EntradaFila::query()
            ->whereNull('encerrada_em')
            ->with(['solicitacao.paciente'])
            ->join('solicitacoes', 'solicitacoes.id', '=', 'entradas_fila.solicitacao_id')
            ->when($request->validated('prioridade'), fn ($q, $p) => $q->where('solicitacoes.prioridade', $p))
            ->when($request->validated('categoria'), fn ($q, $c) => $q->where('solicitacoes.categoria', $c))
            ->orderByRaw("CASE solicitacoes.prioridade WHEN 'URGENTE' THEN 4 WHEN 'ALTA' THEN 3 WHEN 'MEDIA' THEN 2 ELSE 1 END DESC")
            ->orderBy('entradas_fila.entrou_em')
            ->orderBy('entradas_fila.id')
            ->select('entradas_fila.*');

        $perPage = (int) ($request->validated('per_page') ?? 15);

        return EntradaFilaResource::collection($query->paginate($perPage));
    }

    public function show(int $id): JsonResponse
    {
        $solicitacao = Solicitacao::with(['paciente', 'agendamentoAtivo'])->findOrFail($id);
        Gate::authorize('view', $solicitacao);

        return (new SolicitacaoResource($solicitacao))->response();
    }

    public function update(AtualizarSolicitacaoRequest $request, int $id): JsonResponse
    {
        $solicitacao = Solicitacao::findOrFail($id);
        Gate::authorize('update', $solicitacao);
        $atualizada = $this->atualizarSolicitacao->execute($solicitacao, $request->validated());

        return (new SolicitacaoResource($atualizada))->response();
    }

    public function updateStatus(AtualizarStatusRequest $request, int $id): JsonResponse
    {
        $solicitacao = Solicitacao::findOrFail($id);
        Gate::authorize('update', $solicitacao);
        $atualizada = $this->atualizarStatus->execute(
            $solicitacao,
            $request->validated('status'),
            $request->dadosAgendamento(),
        );
        $atualizada->load(['paciente', 'agendamentoAtivo']);

        return (new SolicitacaoResource($atualizada))->response();
    }

    public function updateAgendamento(ReagendarSolicitacaoRequest $request, int $id): JsonResponse
    {
        $solicitacao = Solicitacao::findOrFail($id);
        Gate::authorize('update', $solicitacao);
        $atualizada = $this->reagendarSolicitacao->execute($solicitacao, $request->dadosAgendamento());
        $atualizada->load(['paciente', 'agendamentoAtivo']);

        return (new SolicitacaoResource($atualizada))->response();
    }

    public function destroy(int $id): Response
    {
        $solicitacao = Solicitacao::findOrFail($id);
        Gate::authorize('delete', $solicitacao);
        $this->apagarSolicitacao->execute($solicitacao);

        return response()->noContent();
    }

    public function faltas(ListarFaltasRequest $request): ResourceCollection
    {
        Gate::authorize('viewAny', Solicitacao::class);

        return AgendamentoResource::collection($this->listarFaltas->execute($request->validated()));
    }

    public function registrarFalta(int $id): JsonResponse
    {
        $agendamento = Agendamento::findOrFail($id);
        Gate::authorize('update', $agendamento->solicitacao);
        $atualizado = $this->registrarFaltaAgendamento->execute($agendamento);

        return (new AgendamentoResource($atualizado))->response();
    }

    public function registrarTentativaContato(RegistrarTentativaContatoRequest $request, int $id): JsonResponse
    {
        $agendamento = Agendamento::findOrFail($id);
        Gate::authorize('update', $agendamento->solicitacao);
        $tentativa = $this->registrarTentativaContato->execute($agendamento, $request->validated('resultado'));

        return (new TentativaContatoResource($tentativa))->response()->setStatusCode(201);
    }

    public function reagendarAposFalta(ReagendarAposFaltaRequest $request, int $id): JsonResponse
    {
        $agendamento = Agendamento::findOrFail($id);
        Gate::authorize('update', $agendamento->solicitacao);
        $novoAgendamento = $this->reagendarAposFalta->execute($agendamento, $request->dadosAgendamento());
        $novoAgendamento->load('solicitacao.paciente');

        return (new AgendamentoResource($novoAgendamento))->response()->setStatusCode(201);
    }
}
