# Revisão de acessibilidade

Em 22/09/2026, o diálogo de detalhamento recebeu um ciclo de foco para `Tab` e `Shift+Tab`, mantendo `Escape`, nome acessível do botão de fechar e retorno do foco ao acionador. O teste automatizado `src/test/accessibility.test.tsx` cobre esses caminhos e usa a interface real com a camada de dados simulada.

Os 49 testes frontend passaram. Verificações manuais de contraste, leitor de tela e larguras 320/768/desktop ainda não foram feitas; portanto, não há alegação de conformidade WCAG completa. São verificações recomendadas antes da entrega final.
