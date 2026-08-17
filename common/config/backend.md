# Backend configuration

## Role

`be` is the backend target. Load `.claude/be/` only after common config and the role's target
instructions are known.

## Context order

For the BE role config:

1. Read `context.instructions`.
2. Read `context.contract` when the project explicitly registers an API/schema contract.
3. Read `context.manifests` to resolve package manager, app/workspace boundaries and available gates.
4. Before the first code write, read every applicable module under
   `.claude/be/gates/patterns/<pattern>/` completely, starting with its `INDEX.md` and following the
   module's required canon/lint references. No BE code may be written before this gate.
5. Inspect executable source, schema and tests as current business-behavior evidence.

Select patterns from the actual change surface. A capability spanning transport, CQRS, data access,
exceptions and testing loads every matching module before coding. When applicability is unclear,
inspect the backend pattern registry and settle the set first.

Backend behavior owns business truth consumed by FE. A frontend contract may describe presentation
relationships but cannot override authorization, persistence, transport or domain behavior proved by
the backend.

## Commands and config

Resolve the backend app, database/connection, compiler, lint, test and build commands from the role's
routed repository and manifests. Do not infer them from Source. Do not store environment values,
credentials, machine ports or checkout paths in tracked common config.
