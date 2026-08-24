# Execute Unit Test

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@unit-testing` | `fe.unit-testing` | qdrant | select meaningful isolated proof and refuse zero-test or skipped-target passes |
| `@source-catalog` | `knowledge/references/catalog.json` | file | resolve exactly one source reference matching the changed role |
| `@source-fe` | `knowledge/references/starci-academy-fe.json` | file | inspect FE harness precedent only when the changed role is FE |
| `@source-be` | `knowledge/references/starci-academy-be.json` | file | inspect BE harness precedent only when the changed role is BE |

## Steps

1. Run `validate-input.mjs`; stop before source reads or commands on failure.
2. Use `@source-catalog` to select one role-matched reference. Do not load the other source unless the changed unit crosses that role boundary.
3. Verify the workspace route, manifest, change-set hash, target files, immutable reference commit, and Qdrant virtual root.
4. Read the smallest changed owner and matching tests. Use the reference only for harness, placement, naming, and fixture precedent.
5. Select manifest-owned focused commands. Refuse a command that selects zero tests or hides target tests behind skip/filter/exclusion.
6. Prove success, meaningful boundary behavior, and failure behavior. Mock only external boundaries and freeze clock, random, and scheduler inputs.
7. Persist command, selection, counts, failures, coverage when available, and sanitized logs.
8. Run `validate-output.mjs`. Never emit invalid or partial evidence.

Do not repair source here. Return a typed repair or blocker so the app graph chooses the next operation.
