# tinkle-7 — .claude/sqlite/: workflow-ledger DB design + query catalog

Read tinkle/_common.md (the business-analysis bar applies — nghiệp vụ first, not transcription).

## Sources (read all before writing)
- `.dist/kernel/ledger-db.mjs` — the real DDL (17 tables + triggers + indexes + machine.sqlite)
- `.dist/docs/ledger-db.md` — the keystone contract doc (read FULLY — it explains every why)
- `.dist/kernel/ledger.mjs`, `ledger-migrate.mjs`, and any kernel file that runs SQL against the ledger — collect the real queries
- `.dist/schemas/ledger-db.schema.json`

## Produce `.claude/sqlite/`
- `schema.sql` — the full ledger DDL extracted verbatim from ledger-db.mjs (workflows, goals, state_snapshots, events+chain trigger, jobs, resources, leases+FK triggers, budgets, budget_reservations, incidents, reports, contracts, checks, inbox, signals, runtime_loads, inputs, migrations, meta). Comment header per table: one line of nghiệp vụ — what business fact it stores.
- `machine.sql` — machine.sqlite DDL (ledgers, resources, leases, budgets, budget_reservations) + why it's separate (cross-ledger arbiter for ai/* quota only).
- `queries/<domain>.sql` — real queries grouped by domain (jobs-queue, leases, events-tail, state-snapshots, reports, inbox/signals, budgets). Extract the ACTUAL SQL from kernel files — cite the source function in a comment per query. Don't invent queries that don't exist; mark obvious missing ones `TODO-missing`.
- `design.yaml` — the ERD in yaml: tables with {purpose, key fields, FKs, invariants (triggers/checks), why-single-transaction} + the entity relationship edges. This is the "vẽ db" artifact — an agent must be able to answer "which table owns leases?" from this alone.
- `README`-style overview → put it in `index.yaml` instead: {files, domains, invariants summary, wal/busy notes}.

## Bar
Pure .sql/.yaml — no .mjs. Every table comment answers "what decision does this row let the kernel make". The digest-chain trigger + leases FK triggers get explicit comments — they are why drift is impossible-to-persist rather than detectable. Marker + report per convention.
