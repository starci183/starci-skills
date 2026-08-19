---
title: Delivery assurance cloud
---

# Delivery assurance: Codecov and the shared SonarQube service

## Use when

Use this page to connect a backend or frontend repository to Codecov and the shared StarCi SonarQube
service, publish credentials without plaintext, obtain the first green pull request and then make those
checks mandatory.

## Before

Local source gates must already pass, **and the local Sonar quality gate must already be green**. The
GitHub operator needs repository admin access, a Codecov account bound to the GitHub organization, access
to the shared SonarQube service, `gh` authentication, SOPS and the master identity.

```powershell
gh auth status
npm ci
npm run lint:check
npm run typecheck
npm run build
npm run test:ci
npm run test:e2e
npm run sonar:check
```

`npm run sonar:check` is not optional and not a formality. Provider CI is trusted only after a local
authenticated analysis of this exact checkout has waited for and passed the quality gate. See
**Local gate before CI** below.

## Local gate before CI

The scanner and the quality gate are two different facts. A scanner that uploaded successfully has proved
only that SonarQube received a report; it has said nothing about whether the code passes. Treat a run that
ends at "analysis uploaded" as unmeasured, never as ready.

This order is mandatory for every assured frontend or backend:

1. Local lint finishes with zero errors/warnings; typecheck and build pass.
2. Generate **exactly one** LCOV report. Two runs for two dashboards is drift, not stronger assurance.
3. Prove statements/functions/lines >=80%, branches >=75% and new-code/patch >=90% for each metric.
4. Run every declared E2E entrypoint; real non-skipped tests all pass and an empty lane is a failure.
5. Run authenticated local Sonar analysis from the exact checkout, against the local service.
6. Wait for the quality gate — `sonar.qualitygate.wait=true` with a timeout of at least 600 seconds.
7. Query provider evidence and prove the strict profile below on the exact checkout SHA.
8. Treat any failed condition as a **source repair finding**, not a provider or CI problem.
9. Repair the source and rescan until the whole profile passes; only then trust provider CI.

"Unmeasured" and "scan uploaded" are not ready. A red gate deferred to CI is a red gate hidden, not
handled.

Two further constraints hold whenever analysis runs:

- **Isolated scanner caches.** Parallel lanes must not share one binary cache. Give each source its own
  `SONAR_BINARY_CACHE`, or scan sequentially. Never delete the shared `~/.sonar` cache unless an exact
  corrupt path has been proven first.
- **Coverage readiness is four numbers, not one.** Statements, branches, functions and lines each carry
  the threshold independently. A single blended percentage hides the metric that is actually failing —
  in practice branch coverage is the one that lags, and the one an aggregate number conceals.

## Strict Sonar profile

The assigned gate is reconciled idempotently, then authenticated API proof requires Quality Gate `OK`,
bugs, vulnerabilities and code smells equal to zero, security hotspots reviewed 100%, maintainability,
reliability and security rating A, duplicated-lines density no more than 3% overall and on new code,
native coverage at least 80% overall and 90% on new code, and latest analysis SHA equal to the checkout.
Jest/Vitest enforces the four distinct coverage metrics. Codecov and Sonar consume the same LCOV and gate
their native project/new coverage metrics only. Badges are visibility, not policy evidence.

The project analysis token scans. Quality-gate reconciliation and hotspot proof may require a distinct
admin/operator token. Both stay encrypted and enter only through process environment or stdin; neither is
printed, passed as an argument or stored in plaintext.

```powershell
$env:SOPS_AGE_KEY_FILE = "$HOME\.starci\master.identity"
$env:SONAR_HOST_URL    = "http://localhost:9011"
$env:SONAR_BINARY_CACHE = "$env:TEMP\sonarcache-<project>"
# decrypt the ["data"] field straight into the process environment; never echo it,
# never pass it as a command argument, never write it to a tracked file
npm run sonar:check
```

## Secrets

| Name | Encrypted owner | GitHub projection |
|---|---|---|
| Codecov upload token | `.stacks/dev/runtime/files/codecov-token.key.enc` | `CODECOV_TOKEN` secret |
| Sonar analysis token (backend) | `.stacks/dev/runtime/files/sonarqube-token.key.enc` | `SONAR_TOKEN` secret |
| Sonar analysis token (a frontend) | `.stacks/dev/runtime/files/sonarqube-<project>-token.key.enc` | `SONAR_TOKEN` secret |
| Sonar endpoint | not secret | `SONAR_HOST_URL` variable |

Each project gets its own analysis token record, namespaced by project, so two repositories never
overwrite one another's custody. The local service and the published service are the same instance
reached by two names: `http://localhost:9011` for local analysis, `https://sonar.starci.org` for CI and
for README badges.

## Run

### Codecov

1. Sign in with GitHub, install the Codecov GitHub App for the organization and grant this repository.
2. Open the repository's setup page and copy its upload token.
3. Print the value-free plan, then store and project it through one hidden/process-env input:

```powershell
node .claude/scripts/publish-secret.mjs --name CODECOV_TOKEN --stack ".::dev/runtime/files/codecov-token.key" --repo starci-lab/<repo> --plan
node .claude/scripts/publish-secret.mjs --name CODECOV_TOKEN --stack ".::dev/runtime/files/codecov-token.key" --repo starci-lab/<repo>
```

4. Keep `coverage/lcov.info`, `codecov/codecov-action@v5`, `fail_ci_if_error: true`, and blocking project/
patch statuses in `codecov.yml`: native project coverage 80% and patch coverage 90%. The local runner
separately enforces statements/functions/lines 80%, branches 75% and new-code 90% for each metric.
A coverage target is raised by covering code, never by adding an
exclusion.

### SonarQube

1. Confirm the shared service is reachable and the project key exists. Onboarding a new project is
   `starci-setup-sonar`'s job, not this page's.
2. Keep the project key in `sonar-project.properties` and point coverage at the one LCOV report:

```properties
sonar.projectKey=<actual-project-key>
sonar.javascript.lcov.reportPaths=coverage/lcov.info
```

3. Keep `sonar.tests` and `sonar.test.inclusions` describing the repository's real test suffixes. Test
   files belong to the test surface, not the analysed source surface; that separation is measurement
   correctness and is not an exclusion used to improve a number.
4. Create the project analysis token, print the value-free plan, then store and project it:

```powershell
node .claude/scripts/publish-secret.mjs --name SONAR_TOKEN --stack ".::dev/runtime/files/sonarqube-token.key" --repo starci-lab/<repo> --plan
node .claude/scripts/publish-secret.mjs --name SONAR_TOKEN --stack ".::dev/runtime/files/sonarqube-token.key" --repo starci-lab/<repo>
gh variable set SONAR_HOST_URL --repo starci-lab/<repo> --body "https://sonar.starci.org"
```

5. Ensure checkout uses full history and CI runs exactly one coverage test before Codecov/Sonar:

```yaml
with:
  fetch-depth: 0
```

Commit only the configuration and encrypted records, push a non-main branch and open a pull request.

## Verify

```powershell
gh secret list --repo starci-lab/<repo>
gh variable list --repo starci-lab/<repo>
gh pr checks --watch
```

The pull request must show `CI / verify`, Codecov project/patch statuses and the SonarQube quality gate.
In both provider dashboards, the revision must match the pull request SHA and both must consume the same
LCOV. After a successful run, configure a `main` ruleset requiring the exact contexts supplied by their
expected GitHub Apps. Required checks must be observed first; do not invent a context name.

A quality gate reported as `NONE` means the project has never been analysed. That is unmeasured, not
clean, and it never supports a ready verdict.

Verification also runs the Source quality and Sonar assurance machines; a green workflow or badge without
exact-SHA metric proof remains incomplete.

## Stop or rollback

Disable a repository in the provider or revoke its token to stop uploads. Do not remove branch protection
until a replacement check is live; temporarily roll back the provider configuration and token together.

## Rotate

Create the new provider token, replace the encrypted record, replace the GitHub Secret, rerun one PR,
then revoke the old token. `SONAR_HOST_URL` changes only when the instance or its public name changes.

## Troubleshoot

| Symptom | First check |
|---|---|
| Codecov unauthorized | repository token and GitHub App repository access |
| Codecov status absent | App installed and project/patch enabled in `codecov.yml` |
| Sonar project not found | actual project key from Project Information |
| quality gate is `NONE` | the project has never been scanned; run local analysis first |
| Sonar coverage is zero | `coverage/lcov.info` exists before the scan and the path is unchanged |
| Sonar coverage disagrees with the runner | the runner is collecting coverage over files Sonar classifies as tests |
| hotspot API returns insufficient privileges | the analysis token lacks hotspot permission; an admin credential grants it |
| scanner lanes corrupt each other | two lanes shared one `SONAR_BINARY_CACHE` |
| required check cannot be selected | let that exact check complete in the repository first |
| private repo cannot create ruleset | upgrade the GitHub plan or make the repository public |

## Upstream

- [Codecov Quick Start](https://docs.codecov.com/docs/quick-start)
- [Codecov Action](https://github.com/codecov/codecov-action)
- [SonarQube quality gates](https://docs.sonarsource.com/sonarqube-server/instance-administration/analysis-functions/quality-gates)
- [SonarScanner npm](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/sonarscanner-for-npm)
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
