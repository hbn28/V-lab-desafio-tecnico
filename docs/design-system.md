# Design system — Institucional contemporâneo

Fonte de verdade visual do frontend de Solicitações de Atendimento. O sistema prioriza leitura rápida, confiança institucional, acessibilidade e densidade adequada a uma rotina operacional.

## Direção

- Interface clara, sóbria e contemporânea; sem padrões de landing page.
- Azul-marinho estrutura navegação e hierarquia institucional.
- Verde-petróleo identifica ações principais e foco operacional.
- Cores de estado sempre aparecem acompanhadas de texto; nunca são a única indicação.
- Superfícies brancas, bordas discretas, raio máximo predominante de 12 px e sombras contidas.
- Movimento apenas para feedback, com respeito a `prefers-reduced-motion`.

## Tokens

Os tokens vivem em `frontend/src/index.css` e seguem duas camadas proporcionais ao projeto:

1. Primitivos: escalas de cor, espaço, raio e sombra.
2. Semânticos: fundo, superfície, texto, borda, ação principal, foco e perigo.

Tokens específicos de componente só devem ser criados quando houver reutilização real. Componentes não devem introduzir cores hexadecimais próprias.

### Paleta central

| Papel | Token | Valor base |
| --- | --- | --- |
| Cabeçalho institucional | `--navy-950` | `#0b1f33` |
| Ação principal | `--color-primary` | `--teal-700` |
| Fundo | `--color-background` | `--slate-50` |
| Superfície | `--color-surface` | branco |
| Texto principal | `--color-text` | `--slate-950` |
| Texto secundário | `--color-text-secondary` | `--slate-600` |
| Foco | `--color-focus` | azul visível em superfícies claras |
| Perigo | `--color-danger` | vermelho semântico |

## Tipografia e espaçamento

- Pilha tipográfica do sistema operacional, sem dependência externa ou bloqueio de carregamento.
- Corpo de 16 px e altura de linha 1,5.
- Escala espacial baseada em 4 px, usando principalmente 8, 12, 16, 20, 24, 32 e 48 px.
- Números operacionais e protocolos usam algarismos estáveis; protocolos usam fonte monoespaçada.

## Componentes e estados

- Botões: principal, contorno, fantasma, transição de status e perigo em contorno.
- Campos: rótulo visível, ajuda persistente quando necessária, erro inline e foco perceptível.
- Badges: status com ponto + texto; prioridade com texto. Ambos possuem contraste e borda.
- Alertas: erro e sucesso com mensagem de recuperação; erros do formulário também aparecem em resumo focalizável e ligado aos campos.
- Painéis e cartões: uma superfície por agrupamento funcional, sem aninhamento decorativo excessivo.
- Tabela: cabeçalhos semânticos no desktop e reorganização em cartões rotulados no celular.
- Estados assíncronos: carregando, sucesso, vazio e erro são obrigatórios.

## Responsividade

- Até 480 px: uma coluna, marca compacta e ações em largura total.
- Até 768 px: filtros empilhados, tabela reorganizada em cartões e formulário em uma coluna.
- Até 992 px: resumo em três colunas e detalhe em uma coluna.
- Acima disso: largura máxima de 78 rem, resumo em cinco colunas e detalhe em duas colunas.

Não deve haver rolagem horizontal na página em 320 px. Controles interativos têm altura mínima de 44 px.

## Rotas e consistência de dados

- `/`: dashboard, resumo, filtros, paginação e listagem.
- `/solicitacoes`: compatibilidade; redireciona para `/`.
- `/solicitacoes/nova`: criação.
- `/solicitacoes/:id`: detalhe e atualização de status.

A interface consome somente os quatro endpoints documentados. As opções de transição exibidas melhoram a usabilidade, mas a Action do backend continua como única autoridade da máquina de estados.

O resumo atual é explicitamente “desta página”, pois é calculado a partir da resposta paginada. Não deve ser apresentado como total global sem um contrato de API próprio para agregação.

A listagem principal comunica a ordem da fila: estados ativos, prioridade descendente e maior tempo de espera. Como essa ordenação é aplicada pela API, a interface não deve reordenar a página localmente.

## Checklist de manutenção

- Preservar contraste WCAG AA e foco visível.
- Associar todo `label` ao respectivo controle.
- Manter mensagens de erro ligadas por `aria-describedby`.
- Não transmitir significado somente por cor.
- Validar 375, 768, 1024 e 1440 px após mudanças estruturais.
- Não adicionar biblioteca visual ou camada de tokens sem benefício demonstrável.
