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
| `@credential-bootstrap` | `scripts/sonar-source-credentials.mjs` | script | value-safe project, scoped identity, encrypted record and GitHub reconciliation behind the Windows wrapper |

## NESTED SKILLS

None.

## Run

Resolve every verified Source row (`be`/backend, `fe`/frontend and console) and inventory projects. Use one shared
`compose:starci` Sonar service and distinct project keys. Load delivery assurance so analysis uses the
measured unit run and coverage artifact. Plan is local and value-free; only explicit execution may
reconcile provider state or publish a hostname.

Read every routed repository's complete Sonar declaration before planning: `sonar-project.properties`,
manifest scanner commands, LCOV path and CI references. One route owns one Sonar project and one
project-analysis service identity; never reuse the admin token or another route's scanner token. Create
missing projects and identities during approved execute, then bind each identity to its own encrypted
record, repository `SONAR_TOKEN` secret and `SONAR_HOST_URL` variable.

## Authority and secrets

Scanner tokens are project-scoped and distinct from admin/operator authority. Analysis tokens use `SONAR_TOKEN` or stdin; execution requires `SONAR_ADMIN_TOKEN`. Tokens never enter through arguments or logs. Missing status, SHA or any required measure fails. Tests and plans make
no external calls.

If operator authority is absent, ask the owner immediately; do not wait until final proof. Run the host
OS check inherited from `@skill-shape`, then present only its compatible value-free wrapper:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/scripts/set-sonar-credentials.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/scripts/set-sonar-credentials.ps1 -Execute
```

```sh
sh .claude/scripts/set-sonar-credentials.sh
sh .claude/scripts/set-sonar-credentials.sh --execute
```

The execute prompt receives operator login/password locally and hidden, mints or reuses a separate admin
API token, encrypts it, creates every missing project, reconciles the gate declared by
`@sonar-assurance`, creates/reuses one
project-analysis token per route, publishes GitHub projections and clears process values. Chat values are
never an input. Use `-Rotate` only for an intentional credential rotation.

## Proof

Prove all routes, one distinct project-analysis identity and encrypted/GitHub projection per route,
exact analysis SHA, gate OK, required zero findings, A ratings, reviewed hotspots 100%,
duplicated density at most 3, and native coverage at least 80% overall and 90% new.

## Stops

- Stop for a missing routed role, missing or mismatched SHA, missing/failed required measure, missing authority or scope expansion.

## Output

Report inventory, mode, evidence, changed paths and focused proof commands in the workspace language.
