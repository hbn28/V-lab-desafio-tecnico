# Plano de correções — auditoria V-LAB (master local)

## Escopo

1. Atualizar dependências seguras dentro de PHP 8.3 / Laravel 11; remover supressões globais e reduzir qualquer exceção residual ao estritamente não corrigível sem violar o edital. Registrar limitações de advisories sem correção na série 11.
2. Extrair a consulta da fila para `ListarFilaOperacional` e cobrir ordenação/filtros/paginação.
3. Decompor `SolicitacoesPage` em visões operacionais, preservando comportamento e testes.
4. Omitir data de nascimento das respostas de lista e fila; mantê-la em detalhe, criação e edição; alinhar tipos e OpenAPI.
5. Completar a declaração de uso de IA no README com o apoio real do Codex.
6. Separar o histórico encerrado em uma rota/página leve, mantendo filtros e navegação atuais.
7. Executar verificações pedidas e rodadas Pest aleatórias; registrar evidências e limitações.
8. Atualizar TASKS, HANDOFF, mapa e Graphify; comparar documentação espelhada se `.claude/`/`.codex/` forem alterados.

## Restrições

Preservar `master` local e seus arquivos preexistentes; não fazer reset, push, operações destrutivas no banco, alteração do CI ou atualização para Laravel 12/13. Testes de backend apenas no banco isolado `vlab_test`.

## Ordem

Contrato/API e testes primeiro; Action da fila; componentização/history; documentação/Graphify; verificações; revisão e commits locais sem trailers.
