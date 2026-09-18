## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when the `graphify` executable and `graphify-out/graph.json` are available. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. If the executable is unavailable, use `docs/codebase-map.md` and `graphify-out/GRAPH_REPORT.md` as the fallback; do not block the task.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
