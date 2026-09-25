# Dependências e advisories conhecidos

O projeto permanece em Laravel 11 por decisão interna registrada em `AGENTS.md`. O edital oficial exige PHP com Laravel, mas **não fixa a versão major**. O `composer.lock` fixa Laravel `v11.56.1` e versões transitivas compatíveis com a restrição `^11.0`. `composer update laravel/framework -W --dry-run` não encontrou alteração compatível no lock.

Composer mantém o bloqueio de versões vulneráveis ativo por padrão. A configuração em `backend/composer.json` limita a exceção de instalação a três IDs que afetam toda a série Laravel 11; `on-audit: false` significa que os avisos continuam aparecendo em `composer audit` e a auditoria mantém seu código de saída de falha. Não existe exceção global no Dockerfile.

As três exceções cobrem a confusão de caminho em URL assinada temporária (`PKSA-m5cs-t1y6-qpcs`) e dois registros do advisory de CRLF da regra padrão de e-mail (`PKSA-3r5d-mb8f-1qw9`, `PKSA-mdq4-51ck-6kdq`). As versões corrigidas publicadas desses advisories são Laravel 12.61.1+/13.12+ e 12.60+/13.10+, respectivamente. O advisory XSS do debug também foi corrigido somente em 12.69.0+/13.30.0+; produção deve manter `APP_DEBUG=false`.

Por isso, “`composer audit` limpo” é incompatível com manter Laravel 11 em setembro de 2026: a série 11 encerrou atualizações de segurança em 12 de março de 2026. Não mascaramos o resultado da auditoria. Uma atualização de major é compatível com o texto do edital, mas requer alterar a decisão interna, revisar compatibilidade e executar as verificações; até lá, os avisos devem ser tratados como limitação conhecida e o uso de APIs afetadas deve continuar desabilitado.
