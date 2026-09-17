# HANDOFF.md

Reescrito a cada rodada pelo agente que acabou de trabalhar. O próximo agente (Claude Code ou Codex) lê este arquivo antes de tocar em qualquer código.

## Última tarefa concluída

Planejamento completo de bônus: health check, middleware RequestId + logs estruturados JSON, seeders idempotentes com entrypoint condicional (`APP_SEED`), CI com PostgreSQL, e `docs/architecture.md` com esqueleto Mermaid e tabela de decisões. Todos os artefatos de planejamento atualizados: `AGENTS.md`, `docs/spec.md`, `TASKS.md`, `prompts/arquitetura-inicial.md` e `docs/architecture.md`.

## Próxima tarefa

**Arquitetura inicial** — ver `prompts/arquitetura-inicial.md` (atualizado).

O prompt de arquitetura inicial agora inclui na mesma rodada:
- `RequestId` middleware (custo baixo, registrado em `bootstrap/app.php`)
- `HealthController` com rota `GET /api/v1/health`
- `entrypoint.sh` com migrate + seed condicional

Isso garante que health check e request-id estejam desde o primeiro commit, sem rodada extra.

## Bloqueios conhecidos

Nenhum bloqueio ativo. O PDF oficial está em `C:\Users\Heitor\Downloads\DesafioTecnico_FullStack.docx.pdf` e deve ser preservado como referência.

## Estado dos arquivos de planejamento

- `AGENTS.md` — inclui convenções de health check, RequestId, seeders, CI e architecture.md
- `docs/spec.md` — inclui especificação completa de todos os bônus com código de referência
- `docs/architecture.md` — esqueleto com diagrama Mermaid, tabela de decisões e visão de evolução
- `docs/plano-tecnico.md` — plano base (não alterado; spec.md é a fonte de verdade)
- `TASKS.md` — bônus separados em seção própria com ordem de prioridade
- `prompts/arquitetura-inicial.md` — inclui health check e RequestId na rodada 1
- `prompts/rodada.md` — prompt genérico para rodadas subsequentes (não alterado)
