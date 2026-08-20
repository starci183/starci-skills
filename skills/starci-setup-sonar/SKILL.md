---
name: starci-setup-sonar
description: Set up the shared SonarQube service and reconcile strict quality gates for every routed backend, frontend and console Source role.
---

# starci-setup-sonar

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared approval and output contract |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve every routed Source role |
| `@assurance-be` | `compilers/patterns/be/delivery-assurance/context.md` | context | scanner, coverage and quality evidence |
| `@assurance-fe` | `compilers/patterns/fe/delivery-assurance/context.md` | context | frontend scanner, coverage and quality evidence |
| `@sonar-assurance` | `machines/sonar-assurance/context.md` | context | strict gate and secret-boundary machine |
| `@tunnel-set` | `scripts/cloudflare-tunnel-set.mjs` | script | explicit value-safe hostname reconciliation |
| `@credential-bootstrap` | `scripts/sonar-source-credentials.mjs` | script | value-safe project, scoped identity, encrypted record and GitHub reconciliation behind the Windows wrapper |

## NESTED SKILLS

None.

## Run

Resolve and verify every Source row (`be`/backend, `fe`/frontend and console), then inventory projects. Use the
declared shared `compose:starci` stack and distinct Sonar project keys. Load backend and frontend
delivery assurance so scanner analysis uses the same measured unit run and coverage artifact.

Read every routed repository's complete Sonar declaration before planning: `sonar-project.properties`,
manifest scanner commands, LCOV path and CI references. One route owns one Sonar project and one
project-analysis service identity; never reuse the admin token or another route's scanner token. Create
missing projects and identities during approved execute, then bind each identity to its own encrypted
record, repository `SONAR_TOKEN` secret and `SONAR_HOST_URL` variable. For a private project, also create or
reuse a separate project-scoped read-only badge token and place it only on official README badge image
endpoints. It is an intentionally published capability, not an analysis/admin credential; never substitute
the scanner or admin token.

Plan is local and value-free. Provider reconciliation, project onboarding, quality-gate mutation and
public hostname changes require explicit execute authority; execute only the displayed boundary. Never
create a per-project Sonar service.

## Authority and secrets

Scanner tokens are project-scoped and are not admin credentials. Read analysis tokens only from `SONAR_TOKEN` or stdin; execute authority comes only from `SONAR_ADMIN_TOKEN`. Reject token/password/secret arguments and never print values. Admin/operator authority is needed
for execute-mode API reconciliation. Tests and plan mode make no external calls.

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

Prove all routed roles, one distinct project-analysis identity and encrypted/GitHub projection per route,
exact analysis SHA and present gate OK, zero bugs/vulnerabilities/code smells overall and
new, A ratings, 100% reviewed hotspots, duplicated density at most 3, and native
coverage at least 80% overall and 90% new.
Prove every README badge endpoint returns semantic SVG and any private-project badge token is read-only,
project-scoped and redacted from output.

## Stops

- Stop when any backend, frontend or console route is missing.
- Stop when analysis SHA is absent or does not match the requested SHA.
- Stop when a strict required measure is missing/fails, authority is missing, or execution exceeds the boundary.

## Output

Report route inventory, plan or explicit execution mode, structured gate evidence, changed paths and
focused proof commands in the workspace language.
