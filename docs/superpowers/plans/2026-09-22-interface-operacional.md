# Interface Operacional Limpa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o frontend de ponta a ponta como um espaço operacional compacto, com busca/filtros/ordenação consistentes e agenda semanal agrupada por dia.

**Architecture:** Manter a API Laravel como autoridade de busca, filtro, ordenação, paginação e transições. Refatorar as consultas de coleções para Actions de domínio testáveis; criar um toolbar React tipado que serializa o estado consultável na URL e reaproveitá-lo nas coleções; manter a agenda semanal em sete grupos diários, cada qual consultado/paginado pelo servidor.

**Tech Stack:** React + TypeScript, Laravel API, PostgreSQL; Pest e Vitest/React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-22-interface-operacional-design.md`

## Global Constraints

- A entrega obrigatória permanece React + TypeScript, Laravel API e PostgreSQL.
- Os Controllers só orquestram FormRequest → Action → Resource; sem regra de negócio em Controller.
- A ordenação em listas paginadas é server-side; o frontend nunca reordena só a página carregada.
- A fila padrão é estados ativos primeiro, prioridade URGENTE → ALTA → MÉDIA → BAIXA, criação mais antiga primeiro no empate.
- Agendamentos respeitam data/hora marcada por padrão; prioridade só assume a ordem quando escolhida explicitamente ou usada para desempate.
- Filtros de API são allowlisted e entradas inválidas retornam 422 com `{ message, errors }`.
- Não adicionar Repository, CQRS, biblioteca de UI ou dependência sem benefício demonstrável.
- Célula permanece opcional; número completo não aparece em listas, detalhes ou logs.
- Frontend tests mockam o cliente HTTP; não fazem chamadas reais.
- Não usar dado pessoal/clínico real; não executar limpeza destrutiva de volumes/estado do usuário.
- Manter estados de carregamento, sucesso, vazio e erro, contraste/foco e acessibilidade por teclado.

## Review Focus

- **Busca contendo `%`, `_`, aspas, espaços ou caracteres acentuados:** usar parâmetros bound, sem injection ou erro SQL — cobrir na Task 1.
- **Ordenação inválida ou incompatível com o contexto (ex.: horário em fila sem agendamento):** rejeitar com 422 e nunca interpolar coluna recebida na query — cobrir na Tasks 1–2.
- **Agendamento por turno (sem `agendado_para`) na semana e no filtro de data:** deve aparecer no dia correto, ordenar por turno e não ser confundido com horário exato — cobrir na Tasks 1 e 5.
- **Múltiplos filtros, query string inválida e navegação voltar/avançar:** não deixar filtros ocultos, página vazia ou estado diferente da URL — cobrir nas Tasks 3–6.
- **Dia vazio, falha isolada em um grupo semanal, coleção grande e viewport 320px/teclado:** manter recuperação, contexto por grupo, paginação e controles acessíveis — cobrir nas Tasks 5 e 8.

---

## Decomposição de arquivos e interfaces

- `backend/app/Domain/Solicitacoes/Http/Requests/ListarSolicitacoesRequest.php`: valida busca, filtros, período, ordenação e compatibilidade por contexto.
- `backend/app/Domain/Solicitacoes/Actions/ListarSolicitacoes.php` (novo): aplica filtros e ordenação allowlisted, incluindo data operacional de horário/turno; retorna `LengthAwarePaginator`.
- `backend/app/Domain/Solicitacoes/Http/Requests/ListarFaltasRequest.php`: valida busca/filtros/ordenação de faltas.
- `backend/app/Domain/Solicitacoes/Actions/ListarFaltas.php` (novo): consulta/pagina faltas com relações de paciente/solicitação e última tentativa de contato.
- `backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php`: autoriza, passa dados validados à Action e retorna Resources; remove construção de queries de listagem/faltas do Controller.
- `backend/tests/Feature/ListarSolicitacoesTest.php`, `FaltasTest.php` e novos testes de listagem: contratos HTTP, SQL-safe allowlist, filtros, ordem e paginação.
- `frontend/src/features/solicitacoes/types/index.ts`: parâmetros tipados de busca/filtros/ordenação e estado de lista por dia.
- `frontend/src/features/solicitacoes/components/SolicitacoesToolbar.tsx` (novo): formulário comum de busca, filtros, ordenação, contagem, filtros ativos, aplicar/remover/limpar.
- `frontend/src/features/solicitacoes/hooks/useSolicitacoesQuery.ts` (novo): parse/serialize de query string e reset de página ao mudar critério.
- `frontend/src/features/solicitacoes/api/client.ts`: serializa parâmetros e métodos de coleção, inclusive faltas.
- `frontend/src/features/solicitacoes/hooks/useSolicitacoes.ts`: deriva hooks dos parâmetros tipados sem reordenação client-side.
- `frontend/src/features/solicitacoes/pages/SolicitacoesPage.tsx`: visão fila, período semanal, navegação, toolbar, agrupamento e resumo compacto.
- `frontend/src/features/solicitacoes/components/DrilldownModal.tsx`: toolbar contextual e coleção priorizada/facilmente pesquisável.
- `frontend/src/features/solicitacoes/components/FaltaCard.tsx` e `GrupoTurnoAgenda.tsx`: apresentação dos campos/datas compatível com a ordenação selecionada.
- `frontend/src/features/solicitacoes/pages/SolicitacaoDetailPage.tsx`, `NovaSolicitacaoPage.tsx`, `EditarSolicitacaoPage.tsx`, `components/SolicitacaoForm.tsx`: retorno à coleção, hierarquia do detalhe e texto conciso mantendo celular opcional.
- `frontend/src/components/Layout.tsx`, `features/auth/LoginPage.tsx`, `features/notificacoes/components/NotificacoesPanel.tsx`: navegação estável e estilos consistentes sem transformar notificações em fila.
- `frontend/src/index.css`: tokens compartilhados, baixa ornamentação, adaptação mobile e foco/estados.
- Testes frontend existentes (`src/test/solicitacoes.test.tsx`, `faltas.test.tsx`, `agenda.test.tsx`, `auth.test.tsx`, `notificacoes.test.tsx`) e testes novos para toolbar/query state.

### Contratos planejados

```text
GET /api/v1/solicitacoes
  q?: string (máx. 100 chars)
  status?, status_grupo?, categoria?, prioridade?, data_agendada?, data_de?, data_ate?
  ordenar_por?: prioridade | data | horario
  direcao?: asc | desc (data/horario; prioridade mantém urgentes primeiro)
  page?, per_page?

GET /api/v1/faltas
  q?: string (máx. 100 chars)
  data?, data_de?, data_ate?, prioridade?, resultado_contato?
  ordenar_por?: prioridade | data | horario
  direcao?: asc | desc (data/horario; prioridade mantém urgentes primeiro)
  page?, per_page?
```

Sem `ordenar_por`, o servidor mantém o padrão operacional definido por contexto: fila ativa por prioridade/antiguidade; AGENDADA por horário; histórico pelo evento mais recente; faltas por prioridade e pela falta mais antiga no empate. `data` refere-se à criação, compromisso, falta ou encerramento conforme a coleção. Ordenar por `data` com uma data exata já fixada não é opção útil e deve ser rejeitado/omitido de forma coerente; a interface não a envia. `horario` só é permitido para resultados que tenham agendamento; linhas por turno ordenam MANHÃ/TARDE/NOITE. Empates terminam deterministicamente por prioridade, protocolo e id. Ajustar detalhes apenas se o teste revelar incompatibilidade com dados existentes, sem relaxar as garantias do spec.

Agenda semanal: manter a API diária já existente (`data_agendada=YYYY-MM-DD`) e fazer até sete consultas paginadas em paralelo, uma por dia, compartilhando busca/filtros/sort e mantendo uma página independente por grupo. Isso evita resposta de período que corte uma fila diária no meio e reutiliza o suporte horário+turno existente. A URL registra `visao=agenda`, data inicial, critérios comuns e páginas diárias. O intervalo padrão é hoje…hoje+6, e anterior/próxima desloca sete dias.

Formato de URL semanal: `?visao=agenda&inicio=2026-09-22&ordenar_por=horario&agenda_page_2026-09-22=2`. Cada grupo usa o parâmetro `agenda_page_YYYY-MM-DD`; ao mover a janela, remove os parâmetros de página do intervalo anterior e mantém os filtros comuns.

---

### Task 1: Busca e ordenação server-side da coleção de solicitações

**Files:**
- Modify: `backend/app/Domain/Solicitacoes/Http/Requests/ListarSolicitacoesRequest.php`
- Create: `backend/app/Domain/Solicitacoes/Actions/ListarSolicitacoes.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php`
- Test: `backend/tests/Feature/ListarSolicitacoesTest.php`

**Interfaces:**
- Produces: `ListarSolicitacoes::execute(array $filtros): LengthAwarePaginator`.
- Query fields: `q`, `data_de`, `data_ate`, `ordenar_por`, `direcao`, filtros atuais e paginação; a Request valida compatibilidade antes da Action. `data_de`/`data_ate` aceitam uma ou ambas as extremidades; usam criação na fila, compromisso em AGENDADA e encerramento/atualização no histórico. Converter timestamps para intervalos semiabertos no fuso configurado; filtro diário de agendamento continua cobrindo horário e turno.

- [ ] **Step 1: Escreva os testes RED** para busca por protocolo/nome (incluindo nome com acento e `%`), período com limites inclusivo/exclusivo no fuso, prioridade/data ascendente e descendente, horário em empate, ordenação invalidada e paginação filtrada. Use registros fictícios com `Solicitacao::factory()`; para timestamp use `forceFill` como nos testes existentes.

```php
test('busca por nome e pagina somente os resultados filtrados', function () {
    Solicitacao::factory()->create(['nome_solicitante' => 'João da Silva', 'protocolo' => 'SOL-2026-101']);
    Solicitacao::factory()->create(['nome_solicitante' => 'Maria Santos', 'protocolo' => 'SOL-2026-102']);

    $this->getJson('/api/v1/solicitacoes?q=João&per_page=1')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.protocolo', 'SOL-2026-101');
});
```
- [ ] **Step 2: Rode a suíte para confirmar falha**: `docker compose exec -T backend ./vendor/bin/pest tests/Feature/ListarSolicitacoesTest.php`. Esperado: parâmetros novos ainda não filtram/ordenam ou não retornam 422.
- [ ] **Step 3: Adicione validação e Action mínima.** Na Request, `q` string max 100; `data_de`/`data_ate` no formato `Y-m-d`; `ordenar_por` in `prioridade,data,horario`; `direcao` in `asc,desc`; rejeite horário fora de resultado AGENDADA e data redundante com `data_agendada` exata. Na Action, usar parâmetros bound para `protocolo`/`nome_solicitante`; converter timestamps em limites semiabertos pelo fuso configurado; mapa fixo de colunas/CASE para ordenar, sem nome de coluna vindo diretamente do request; preservar filtro de dia HORARIO + TURNO; com parâmetros ausentes, reproduzir exatamente a ordenação atual. A forma do mapa deve seguir este princípio:

```php
$colunasData = [
    'fila' => 'created_at',
    'agendadas' => 'agendado_para',
    'historico' => 'updated_at',
];
$query->orderBy($colunasData[$contexto], $direcaoValidada);
```

Use `CASE` fixo para prioridade e modalidade/turno; não passe `ordenar_por` diretamente a `orderBy()`.

```php
public function execute(array $filtros): LengthAwarePaginator
{
    $query = Solicitacao::query()->with(['paciente', 'agendamentoAtivo']);
    $this->aplicarFiltros($query, $filtros);
    $this->aplicarOrdenacaoValidada($query, $filtros);

    return $query->paginate((int) ($filtros['per_page'] ?? 15));
}
```
- [ ] **Step 4: Faça o Controller orquestrar**: Gate permanece, dados vêm de `validated()`, Action retorna paginator, `SolicitacaoResource::collection()` mantém envelope existente. Remova query de índice do Controller.
- [ ] **Step 5: Rode os testes RED/GREEN** e revise os casos de filtro diário já existentes: `docker compose exec -T backend ./vendor/bin/pest tests/Feature/ListarSolicitacoesTest.php`.
- [ ] **Step 6: Rode Pint nos arquivos PHP alterados**: `docker compose exec -T backend ./vendor/bin/pint --test app/Domain/Solicitacoes/Http/Requests/ListarSolicitacoesRequest.php app/Domain/Solicitacoes/Actions/ListarSolicitacoes.php app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php tests/Feature/ListarSolicitacoesTest.php`.
- [ ] **Step 7: Commit**: `git add backend/app/Domain/Solicitacoes/Http/Requests/ListarSolicitacoesRequest.php backend/app/Domain/Solicitacoes/Actions/ListarSolicitacoes.php backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php backend/tests/Feature/ListarSolicitacoesTest.php && git commit -m "feat: add safe request search and sorting"`.

### Task 2: Filtros e ordenação server-side de faltas

**Files:**
- Modify: `backend/app/Domain/Solicitacoes/Http/Requests/ListarFaltasRequest.php`
- Create: `backend/app/Domain/Solicitacoes/Actions/ListarFaltas.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php`
- Test: `backend/tests/Feature/ListarFaltasTest.php`

**Interfaces:**
- Produces: `ListarFaltas::execute(array $filtros): LengthAwarePaginator`.
- Busca: protocolo/nome via `solicitacao`; prioridade via relação `solicitacao`; data via `data_agendada`; resultado do contato via relação existente.

- [ ] **Step 1: Escreva testes RED** cobrindo busca por protocolo/nome, prioridade, data, resultado do contato, sort por prioridade/data/hora, grupo TURNO, `422` para sort incompatível e contagem/paginação após filtros.

```php
test('filtra faltas por prioridade e ordena as urgentes primeiro', function () {
    $baixa = Agendamento::factory()->create(['status' => 'FALTA', 'data_agendada' => '2026-09-22']);
    $urgente = Agendamento::factory()->create(['status' => 'FALTA', 'data_agendada' => '2026-09-23']);
    $urgente->solicitacao->update([
        'prioridade' => 'URGENTE',
        'justificativa_prioridade' => 'Justificativa fictícia de teste.',
    ]);

    $this->getJson('/api/v1/faltas?ordenar_por=prioridade')
        ->assertOk()
        ->assertJsonPath('data.0.id', $urgente->id);
});
```
- [ ] **Step 2: Rode** `docker compose exec -T backend ./vendor/bin/pest tests/Feature/FaltasTest.php` e confirme falhas nos novos cenários.
- [ ] **Step 3: Acrescente regras allowlisted** à `ListarFaltasRequest`; preserve `data`, `resultado_contato`, `page`, `per_page`; adicione `q`, `prioridade`, `ordenar_por`, `direcao` e validação contextual.

```php
return [
    'q' => ['nullable', 'string', 'max:100'],
    'prioridade' => ['nullable', 'in:BAIXA,MEDIA,ALTA,URGENTE'],
    'ordenar_por' => ['nullable', 'in:prioridade,data,horario'],
    'direcao' => ['nullable', 'in:asc,desc'],
    'data' => ['nullable', 'date_format:Y-m-d'],
    'resultado_contato' => ['nullable', 'in:SEM_RESPOSTA,RECADO,CONFIRMOU_RETORNO,NUMERO_INVALIDO'],
];
```
- [ ] **Step 4: Implemente `ListarFaltas`** com `with(['solicitacao.paciente','ultimaTentativaContato'])`, filtros ligados por relações, ordenação SQL mapeada; `data` ordena pelo dia/hora do atendimento perdido e `falta_registrada_em` desempata quando necessário; turno ordena MANHÃ/TARDE/NOITE, sem fingir que tem hora exata. Sem seleção explícita, use prioridade decrescente e falta mais antiga no empate.
- [ ] **Step 5: Passe a listagem pelo Controller → Action → AgendamentoResource**, rode `docker compose exec -T backend ./vendor/bin/pest tests/Feature/ListarFaltasTest.php tests/Feature/FaltasTest.php`.
- [ ] **Step 6: Rode Pint nos PHP alterados**: `docker compose exec -T backend ./vendor/bin/pint --test app/Domain/Solicitacoes/Http/Requests/ListarFaltasRequest.php app/Domain/Solicitacoes/Actions/ListarFaltas.php app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php tests/Feature/FaltasTest.php`.
- [ ] **Step 7: Commit**: `git add backend/app/Domain/Solicitacoes/Http/Requests/ListarFaltasRequest.php backend/app/Domain/Solicitacoes/Actions/ListarFaltas.php backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php backend/tests/Feature/FaltasTest.php && git commit -m "feat: filter and sort missed appointments"`.

### Task 3: Modelo de consulta e toolbar compartilhado

**Files:**
- Modify: `frontend/src/features/solicitacoes/types/index.ts`
- Create: `frontend/src/features/solicitacoes/components/SolicitacoesToolbar.tsx`
- Create: `frontend/src/features/solicitacoes/hooks/useSolicitacoesQuery.ts`
- Create: `frontend/src/test/solicitacoes-toolbar.test.tsx`
- Create: `frontend/src/test/solicitacoes-query.test.ts`

**Interfaces:**
- `OrdenarPor = 'prioridade' | 'data' | 'horario'`; `Direcao = 'asc' | 'desc'`.
- `SolicitacoesConsulta` contém `q`, `status`, `status_grupo`, `categoria`, `prioridade`, `data_agendada`, `ordenar_por`, `direcao`, `page`, `per_page`.
- `useSolicitacoesQuery(contexto)` produz `{ consulta, aplicar(patch), limpar(), setPagina(page) }`; mudanças de busca/filtro/sort zeram page para 1.
- `SolicitacoesToolbar` consome `consulta`, opções aplicáveis e `onApply`; mostra busca, campos relevantes, ordenação, contagem e chips removíveis.

```ts
export function parseSolicitacoesQuery(search: string): SolicitacoesConsulta;
export function serializeSolicitacoesQuery(query: SolicitacoesConsulta): URLSearchParams;
```

- [ ] **Step 1: Escreva testes RED** do parse/serialize da URL: valores válidos preservados, enum inválido ignorado com default seguro, limpar um chip sem limpar os demais, page reset ao mudar critério, query string sem campos vazios.

```ts
it('preserva filtros válidos e descarta sort inválido', () => {
  const query = parseSolicitacoesQuery('?visao=historico&prioridade=URGENTE&ordenar_por=sql');
  expect(query.prioridade).toBe('URGENTE');
  expect(query.ordenar_por).toBeUndefined();
  expect(serializeSolicitacoesQuery(query)).not.toContain('ordenar_por=sql');
});
```
- [ ] **Step 2: Escreva teste RED do toolbar** usando `getByRole`/`getByLabelText`: labels visíveis, “Aplicar filtros”, contagem, filtro ativo removível e “Limpar filtros”; assert que seleções em edição não chamam `onApply` antes de aplicar.
- [ ] **Step 3: Execute** `npm test -- --run src/test/solicitacoes-query.test.ts src/test/solicitacoes-toolbar.test.tsx` em `frontend`; confirme falhas por arquivos/interfaces ausentes.
- [ ] **Step 4: Implemente tipos e hook** sem `any`; sincronize `useSearchParams` de React Router, preserve `visao` e campos de agenda ao modificar critérios e não faça update de URL com chaves vazias.

```ts
function aplicar(patch: Partial<SolicitacoesConsulta>) {
  const next = { ...consulta, ...patch, page: 1 };
  setSearchParams(serializeSolicitacoesQuery(next), { replace: false });
}
```
- [ ] **Step 5: Implemente o toolbar** como formulário semântico; filtros entre categorias combinam; busca pode submeter por Enter; options de sort são prop-driven para não oferecer data num dia fixo ou horário sem hora exata. Chips acessíveis têm nome contextual e remoção independente.

```tsx
interface SolicitacoesToolbarProps {
  consulta: SolicitacoesConsulta;
  opcoesOrdenacao: OrdenarPor[];
  total: number;
  onApply: (patch: Partial<SolicitacoesConsulta>) => void;
}
```
- [ ] **Step 6: Rode os dois testes**, `npx tsc --noEmit` e `npm run lint`.
- [ ] **Step 7: Commit** dos tipos, hook, componente e testes com mensagem `feat: add reusable solicitation query controls`.

### Task 4: Serialização HTTP e consultas da fila/prioridade

**Files:**
- Modify: `frontend/src/features/solicitacoes/api/client.ts`
- Modify: `frontend/src/features/solicitacoes/hooks/useSolicitacoes.ts`
- Modify: `frontend/src/features/solicitacoes/pages/SolicitacoesPage.tsx`
- Modify: `frontend/src/features/solicitacoes/components/DrilldownModal.tsx`
- Modify: `frontend/src/test/solicitacoes.test.tsx`

**Interfaces:**
- `solicitacoesApi.listar(filtros: FiltrosSolicitacoes)` serializa `q`, `ordenar_por`, `direcao` junto aos filtros atuais.
- O hook consome consulta server-side; não reordena `data.data` no cliente.
- Drill-down herda o contexto de categoria e os controles globais, mas mantém o filtro de status/prioridade que originou a janela.

- [ ] **Step 1: Escreva testes RED** para URL exata enviada pelo cliente HTTP mockado, busca por protocolo/nome, aplicação do sort no servidor, resumo compacto com contagem e drill-down que mantém contexto enquanto remove um filtro secundário.

```tsx
it('envia busca e ordenação ao servidor ao aplicar filtros', async () => {
  const user = userEvent.setup();
  render(<SolicitacoesPage />);
  await user.type(screen.getByRole('searchbox', { name: /buscar solicitações/i }), 'SOL-2026');
  await user.selectOptions(screen.getByLabelText(/ordenar por/i), 'prioridade');
  await user.click(screen.getByRole('button', { name: /aplicar filtros/i }));
  expect(solicitacoesApi.listar).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'SOL-2026', ordenar_por: 'prioridade' }));
});
```
- [ ] **Step 2: Rode** `npm test -- --run src/test/solicitacoes.test.tsx` em `frontend`; confirme que falha na query string e UI atual.
- [ ] **Step 3: Acrescente parâmetros tipados** à API e use o hook da Task 3 na fila; preencher e aplicar toolbar usa a API, alterando page para 1. Aplicar chip de prioridade/status no resumo altera filtros e abre resultados; preserve resumo global sem frase explicativa.
- [ ] **Step 4: Remova o cartão separado “Próxima solicitação por prioridade”** quando duplicar o primeiro registro. A primeira linha da lista é a próxima ação, conforme ordenação selecionada. Mantenha contagens de resumo úteis como atalhos compactos.
- [ ] **Step 5: Reaproveite toolbar no DrilldownModal**. O contexto fixo não aparece como filtro com efeito nulo; resultados continuam paginados/ordenados pela API e exibem prioridade/status/data sem repetição de contagem.
- [ ] **Step 6: Rode** `npm test -- --run src/test/solicitacoes.test.tsx src/test/solicitacoes-toolbar.test.tsx`, `npx tsc --noEmit` e `npm run lint`.
- [ ] **Step 7: Commit** com mensagem `feat: streamline queue and priority results`.

### Task 5: Agenda de solicitações em sete filas diárias

**Files:**
- Modify: `frontend/src/features/solicitacoes/pages/SolicitacoesPage.tsx`
- Modify: `frontend/src/features/solicitacoes/components/GrupoTurnoAgenda.tsx`
- Modify: `frontend/src/features/solicitacoes/api/client.ts`
- Create: `frontend/src/features/solicitacoes/hooks/useAgendaSemanal.ts`
- Modify: `frontend/src/test/agenda.test.tsx`
- Modify: `frontend/src/test/agendamento-turno.test.tsx`

**Interfaces:**
- Cada grupo diário usa `data_agendada`, `page`, `per_page`, consulta comum e sort `horario|prioridade` via API.
- A janela usa `data_inicio` na URL; início seguinte/anterior desloca sete dias; estado de página é independente por data.
- `useAgendaSemanal` retorna `Record<string, { data: Solicitacao[]; total: number; last_page: number; loading: boolean; error: string | null }>` keyed por `YYYY-MM-DD`.
- `AgendaConsulta` guarda `inicio: string` e `paginas: Record<string, number>`; serializa `inicio=YYYY-MM-DD` e `agenda_page_YYYY-MM-DD=N`.

- [ ] **Step 1: Escreva testes RED** para label “Solicitações agendadas”, datas hoje…+6 no fuso operacional, anterior/próxima por sete dias, dia sem itens, duas páginas num único dia, sort horário/prioridade, e agendamento TURNO incluído/agrupado corretamente.

```tsx
it('renderiza uma fila por dia e mantém paginação independente', async () => {
  const user = userEvent.setup();
  render(<SolicitacoesPage />);
  expect(await screen.findByRole('heading', { name: /solicitações agendadas/i })).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7);
  await user.click(screen.getByRole('button', { name: /próxima semana/i }));
  expect(screen.getByText(/29\/09\/2026/)).toBeInTheDocument();
});
```
- [ ] **Step 2: Rode** `npm test -- --run src/test/agenda.test.tsx src/test/agendamento-turno.test.tsx` e confirme que a visão atual de um dia falha nos casos de sete dias.
- [ ] **Step 3: Implemente consulta por grupo** com `Promise.all` de no máximo sete pedidos por janela; cada pedido usa `data_agendada` e paginação própria. Em falha de uma consulta, apresente erro/retry naquele dia sem derrubar os outros seis.

```ts
const groups = await Promise.all(dates.map(async date => {
  try {
    return [date, { ...(await solicitacoesApi.listar({ ...filters, data_agendada: date, page: pages[date] ?? 1 })) } ] as const;
  } catch (error) {
    return [date, { data: [], total: 0, last_page: 1, error: toMessage(error) }] as const;
  }
}));
```
- [ ] **Step 4: Renderize data como grupo de fila** cronológico com heading/contagem, recolhimento acessível e estado vazio curto. Data exata/turno permanece visível em cada linha.
- [ ] **Step 5: Integre toolbar contextual**: “Horário” default; “Prioridade” é escolha explícita dentro de cada dia; urgentes primeiro, horário no empate; hora exata tem ordem cronológica e prioridade desempata; turno sem hora exata ordena MANHÃ/TARDE/NOITE e prioridade. Para data fixa, não mostrar sort “Data”.
- [ ] **Step 6: Rode** os testes de agenda/turno, testes de solicitações relevantes, `npx tsc --noEmit` e `npm run lint`.
- [ ] **Step 7: Commit** com mensagem `feat: show scheduled requests in daily queues`.

### Task 6: Busca e ordenação no histórico e nas faltas

**Files:**
- Modify: `frontend/src/features/solicitacoes/types/index.ts`
- Modify: `frontend/src/features/solicitacoes/api/client.ts`
- Modify: `frontend/src/features/solicitacoes/hooks/useSolicitacoes.ts`
- Modify: `frontend/src/features/solicitacoes/pages/SolicitacoesPage.tsx`
- Modify: `frontend/src/features/solicitacoes/components/FaltaCard.tsx`
- Modify: `frontend/src/test/faltas.test.tsx`
- Modify: `frontend/src/test/solicitacoes.test.tsx`

**Interfaces:**
- `FiltrosFaltas` adiciona `q`, `prioridade`, `data`, `resultado_contato`, `ordenar_por`, `direcao`, `page`, `per_page`.
- `solicitacoesApi.listarFaltas` serializa esses campos; `useFaltas(params)` atualiza por identidade serializada.

- [ ] **Step 1: Escreva testes RED** para busca e filtros ativos de faltas, ordenação data/prioridade, reset page, URL preservada, contagem e estado vazio após limpar filtros; histórico usa sort API e mantém status final.

```tsx
it('filtra as faltas sem perder a contagem do servidor', async () => {
  const user = userEvent.setup();
  render(<SolicitacoesPage />);
  await user.click(screen.getByRole('button', { name: /^faltas$/i }));
  await user.selectOptions(screen.getByLabelText(/prioridade/i), 'URGENTE');
  await user.click(screen.getByRole('button', { name: /aplicar filtros/i }));
  expect(solicitacoesApi.listarFaltas).toHaveBeenLastCalledWith(expect.objectContaining({ prioridade: 'URGENTE', page: 1 }));
});
```
- [ ] **Step 2: Rode** `npm test -- --run src/test/faltas.test.tsx src/test/solicitacoes.test.tsx` e confirme falhas.
- [ ] **Step 3: Acrescente os parâmetros de faltas** ao cliente e hook; renderize toolbar antes dos FaltaCards, mantendo contato/reagendamento visíveis e prioridade/data no cartão.
- [ ] **Step 4: Ligue histórico à toolbar** e ao contrato de `status_grupo=encerrado`; data ordena atualização/encerramento, prioridade permanece alternativa; status/category/date/search são filtros de servidor.
- [ ] **Step 5: Rode** os testes afetados, `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 6: Commit** com mensagem `feat: add consistent history and absence controls`.

### Task 7: Preservação de consulta ao abrir detalhe e revisão dos formulários/textos

**Files:**
- Modify: `frontend/src/features/solicitacoes/pages/SolicitacoesPage.tsx`
- Modify: `frontend/src/features/solicitacoes/components/DrilldownModal.tsx`
- Modify: `frontend/src/features/solicitacoes/pages/SolicitacaoDetailPage.tsx`
- Modify: `frontend/src/features/solicitacoes/pages/NovaSolicitacaoPage.tsx`
- Modify: `frontend/src/features/solicitacoes/pages/EditarSolicitacaoPage.tsx`
- Modify: `frontend/src/features/solicitacoes/components/SolicitacaoForm.tsx`
- Modify: `frontend/src/test/solicitacoes.test.tsx`, `frontend/src/test/agendamento-detalhe.test.tsx`

**Interfaces:**
- Solicitação aberta de coleção deve receber `location.state.from` contendo caminho+search atuais; destino de retorno é validado como interno (prefixo `/`).
- Edição propaga `from`; acesso direto sem state usa fallback seguro à lista principal.

- [ ] **Step 1: Escreva teste RED**: selecionar busca/filtro/sort/page/período → abrir detalhe → “Voltar à listagem” restaura exatamente a URL; abrir editar → retornar mantém contexto; URL de retorno externa/inválida nunca é usada.
- [ ] **Step 2: Escreva teste RED de conteúdo** garantindo celular opcional e ajuda sobre mascaragem; remover frases redundantes identificadas no spec, manter erros, confirmação de exclusão, estados terminais e resumo de erros.
- [ ] **Step 3: Rode** `npm test -- --run src/test/solicitacoes.test.tsx src/test/agendamento-detalhe.test.tsx` e confirme que os casos novos falham.
- [ ] **Step 4: Propague `location.state.from`** para detalhe/edição e retorne por `navigate(from)` somente após validação; os links do modal usam o mesmo contexto.

```ts
function returnPath(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}
```
- [ ] **Step 5: Ajuste a hierarquia do detalhe e textos**: protocolo/prioridade/status/agendamento/ações primeiro; cadastro e descrição abaixo; remova apenas textos explicitamente redundantes do spec. Celular continua optional, payload vazio continua omitido e qualquer retorno continua mascarado.
- [ ] **Step 6: Rode** os testes alterados, `npx tsc --noEmit` e `npm run lint`.
- [ ] **Step 7: Commit** com mensagem `feat: preserve collection context across details`.

### Task 8: Navegação compacta e estados de interface consistentes

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/features/auth/LoginPage.tsx`
- Modify: `frontend/src/features/notificacoes/components/NotificacoesPanel.tsx`
- Modify: `frontend/src/features/solicitacoes/components/DrilldownModal.tsx`
- Modify: `frontend/src/features/solicitacoes/components/AgendamentoForm.tsx`
- Modify: `frontend/src/features/solicitacoes/components/ContatoFaltaDialog.tsx`
- Modify: `frontend/src/test/auth.test.tsx`, `frontend/src/test/notificacoes.test.tsx`, `frontend/src/test/accessibility.test.tsx`

**Interfaces:**
- Uma navegação previsível para Fila, Solicitações agendadas, Histórico e Faltas; em mobile, controles acessíveis preservam os mesmos destinos.
- Notificações continuam feed temporal, não lista operacional; seus itens mantêm anúncio acessível sem mover foco.

- [ ] **Step 1: Escreva testes RED** para destinos/labels de navegação, estado selecionado, navegação teclado em 320px, login labels, notificações sem re-render mover foco, modal fecha por Escape e restaura foco, diálogos e grupos de campo com nomes acessíveis.
- [ ] **Step 2: Rode** `npm test -- --run src/test/auth.test.tsx src/test/notificacoes.test.tsx src/test/accessibility.test.tsx`.
- [ ] **Step 3: Ajuste Layout** à arquitetura aprovada: header leve, links persistentes e compactação mobile sem esconder affordance/foco; use rótulos completos pedidos e `aria-current`/`aria-pressed` corretos.

```tsx
<NavLink to="/?visao=agenda" aria-label="Solicitações agendadas">
  Solicitações agendadas
</NavLink>
```
- [ ] **Step 4: Revise textos remanescentes** em login/notificações/forms/dialogs: retirar somente narração redundante; manter falhas recuperáveis, labels, erro inline, consequências e texto necessário para leitor de tela.
- [ ] **Step 5: Rode** os testes de auth, notificações e acessibilidade; faça `npx tsc --noEmit` e `npm run lint`.
- [ ] **Step 6: Commit** com mensagem `feat: unify compact navigation and feedback`.

### Task 9: Sistema visual e revisão responsiva/acessível

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/Badge.tsx` (somente se revisão provar insuficiência de rótulo/contraste)
- Modify: testes frontend de acessibilidade/regressão nas Tasks 3–8

**Interfaces:**
- Nenhuma nova dependência; preservar tokens primitivos/semânticos já existentes e a família visual atual navy/teal.
- Reduções de movimento via `prefers-reduced-motion`; sinais de prioridade/status continuam texto + cor.

- [ ] **Step 1: Escreva testes RED** onde comportamento mensurável é automatizável: nome acessível, `aria-current`, ordem de foco, controles 44px quando computável, mobile sem tabela com coluna inacessível, `prefers-reduced-motion` remove transição não essencial.
- [ ] **Step 2: Rode** `npm test -- --run src/test/accessibility.test.tsx src/test/agenda.test.tsx src/test/faltas.test.tsx` e confirme os pontos que precisam de implementação.
- [ ] **Step 3: Simplifique CSS** com superfícies claras, bordas discretas, sombra mínima, tipografia/espacamento consistentes, largura legível; remova estilos visuais repetidos só após identificar todos os consumidores. Não introduza gradientes, neumorfismo ou cor fora dos tokens.

```css
.collection-toolbar { display: grid; grid-template-columns: minmax(14rem, 2fr) repeat(3, minmax(10rem, 1fr)); gap: var(--space-3); }
@media (max-width: 48rem) { .collection-toolbar { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; } }
```
- [ ] **Step 4: Ajuste breakpoints** para 320, 375, 768, 1024 e 1440 px: toolbar empilhada/recolhível, filtros ativos legíveis, listas transformadas em cards sem perda/duplicação de dados, agenda diária com contagem e botões ≥44px; foco nunca fica sob header/modal.
- [ ] **Step 5: Verifique manualmente** Fila, semana, histórico, faltas, drill-down, detalhe, criação/login em 320px e desktop; percorra Tab/Shift+Tab/Enter/Escape, zoom 200%, foco visível, contraste AA e `prefers-reduced-motion`.
- [ ] **Step 6: Rode** `npm test -- --run`, `npx tsc --noEmit`, `npm run lint` e `npm run build`.
- [ ] **Step 7: Commit** com mensagem `style: simplify responsive operational interface`.

### Task 10: Integração, documentação e verificação final

**Files:**
- Modify: `docs/spec.md`
- Modify: `docs/openapi.yaml`
- Modify: `docs/codebase-map.md`
- Modify: `TASKS.md`
- Modify: `HANDOFF.md`
- Modify: `graphify-out` por `graphify update .` (artefato derivado, após código)

**Interfaces:**
- Documentação registra query keys, sentidos e defaults de ordenação, limites das coleções e janela semanal.
- Sem afirmar testes manuais/CI não executados.

- [ ] **Step 1: Atualize contratos OpenAPI/spec** para `q`, filtros existentes/normais, `ordenar_por`, `direcao`, respostas paginadas, endpoint de faltas e validações 422.

```yaml
- name: ordenar_por
  in: query
  required: false
  schema:
    type: string
    enum: [prioridade, data, horario]
```
- [ ] **Step 2: Atualize mapa, TASKS e HANDOFF** com a entrega, sequência/último commit, próximos itens e bloqueios reais; não marcar trabalho alheio desta tarefa.
- [ ] **Step 3: Rode suite backend completa**: `docker compose exec -T backend ./vendor/bin/pest`; depois `./vendor/bin/pint --test` dentro do serviço backend.
- [ ] **Step 4: Rode frontend completo**: `npm test -- --run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` dentro de `frontend`.
- [ ] **Step 5: Valide OpenAPI** com o validador disponível no projeto e confira manualmente execução integrada dos filtros/sort/paginação; o resultado de teste não pode estar baseado só em mocks.
- [ ] **Step 6: Rode `graphify update .`** depois das modificações para atualizar relações. Se CLI continuar indisponível, registre bloqueio e mantenha mapa humano atualizado.
- [ ] **Step 7: Confirme ambiente Docker sem destruição**: não usar `docker compose down -v`; validar apenas stack isolada/healthcheck. Registrar se qualquer dependência externa impedir uma validação.
- [ ] **Step 8: Commit docs** com mensagem `docs: document operational list controls and weekly schedule`.

## Revisão de cobertura da especificação

- Arquitetura/navegação compacta e resumo sem duplicação: Tasks 4, 8, 9.
- Coleções com busca/filtro/sort no servidor e estado URL: Tasks 1–4, 6–7.
- Agenda semanal de sete grupos diários, horário/turno, ordenação e paginação por dia: Tasks 1, 5.
- Histórico, faltas e drill-down: Tasks 2, 4, 6.
- Detalhes/formulários, celular opcional, cópia e retorno: Task 7.
- Login, notificações, feedback e acessibilidade visual: Tasks 8–9.
- Contrato, Graphify, evidências e handoff: Task 10.
