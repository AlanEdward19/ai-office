# rules/database-entities.md — banco / entidades / migração

## Escopo neste repo
**Não há banco persistente** hoje: salas, desks e canal colega vivem em memória no dev server enquanto há abas abertas. Linear é fonte externa de issues/projetos.

Use este arquivo **só se** introduzir storage (SQLite, Postgres, etc.).

## Regras (quando houver persistência)
- Schema via migração versionada; nunca edite migração aplicada.
- Invariantes na entidade de domínio, não espalhadas na API.
- DTO na borda; não vaze modelo de persistência para o cliente.
- Segredos fora do schema; nada sensível em log.
