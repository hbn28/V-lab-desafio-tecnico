# Plano técnico — Solicitações de Atendimento

Este plano operacionaliza o edital sem transformar bônus em bloqueadores da nota-base. O contrato executável está em `docs/spec.md`.

## 1. Prioridade de entrega

Primeiro fechar criar -> listar/consultar -> filtrar -> atualizar status. Depois testes, documentação e segurança. Só então implementar bônus.

## 2. Modelo de dados

Usar `solicitacoes` e `protocolo_counters` conforme a spec. Constraints cobrem enums, unicidade, campos obrigatórios e justificativa urgente.

## 3. Backend

Organização por domínio. Controllers finos, Form Requests para entradas, Actions para regras/transações e Resource para serialização. Laravel 11 configura erros em `bootstrap/app.php`.

## 4. API REST

Implementar os quatro endpoints do edital e exatamente os envelopes da spec. O PATCH recebe somente `status`. OpenAPI acompanha a implementação.

## 5. Frontend

Implementar resumo inicial por status ou prioridade, listagem paginada, filtros, formulário, detalhe e mudança de status. Os quatro estados assíncronos são obrigatórios. Um conjunto pequeno de tokens semânticos basta.

## 6. PostgreSQL

Todo schema nasce por migrations. Testes de CHECK, locking e concorrência usam PostgreSQL, não SQLite.

## 7. Regras de negócio

`CriarSolicitacao` controla status inicial e protocolo. `AtualizarStatusSolicitacao` controla toda a máquina de estados sob lock. O frontend não é fonte de verdade.

## 8. Protocolo

Garantir a linha anual com upsert antes do `lockForUpdate`. Solicitação e contador pertencem à mesma transação.

## 9. Validação e erros

422 representa entrada inválida; 409 representa conflito de estado. Padronizar todos os erros JSON, inclusive 404, 405, 429 e 500.

## 10. Docker Compose

Três serviços: frontend, backend HTTP e PostgreSQL. Healthcheck no banco, ambiente sem segredos e chave Laravel estável fora da imagem. Não prometer um comando único enquanto a preparação não estiver automatizada e testada.

## 11. Testes

Pest cobre regras, constraints e concorrência no PostgreSQL. Vitest + Testing Library cobre comportamento relevante com HTTP mockado.

## 12. OpenAPI e README

OpenAPI descreve endpoints, filtros, bodies, sucessos e códigos principais. README contém versões, execução, migrations/seeders, testes, decisões, limitações e uso de IA.

## 13. Segurança e privacidade

Somente dados fictícios; sem segredos versionados; CORS restrito; entrada validada; erros seguros.

## 14. Autenticação

Autenticação e autorização são bônus no edital. Não fazem parte da arquitetura inicial nem podem atrasar o fluxo principal. Se implementadas depois, devem receber contrato e testes antes do código.

## 15. CI e qualidade

Após as suítes locais estarem estáveis, adicionar CI com PostgreSQL, lint, testes e build. CI é bônus e não antecede o fluxo integrado.

## 16. Processo entre agentes

`AGENTS.md`, `TASKS.md` e `HANDOFF.md` são o estado compartilhado. Um agente executa uma tarefa por vez, verifica o resultado e registra bloqueios. Não automatizar revezamento antes de duas rodadas supervisionadas bem-sucedidas.

## 17. Decisões fechadas antes do código

- quatro endpoints no núcleo;
- autenticação adiada para bônus;
- protocolo na Action com upsert + lock;
- todo erro JSON usa `{ message, errors }`;
- toda transição inválida, inclusive mesmo status, retorna 409;
- filtros e paginação inválidos retornam 422;
- PostgreSQL nos testes relevantes;
- exceções do Laravel 11 em `bootstrap/app.php`;
- backend Docker com servidor HTTP explícito;
- sem DTO ou histórico de status;
- seeders automáticos idempotentes.

## Ordem de execução

1. arquitetura inicial e migrations;
2. regras e API;
3. frontend completo, incluindo resumo;
4. integração ponta a ponta;
5. testes;
6. segurança, OpenAPI e README;
7. bônus: seeders, health check, CI e, por último, autenticação.
