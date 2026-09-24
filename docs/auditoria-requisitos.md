# Auditoria dos requisitos do desafio — 24/09/2026

## Escopo e limite da evidência

Esta revisão compara o código da branch `master` com os critérios do desafio transcritos pelo candidato. O PDF oficial do edital não está neste repositório; portanto, citações e pontuação devem ser confirmadas com o edital antes da entrega definitiva. A auditoria é da versão do repositório, não uma prova de que o deploy no Railway executa exatamente o mesmo commit.

**Veredito provisório:** não foi encontrado desvio eliminatório comprovado no fluxo obrigatório. A máquina de estados HTTP corresponde às cinco etapas exigidas. Há riscos relevantes nas extensões de exclusão definitiva, no acesso público de demonstração a dados completos e na credencial fixa do Compose local. A execução atual da suíte backend ficou inconclusiva por falha da rede Docker local, descrita abaixo.

## Checklist do fluxo obrigatório

| Requisito | Estado | Evidência |
| --- | --- | --- |
| React 18, TypeScript, PHP 8.3, Laravel 11, PostgreSQL 16 e Compose | Conforme no código | `frontend/package.json`, `backend/composer.json`, `docker-compose.yml` |
| Frontend consome API Laravel, com persistência PostgreSQL | Conforme no código; integração atual não revalidada | `frontend/src/features/solicitacoes/api/client.ts`, `backend/routes/api.php`, migrations Laravel |
| Criação, listagem/consulta, filtros, detalhe e atualização de status | Conforme no código | `backend/routes/api.php`, `SolicitacaoController.php`, `frontend/src/features/solicitacoes/` |
| Protocolo único gerado pela aplicação | Conforme no código | `CriarSolicitacao.php`: inserção anual com `ON CONFLICT DO NOTHING`, lock e incremento; índice UNIQUE na migration inicial |
| URGENTE exige justificativa | Conforme no código | `CriarSolicitacaoRequest.php` e `AtualizarSolicitacaoRequest.php`; CHECK `chk_justificativa_urgente` na migration inicial |
| Estados iniciais e transições permitidas | Conforme para operações HTTP | `CriarSolicitacao.php` força `RECEBIDA`; `AtualizarStatusSolicitacao.php` centraliza a tabela de transições, transação e `lockForUpdate` |
| Estados finais bloqueiam novas transições | Conforme para `PATCH /status` | `TRANSICOES['CONCLUIDA']` e `TRANSICOES['CANCELADA']` são listas vazias; edição cadastral também retorna 409 |
| Respostas de erro coerentes | Conforme no código | `backend/bootstrap/app.php` padroniza `{message, errors}` para 401/403/404/405/409/419/422/429/500 |
| Migrations, filtros, índices e constraints | Conforme no código, com ressalva da agenda | `backend/database/migrations/`; CHECKs dos enums e da justificativa, índices dos três filtros; vínculo entre estado e agendamento é garantido pela Action, não por CHECK entre tabelas |
| Docker e instruções de execução | Conforme no código; inicialização atual não revalidada | `docker-compose.yml`, `backend/docker/entrypoint.sh`, `README.md` |
| Testes relevantes e dados fictícios | Cobertura presente; execução backend atual pendente | `backend/tests/Feature/`, `frontend/src/test/`, seeders; ver verificações abaixo |
| OpenAPI e uso de IA declarados | Conforme em leitura | `docs/openapi.yaml` lista as rotas de `backend/routes/api.php`; `README.md` declara Claude e Codex |

### Máquina de estados

```text
RECEBIDA   -> EM_ANALISE | CANCELADA
EM_ANALISE -> AGENDADA   | CANCELADA
AGENDADA   -> CONCLUIDA  | CANCELADA
CONCLUIDA  -> nenhum
CANCELADA  -> nenhum
```

`FALTA` pertence a `agendamentos.status`, não a `solicitacoes.status`. Reagendar altera a data/modalidade, mantendo `AGENDADA`; registrar falta e reagendar após falta não criam transições ocultas. As migrations e seeders podem gravar estados diretamente para migrar e preparar dados fictícios; isso não é uma rota HTTP alternativa de transição. A interface mantém uma tabela de opções permitidas para apresentação, mas a Action do backend é a autoridade.

## Achados que podem custar pontos

1. **Exclusão definitiva, inclusive de estados finais (risco médio/alto de interpretação e privacidade).** `DELETE /api/v1/solicitacoes/{id}` autoriza `ADMINISTRADOR`, mas `ApagarSolicitacao.php` remove o registro em qualquer estado, junto com histórico dependente. A operação não é uma transição de status, portanto não viola literalmente a tabela de transições; porém pode ser entendida como quebra da finalidade dos estados finais e da rastreabilidade. Está documentada como extensão em `docs/spec.md` e OpenAPI. Antes da avaliação, considerar limitar a exclusão a registros de demonstração/erro ou substituí-la por cancelamento e retenção histórica, conforme a interpretação do edital.
2. **Cadastro público e dados detalhados (risco médio para privacidade).** `POST /auth/cadastro` cria `ATENDENTE` ativo quando `CADASTRO_PUBLICO=true`; `SolicitacaoPolicy::view` permite a qualquer operador ativo abrir o detalhe, que inclui CPF completo e data de nascimento. A demonstração deve usar apenas dados fictícios. Para um ambiente com dados reais, desabilitar cadastro público e restringir a leitura por necessidade operacional. Não tratar a demonstração atual como adequada para dados reais.
3. **Credencial local fixa (risco médio de apresentação).** `docker-compose.yml` e `backend/.env.example` contêm a senha ilustrativa `secret` para PostgreSQL. Isso facilita a reprodução local, mas o critério fornecido diz “sem senhas, tokens ou credenciais versionados” e pode ser interpretado literalmente. Nenhuma `APP_KEY` nem `.env` real está versionada; a senha fixa precisa permanecer estritamente local e não ser reutilizada em deploy. O README agora explicita essa distinção.
4. **Laravel 11 com advisories conhecidos (risco de segurança/nota técnica).** A versão major é a exigida pelas instruções internas do projeto. `docs/security-dependencies.md` registra os advisories do framework e que `composer audit` não fica limpo nesta major. O resultado do audit não foi reexecutado nesta revisão. Não elevar a major sem reconciliar o requisito do desafio.
5. **Invariante de agenda só na aplicação (risco baixo/médio).** A migration `2026_09_22_000006` removeu os CHECKs antigos de `agendado_para` para suportar turno. O PostgreSQL não impede isoladamente uma linha `AGENDADA` sem registro em `agendamentos`; a Action cria o registro na mesma transação e o índice parcial impede dois agendamentos ativos. Foi detectada e corrigida nesta revisão a descrição antiga e contraditória em `docs/spec.md`.
6. **Validação de CPF limitada ao formato (risco baixo).** O projeto aceita máscara válida sem verificar dígitos verificadores. Está declarado no README; o edital transcrito não exige CPF, pois é campo adicional.

## Documentação e funcionalidades conferidas

O README agora apresenta o acesso publicado, cadastro de atendente, fluxo obrigatório, busca/filtros/ordenação, cartões de prioridades abertas, fila, agenda semanal, histórico, faltas, notificações por worker, modo escuro, instalação, testes, OpenAPI, IA e limites conhecidos. `docs/spec.md` foi alinhado com a modalidade por turno: `agendado_para` pode ser nulo em `AGENDADA`, `hora_agendada` e `turno` são alternativas exclusivas e os CHECKs antigos foram removidos. As rotas de `backend/routes/api.php` aparecem no OpenAPI em inspeção textual. Esta inspeção não substitui um validador OpenAPI nem chamadas HTTP de todos os exemplos.

## Verificações desta revisão

- Frontend: 67 testes Vitest em 13 arquivos aprovados; ESLint e build (`tsc -b` + Vite) aprovados.
- Backend: Pint aprovado em 117 arquivos. A suíte Pest completa foi interrompida após falhas repetidas; um teste isolado (`HealthTest`, 2 casos) falhou antes das assertions com `SQLSTATE[08006]`: o container backend não resolveu o host `db` da conexão `pgsql_test`. `docker inspect` mostrou `NetworkSettings.Networks={}` tanto no backend quanto no banco do Compose local. Isso é falha do ambiente Docker nesta execução, não evidência de defeito na regra de negócio. A suíte completa deve ser repetida com os serviços conectados à rede Compose, sempre em `vlab_test`.
- Nenhum teste de criação/modificação foi feito no banco de desenvolvimento `vlab`; não houve `migrate:fresh`, `db:seed` ou limpeza de volumes.
- O README registra uma checagem anterior, em 24/09/2026, de `/`, `/api/v1/health` e `GET /api/v1/auth/cadastro` no deploy. Nesta revisão não houve nova verificação ponta a ponta do deploy ou de `composer audit`.

## Estimativa de avaliação

Pelos critérios fornecidos, a implementação aparenta superar os mínimos de 60/100 na base e 6/15 em Backend e Frontend. Uma faixa **provisória** é 87–94/100 na base e 12–16/20 em bônus. A banca pode reduzir essa faixa se penalizar extensões que apagam histórico, exigir ausência literal de qualquer senha no repositório ou encontrar falha na execução ponta a ponta. Uma nota fechada exigiria o edital oficial e a suíte backend/integração executadas novamente em ambiente saudável.
