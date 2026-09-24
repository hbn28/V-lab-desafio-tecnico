<?php

namespace App\Domain\Solicitacoes\Http\Controllers;

use App\Domain\Solicitacoes\Actions\ApagarSolicitacao;
use App\Domain\Solicitacoes\Actions\AtualizarSolicitacao;
use App\Domain\Solicitacoes\Actions\AtualizarStatusSolicitacao;
use App\Domain\Solicitacoes\Actions\CriarSolicitacao;
use App\Domain\Solicitacoes\Actions\ListarFaltasPendentes;
use App\Domain\Solicitacoes\Actions\ListarFilaOperacional;
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
use App\Models\Solicitacao;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Http\Response;

/**
 * Só orquestra: FormRequest valida, Action executa a regra ou a consulta,
 * Resource serializa. Nenhuma regra de negócio ou consulta vive aqui.
 */
class SolicitacaoController
{
    private const RELACOES_DETALHE = ['paciente', 'agendamentoAtivo'];

    public function store(CriarSolicitacaoRequest $request, CriarSolicitacao $criar): JsonResponse
    {
        $solicitacao = $criar->execute($request->validated());

        return SolicitacaoResource::detalhe($solicitacao)->response()->setStatusCode(201);
    }

    public function index(ListarSolicitacoesRequest $request, ListarSolicitacoes $listar): ResourceCollection
    {
        return SolicitacaoResource::collection($listar->execute($request->validated()));
    }

    public function resumo(ResumoSolicitacoesRequest $request, ObterResumoSolicitacoes $obterResumo): JsonResponse
    {
        return response()->json([
            'data' => $obterResumo->execute($request->validated('categoria'), $request->validated('prioridade')),
        ]);
    }

    public function fila(ListarFilaRequest $request, ListarFilaOperacional $listar): ResourceCollection
    {
        return EntradaFilaResource::collection($listar->execute($request->validated()));
    }

    public function show(int $id): JsonResponse
    {
        $solicitacao = Solicitacao::with(self::RELACOES_DETALHE)->findOrFail($id);

        return SolicitacaoResource::detalhe($solicitacao)->response();
    }

    public function update(AtualizarSolicitacaoRequest $request, int $id, AtualizarSolicitacao $atualizar): JsonResponse
    {
        $atualizada = $atualizar->execute(Solicitacao::findOrFail($id), $request->validated());

        return SolicitacaoResource::detalhe($atualizada->load(self::RELACOES_DETALHE))->response();
    }

    public function updateStatus(AtualizarStatusRequest $request, int $id, AtualizarStatusSolicitacao $atualizarStatus): JsonResponse
    {
        $atualizada = $atualizarStatus->execute(
            Solicitacao::findOrFail($id),
            $request->validated('status'),
            $request->dadosAgendamento(),
        );

        return SolicitacaoResource::detalhe($atualizada->load(self::RELACOES_DETALHE))->response();
    }

    public function updateAgendamento(ReagendarSolicitacaoRequest $request, int $id, ReagendarSolicitacao $reagendar): JsonResponse
    {
        $atualizada = $reagendar->execute(Solicitacao::findOrFail($id), $request->dadosAgendamento());

        return SolicitacaoResource::detalhe($atualizada->load(self::RELACOES_DETALHE))->response();
    }

    public function destroy(int $id, ApagarSolicitacao $apagar): Response
    {
        $apagar->execute(Solicitacao::findOrFail($id));

        return response()->noContent();
    }

    public function faltas(ListarFaltasRequest $request, ListarFaltasPendentes $listar): ResourceCollection
    {
        return AgendamentoResource::collection($listar->execute($request->validated()));
    }

    public function registrarFalta(int $id, RegistrarFaltaAgendamento $registrarFalta): JsonResponse
    {
        $atualizado = $registrarFalta->execute(Agendamento::findOrFail($id));

        return (new AgendamentoResource($atualizado))->response();
    }

    public function registrarTentativaContato(RegistrarTentativaContatoRequest $request, int $id, RegistrarTentativaContato $registrarTentativa): JsonResponse
    {
        $tentativa = $registrarTentativa->execute(Agendamento::findOrFail($id), $request->validated('resultado'));

        return (new TentativaContatoResource($tentativa))->response()->setStatusCode(201);
    }

    public function reagendarAposFalta(ReagendarAposFaltaRequest $request, int $id, ReagendarAposFalta $reagendar): JsonResponse
    {
        $novoAgendamento = $reagendar->execute(Agendamento::findOrFail($id), $request->dadosAgendamento());

        return (new AgendamentoResource($novoAgendamento->load('solicitacao.paciente')))->response()->setStatusCode(201);
    }
}
