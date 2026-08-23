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
| `ASSURANCE-FE-2` | A pull request changes | Lockfile install runs zero-warning lint, typecheck, production build, mature unit coverage and every declared E2E suite without skips or empty-lane success |
| `ASSURANCE-FE-3` | Coverage exists | Exactly one unit run emits `coverage/lcov.info`, clears statements/functions/lines 80%, branches 75% and each new-code/patch metric 90%; Codecov consumes it and project/patch statuses block |
| `ASSURANCE-FE-4` | Quality analysis runs | A local authenticated scan of the exact checkout consumes the same LCOV, proves the strict Sonar profile and waits for `OK`; SonarQube CI repeats that blocking gate |
| `ASSURANCE-FE-5` | Providers need credentials | Encrypted Source-owner records and repository GitHub secrets exist; workflows use names only |
| `ASSURANCE-FE-6` | A pull request merges | Required checks bind CI, Codecov and SonarQube to the protected branch |
| `ASSURANCE-FE-7` | A deploy exists | Deploy depends on successful verification; no deploy is invented when absent |

## Badge surface

README must expose a safe Codecov graph badge and the complete safe SonarQube set for the same project
key: `alert_status`, `coverage`, `bugs`, `vulnerabilities`, `code_smells`, `sqale_rating`,
`reliability_rating`, and `security_rating`. Every image endpoint returns SVG and links to its provider
dashboard. Public projects use token-free images. Private projects may use a provider-issued,
project-scoped read-only badge `token` only on the official image endpoint; it must grant no upload, scan,
API or admin authority. Missing or unreachable badges, other credential keys, opaque secret queries and
tokens on non-badge URLs keep assurance stale.

## Credential custody

Each frontend repository receives repository-scoped GitHub Secrets `CODECOV_TOKEN` and `SONAR_TOKEN`, plus
`SONAR_HOST_URL` as a repository variable. The encrypted owner may be the routed Source stack when the
frontend deliberately has no product stack; its fixed records are namespaced by frontend project so two
repositories never overwrite custody. No value appears in source, chat, command arguments or output.

## Blocking quality profile

Every routed frontend has zero lint errors/warnings, statements/functions/lines >=80%, branches >=75%,
and new-code/patch >=90% for each metric from one unit LCOV. Every declared E2E lane must discover real
tests and pass without `skip`, `todo`, `passWithNoTests`, zero-test success or a cheaper substitute.
Sonar on the exact revision must report Quality Gate `OK`, bugs/vulnerabilities/code smells 0, hotspots
reviewed 100%, all three ratings A, duplicated-lines density ≤3% overall/new, native coverage >=80%
overall and >=90% new. Jest/Vitest owns the four distinct coverage metrics; Codecov and Sonar consume the
same LCOV and prove only their native project/new coverage metrics.

## Lane separation

Unit is the sole coverage-producing lane. E2E is a separate behavioral refusal and never contributes to,
merges with or rewrites the LCOV consumed by Sonar. CI may order unit, E2E and Sonar, but it records their
verdicts independently: E2E pass is not Sonar evidence, Sonar pass is not E2E evidence, and neither failure
is renamed as the other.

## Rules

1. Hooks and CI call check-only commands and never fix source; readiness requires zero lint warnings.
2. Local pre-push stays at lint plus unit; typecheck and build stay in CI, while repair runs coverage and analysis locally before trusting CI.
3. One successful mature-threshold unit coverage run produces the LCOV consumed by both providers.
4. CI builds the production frontend before provider upload and scan.
5. Repair runs local Sonar analysis with `sonar.qualitygate.wait=true`; a red gate is a source finding, not deferred to CI.
6. README carries every required badge token-free when public, or with only the allowed provider-issued read-only badge capability when private.
7. Filesystem wiring never proves required checks; authorized provider/GitHub API evidence does.
8. Existing deploys cannot outrun verification.
9. Unit is the sole LCOV producer; E2E is an independent behavioral lane excluded from Sonar analysis and
   coverage, and never substitutes for a Sonar verdict.

## Proof

Run local zero-warning lint, typecheck, build, mature unit coverage and every declared E2E gate; generate
LCOV, run authenticated local Sonar analysis and
wait for a green gate; prove the hook refuses a controlled failure; parse the CI graph; prove one LCOV path is consumed twice; verify encrypted record names, GitHub secret/variable names,
all badge SVG endpoints, required checks and deploy dependency. Any unmeasured reached fact is incomplete.
The proof records exact lint counts, four project/new-code coverage metrics, E2E suite/test counts and
every exact-SHA strict Sonar condition; aggregate or badge-only evidence is incomplete.
