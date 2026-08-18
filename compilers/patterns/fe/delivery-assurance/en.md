---
title: Frontend delivery assurance
module: delivery-assurance
kind: pattern
stack: fe
codes: [ASSURANCE-FE-1, ASSURANCE-FE-2, ASSURANCE-FE-3, ASSURANCE-FE-4, ASSURANCE-FE-5, ASSURANCE-FE-6, ASSURANCE-FE-7]
---

# Frontend delivery assurance

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | supplies the check-only frontend lint machine |

## Record

The input is a frontend repository with declared lint, typecheck, build and unit lanes. The output is one
delivery fence: fast pre-push refusal, reproducible PR CI, one LCOV producer, blocking Codecov and SonarQube
results, encrypted provider custody, merge enforcement and deploy ordering. Use `@canon-fe` as the
check-only lint machine; a repository-private substitute does not satisfy this pattern.

## Applicability

Frontend assurance is required by default. Only tracked `starci.deliveryAssurance.required: false` with a
non-empty `reason` is `not required`. Missing or invalid policy keeps the full profile required.

## Situations

| Code | Situation | Required refusal |
|---|---|---|
| `ASSURANCE-FE-1` | A developer pushes | Husky pre-push runs check-only full lint and unit tests |
| `ASSURANCE-FE-2` | A pull request changes | Lockfile install runs lint, typecheck, production build and unit coverage |
| `ASSURANCE-FE-3` | Coverage exists | Exactly one unit run emits `coverage/lcov.info`; Codecov consumes it and project/patch statuses block |
| `ASSURANCE-FE-4` | Quality analysis runs | A local authenticated scan of the current checkout consumes the same LCOV and waits for a green gate before CI; SonarQube CI repeats that blocking gate |
| `ASSURANCE-FE-5` | Providers need credentials | Encrypted Source-owner records and repository GitHub secrets exist; workflows use names only |
| `ASSURANCE-FE-6` | A pull request merges | Required checks bind CI, Codecov and SonarQube to the protected branch |
| `ASSURANCE-FE-7` | A deploy exists | Deploy depends on successful verification; no deploy is invented when absent |

## Badge surface

README must expose the token-free Codecov graph badge and the complete SonarQube set for the same project
key: `alert_status`, `coverage`, `bugs`, `vulnerabilities`, `code_smells`, `sqale_rating`,
`reliability_rating`, and `security_rating`. Every image endpoint returns SVG and links to its provider
dashboard. Missing, unreachable or credential-bearing badge URLs keep assurance stale.

## Credential custody

Each frontend repository receives repository-scoped GitHub Secrets `CODECOV_TOKEN` and `SONAR_TOKEN`, plus
`SONAR_HOST_URL` as a repository variable. The encrypted owner may be the routed Source stack when the
frontend deliberately has no product stack; its fixed records are namespaced by frontend project so two
repositories never overwrite custody. No value appears in source, chat, command arguments or output.

## Rules

1. Hooks and CI call check-only commands and never fix source.
2. Local pre-push stays at lint plus unit; typecheck and build stay in CI, while repair runs coverage and analysis locally before trusting CI.
3. One successful unit coverage run produces the LCOV consumed by both providers.
4. CI builds the production frontend before provider upload and scan.
5. Repair runs local Sonar analysis with `sonar.qualitygate.wait=true`; a red gate is a source finding, not deferred to CI.
6. README carries every required badge without a token.
7. Filesystem wiring never proves required checks; authorized provider/GitHub API evidence does.
8. Existing deploys cannot outrun verification.

## Proof

Run local lint, typecheck, build and unit gates; generate LCOV, run authenticated local Sonar analysis and
wait for a green gate; prove the hook refuses a controlled failure; parse the CI graph; prove one LCOV path is consumed twice; verify encrypted record names, GitHub secret/variable names,
all badge SVG endpoints, required checks and deploy dependency. Any unmeasured reached fact is incomplete.
