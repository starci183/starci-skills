# starci-setup-sonar

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | shared approval and output contract |
| `@workspaces` | `contexts/workspaces/en.md` | en | resolve every routed Source role |
| `@assurance-be` | `compilers/patterns/be/delivery-assurance/en.md` | en | scanner, coverage and quality evidence |
| `@assurance-fe` | `compilers/patterns/fe/delivery-assurance/en.md` | en | frontend scanner, coverage and quality evidence |
| `@sonar-assurance` | `machines/sonar-assurance/en.md` | en | strict gate and secret-boundary machine |
| `@tunnel-set` | `scripts/cloudflare-tunnel-set.mjs` | script | explicit value-safe hostname reconciliation |

## NESTED SKILLS

None.

## Run

Resolve every verified Source row (`be`/backend, `fe`/frontend and console) and inventory projects. Use one shared
`compose:starci` Sonar service and distinct project keys. Load delivery assurance so analysis uses the
measured unit run and coverage artifact. Plan is local and value-free; only explicit execution may
reconcile provider state or publish a hostname.

## Authority and secrets

Scanner tokens are project-scoped and distinct from admin/operator authority. Analysis tokens use `SONAR_TOKEN` or stdin; execution requires `SONAR_ADMIN_TOKEN`. Tokens never enter through arguments or logs. Missing status, SHA or any required measure fails. Tests and plans make
no external calls.

## Proof

Prove all routes, exact analysis SHA, gate OK, required zero findings, A ratings, reviewed hotspots 100%,
duplicated density at most 3, and native coverage at least 80% overall and 90% new.

## Stops

- Stop for a missing routed role, missing or mismatched SHA, missing/failed required measure, missing authority or scope expansion.

## Output

Report inventory, mode, evidence, changed paths and focused proof commands in the workspace language.
