# Auditoria dos requisitos do desafio — 24/09/2026

## Escopo e limite da evidência

Esta revisão compara o código da branch `master` com o PDF oficial `Seleção V-LAB - Desafio Técnico Full Stack: Solicitações de Atendimento` (9 páginas), encontrado localmente em `Downloads/DesafioTecnico_FullStack.docx.pdf`. O PDF não foi adicionado ao repositório. A matriz da seção 5 coincide com a transcrição usada inicialmente. A auditoria é da versão do repositório, não uma prova de que o deploy no Railway executa exatamente o mesmo commit.

**Veredito:** não foi encontrado desvio eliminatório comprovado no fluxo obrigatório. A máquina de estados HTTP corresponde às cinco etapas exigidas na página 3. Há riscos relevantes nas extensões de exclusão definitiva, no acesso público de demonstração a dados completos e na credencial fixa do Compose local. A suíte backend foi repetida em PostgreSQL isolado após a falha da rede Docker local.

## Checklist do fluxo obrigatório

| Requisito | Estado | Evidência |
| --- | --- | --- |
| React, TypeScript, PHP/Laravel, PostgreSQL e Compose | Conforme no código | `frontend/package.json`, `backend/composer.json`, `docker-compose.yml`; versões 18, 8.3, 11 e 16 são escolhas do projeto, não versões fixadas no edital |
| Frontend consome API Laravel, com persistência PostgreSQL | Conforme no código e nos testes de cada camada; deploy atual não revalidado ponta a ponta | `frontend/src/features/solicitacoes/api/client.ts`, `backend/routes/api.php`, migrations Laravel |
| Criação, listagem/consulta, filtros, detalhe e atualização de status | Conforme no código | `backend/routes/api.php`, `SolicitacaoController.php`, `frontend/src/features/solicitacoes/` |
| Protocolo único gerado pela aplicação | Conforme no código | `CriarSolicitacao.php`: inserção anual com `ON CONFLICT DO NOTHING`, lock e incremento; índice UNIQUE na migration inicial |
| URGENTE exige justificativa | Conforme no código | `CriarSolicitacaoRequest.php` e `AtualizarSolicitacaoRequest.php`; CHECK `chk_justificativa_urgente` na migration inicial |
| Estados iniciais e transições permitidas | Conforme para operações HTTP | `CriarSolicitacao.php` força `RECEBIDA`; `AtualizarStatusSolicitacao.php` centraliza a tabela de transições, transação e `lockForUpdate` |
| Estados finais bloqueiam novas transições | Conforme para `PATCH /status` | `TRANSICOES['CONCLUIDA']` e `TRANSICOES['CANCELADA']` são listas vazias; edição cadastral também retorna 409 |
| Respostas de erro coerentes | Conforme no código | `backend/bootstrap/app.php` padroniza `{message, errors}` para 401/403/404/405/409/419/422/429/500 |
| Migrations, filtros, índices e constraints | Conforme no código, com ressalva da agenda | `backend/database/migrations/`; CHECKs dos enums e da justificativa, índices dos três filtros; vínculo entre estado e agendamento é garantido pela Action, não por CHECK entre tabelas |
| Docker e instruções de execução | Conforme no código; banco PostgreSQL 16 isolado iniciado com Compose para a suíte | `docker-compose.yml`, `backend/docker/entrypoint.sh`, `README.md` |
| Testes relevantes e dados fictícios | Cobertura presente; suíte backend e frontend executadas | `backend/tests/Feature/`, `frontend/src/test/`, seeders; ver verificações abaixo |
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
3. **Credencial local fixa (risco médio de apresentação).** `docker-compose.yml` e `backend/.env.example` contêm a senha ilustrativa `secret` para PostgreSQL. A seção 2.2 do edital proíbe versionar **segredos reais**; a seção 2.4-E diz apenas “não versionar senhas, tokens ou credenciais”. A senha local de exemplo não aparenta ser um segredo real, então não é desvio eliminatório demonstrado, mas pode custar pontos em segurança. Nenhuma `APP_KEY` nem `.env` real está versionada; a senha fixa não deve ser reutilizada em deploy. O README explicita essa distinção.
4. **Laravel 11 com advisories conhecidos (risco de segurança/nota técnica).** A versão major é uma decisão interna do projeto; a seção 2.1 do edital exige Laravel, sem fixar a major. `docs/security-dependencies.md` registra os advisories do framework e que `composer audit` não fica limpo nesta major. O resultado do audit não foi reexecutado nesta revisão. Uma atualização exigiria revisão de compatibilidade e mudança da decisão interna.
5. **Invariante de agenda só na aplicação (risco baixo/médio).** A migration `2026_09_22_000006` removeu os CHECKs antigos de `agendado_para` para suportar turno. O PostgreSQL não impede isoladamente uma linha `AGENDADA` sem registro em `agendamentos`; a Action cria o registro na mesma transação e o índice parcial impede dois agendamentos ativos. Foi detectada e corrigida nesta revisão a descrição antiga e contraditória em `docs/spec.md`.
6. **Validação de CPF limitada ao formato (risco baixo).** O projeto aceita máscara válida sem verificar dígitos verificadores. Está declarado no README; o edital transcrito não exige CPF, pois é campo adicional.

## Documentação e funcionalidades conferidas

O README agora apresenta o acesso publicado, cadastro de atendente, fluxo obrigatório, busca/filtros/ordenação, cartões de prioridades abertas, fila, agenda semanal, histórico, faltas, notificações por worker, modo escuro, instalação, testes, OpenAPI, IA e limites conhecidos. `docs/spec.md` foi alinhado com a modalidade por turno: `agendado_para` pode ser nulo em `AGENDADA`, `hora_agendada` e `turno` são alternativas exclusivas e os CHECKs antigos foram removidos. As rotas de `backend/routes/api.php` aparecem no OpenAPI em inspeção textual. Esta inspeção não substitui um validador OpenAPI nem chamadas HTTP de todos os exemplos.

## Verificações desta revisão

- Frontend: 67 testes Vitest em 13 arquivos aprovados; ESLint e build (`tsc -b` + Vite) aprovados.
- Backend: Pest **157 testes/2549 assertions aprovados** em PostgreSQL 16 temporário e banco `vlab_test`; Pint aprovado em 117 arquivos. Os containers antigos do Compose local estavam sem rede (`NetworkSettings.Networks={}`), e a primeira tentativa falhou por não resolver `db`. No projeto temporário, dois testes de autenticação falharam inicialmente porque o comando de teste pulou a descoberta de pacotes que o entrypoint normal executa; passaram após reconstruir os manifestos. O teste de seeder revelou uma simulação incorreta do ambiente de produção: alterava `config('app.env')` em vez do ambiente detectado pela aplicação. O teste foi corrigido e a suíte completa passou.
- Nenhum teste de criação/modificação foi feito no banco de desenvolvimento `vlab`; não houve `migrate:fresh`, `db:seed` ou limpeza de volumes.
- O deploy respondeu em 24/09/2026: `/` retornou 200, `/api/v1/health` retornou 200 com `{"status":"ok","db":"ok"}`, e `GET /api/v1/auth/cadastro` indicou cadastro habilitado. Não houve login nem fluxo autenticado ponta a ponta no deploy nesta revisão. `composer audit` não foi reexecutado.

## Estimativa de avaliação

Pela matriz da seção 5 do edital, minha estimativa fundamentada é **91/100 na base + 14/20 em bônus = 105/120**. Esta é uma estimativa técnica, não a nota da banca:

| Critério do edital | Estimativa | Motivo principal da redução |
| --- | ---: | --- |
| Funcionamento e integração ponta a ponta | 23/25 | Fluxo autenticado no deploy não refeito nesta rodada |
| Backend | 14/15 | Extensões acrescentam complexidade e a retenção histórica merece revisão |
| Frontend | 13/15 | Contraste calculado, zoom de 200% e leitor de tela ainda sem medição completa |
| Organização e arquitetura | 13/15 | Múltiplos fluxos extras aumentam o custo de compreensão |
| Testes e confiabilidade | 15/15 | Pest 157/157 em PostgreSQL isolado, Vitest 67/67; cenários relevantes |
| Validação, segurança e privacidade | 8/10 | Senha fixa de desenvolvimento e acesso amplo ao detalhe na demonstração |
| Documentação e execução | 5/5 | README, Compose, migrations, OpenAPI, arquitetura e declaração de IA |
| **Base** | **91/100** | Acima dos mínimos de 60/100 e 6/15 por camada |
| **Bônus** | **14/20** | Auth, health, seeders, logs, CI, arquitetura, UX e fila/notificações têm implementação; pontuação exata é discricionária |

A banca pode reduzir a estimativa se penalizar a exclusão que apaga histórico ou encontrar falha no fluxo autenticado do deploy. Também pode valorizar mais os bônus. O texto oficial não fixa Laravel 11: requer PHP com Laravel, React com TypeScript, PostgreSQL e Docker Compose. A versão 11 é decisão interna deste projeto.
