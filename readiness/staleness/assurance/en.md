---
title: Delivery assurance
---

# Delivery assurance

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@assurance-be` | `compilers/patterns/be/delivery-assurance/en.md` | en | authoritative seven-part backend fence |
| `@assurance-fe` | `compilers/patterns/fe/delivery-assurance/en.md` | en | authoritative seven-part frontend fence |
| `@stale-debts` | `readiness/staleness/debts/en.md` | en | owner-approved temporary coverage/Sonar debt |

## Stale signature

Backend and frontend assurance are required by default. Only tracked
`starci.deliveryAssurance.required: false` with a non-empty `reason` yields `not required`. Missing policy,
`required: true`, or false without a reason keeps assurance required. For any required routed role, any missing
or non-blocking reached `ASSURANCE-*` fact is stale; partial adoption is not a smaller profile.
A valid debt record does not make assurance optional: covered ASSURANCE-3/4 facts become `debt`, strict
thresholds/checks stay installed, and delivery is allowed only until expiry.

## Required README badges

Every required backend or frontend README carries this complete safe set. A missing badge is an assurance
finding even when its provider check is green:

| Provider | Badge | Metric |
|---|---|---|
| Codecov | coverage | repository graph badge |
| SonarQube | quality gate | `alert_status` |
| SonarQube | coverage | `coverage` |
| SonarQube | bugs | `bugs` |
| SonarQube | vulnerabilities | `vulnerabilities` |
| SonarQube | code smells | `code_smells` |
| SonarQube | maintainability | `sqale_rating` |
| SonarQube | reliability | `reliability_rating` |
| SonarQube | security | `security_rating` |

Codecov uses host `codecov.io` with path `/gh/<owner>/<repo>/graph/badge.svg`. SonarQube uses
`<SONAR_HOST_URL>/api/project_badges/measure?project=<projectKey>&metric=<metric>`. Public projects use
token-free image URLs. A private project may add only the provider-issued, project-scoped read-only badge
`token` when the provider requires it, and only on that official image endpoint. This capability must not
authorize upload, scan, API or administration. Other credential keys, opaque secret queries and badge
tokens on non-badge URLs are refused. Machine output redacts the badge token. Every image endpoint must
return an SVG, and every badge must link to the matching provider repository/project dashboard.

## List evidence

Read the manifest policy first. For `not required`, report the exact reason and stop this module. Otherwise
read `@assurance-be` for a backend or `@assurance-fe` for a frontend and inspect names/wiring only: Husky check-only pre-push, active PR CI, one unit LCOV
producer, Codecov consumer, Sonar scan plus quality gate, fixed encrypted stack records, symbolic GitHub
 secret references, safe README badges for Codecov plus SonarQube quality gate, coverage, bugs,
vulnerabilities, code smells, maintainability, reliability and security, required checks and deploy
dependency. Never decrypt credentials. Provider values and required-check app binding
stay `unmeasured external` without authorized API evidence.
Read the role debt record and display its baseline and expiry beside covered coverage or Sonar facts.

## Repair inventory

Run only after source gates are green. Display repository writes separately from external mutations:
manifest/lockfile, hook, workflows, coverage/provider config, encrypted records, provider project creation,
GitHub Secrets/Variables and required checks. Show `scripts/publish-secret.mjs --plan` commands without values.

## Apply

Apply the routed assurance pattern as one graph: local pre-push lint+unit; active PR CI with check-only lint,
typecheck/build and exactly one coverage run; one `coverage/lcov.info` consumed by Codecov and Sonar;
an authenticated scanner run from the current local checkout that waits for and passes the Sonar quality
gate before provider CI is trusted; blocking Codecov project/patch plus Sonar quality gate; encrypted stack custody and GitHub projections;
reachable safe README badges for Codecov and the full SonarQube quality metric set; required checks; every existing deploy
dependent on verification. A repository with no deploy invents none.

Secrets come from process env by name or hidden input through `scripts/publish-secret.mjs`; never chat,
stdout, command arguments or plaintext tracked files. Repository tokens target one repository unless the
provider actually issued wider scope.

## Lane separation

Unit, E2E and Sonar retain separate ownership even when CI schedules them in one workflow. Unit alone
produces `coverage/lcov.info`; Sonar consumes that unit artifact and excludes E2E files from scanner scope. E2E owns only
real end-to-end behavior and its own pass/fail count. The workflow and proof machine must keep three
independent verdicts: E2E cannot raise or satisfy Sonar coverage, and Sonar cannot satisfy or excuse E2E.
Any E2E mutation of unit coverage artifacts is a stale boundary violation.

## Local analysis order

Provider CI is trusted only after local analysis of this exact checkout has waited for and passed the
quality gate. Three facts decide whether that happened:

- **A scan is not a gate.** A run that ends at "analysis uploaded" has proved only that the server
  received a report. `unmeasured` and `scan uploaded` are the same verdict, and neither is `ready`. A
  quality gate reported as `NONE` means the project was never analysed — unmeasured, not clean.
- **A red gate is a source finding.** It is repaired in source and rescanned until green; deferring it to
  CI hides it rather than handling it.
- **E2E is not a Sonar coverage lane.** Unit alone emits the LCOV consumed by Sonar. E2E owns only
  end-to-end behavior, is excluded from Sonar analysis/coverage and must not mutate unit coverage artifacts;
  E2E and Sonar keep independent verdicts.
- **Coverage is always blocking and four-dimensional.** One successful unit run must prove statements,
  functions and lines at least 80%, branches at least 75%, and new-code/patch at least 90% for each metric.
  A blended percentage, informational status or provider badge cannot replace any one of those facts.
  The same run emits the single LCOV consumed by Codecov and Sonar; providers gate native project/new
  coverage while the runner owns all four distinct metrics. Every declared E2E lane must also
  discover real, non-skipped tests and pass; an empty or cheaper substitute is stale.

- **A green Sonar badge is not the strict profile.** The exact checkout analysis must return gate `OK`,
  bugs/vulnerabilities/code smells 0, hotspots reviewed 100%, all three ratings A, duplicated-lines
  density ≤3% overall/new, native coverage >=80% overall and >=90% new. Missing API authority leaves
  these values `unmeasured external`; it never turns them clean.

`@stale-debts` may temporarily accept project/patch coverage or Sonar without changing this blocking
profile, provider checks or badges. The verdict is `debt`, never green; every non-debt fact remains blocking,
and malformed or expired debt fails closed.

**A framework's required emit may carry its own branch threshold.** Where a dependency-injection
framework compels metadata the runtime needs, the compiler emits guards no test can reach — under
`emitDecoratorMetadata`, every constructor parameter typed by a value import emits a
`typeof X !== "undefined" && X ? _a : Object` whose `Object` arm is dead while the module is loadable.
Statements, functions and lines are unaffected; only branches are polluted, and the per-file ceiling
`(total − deps)/total` punishes a small service with several dependencies hardest.

That permits exactly one accommodation, and it is narrow:

- the 75% branch threshold is set **once, project-wide, at the analysis layer**, where the artifact is
  diluted across the whole source surface and a real shortfall still fails;
- it is **never** a per-file ignore, an `istanbul ignore`, a coverage-path exclusion, or a relaxed
  statement/function/line bar;
- the gap between the branch bar and the other three is **recorded with its measured cause**, so a
  reader can tell a framework artifact from untested code;
- the bar is **evidence-set against the measured ceiling**, not rounded down to whatever currently
  passes. A threshold chosen to accommodate untested branches is a bent gate.

Disabling the metadata emit is not an option: it is the same metadata the container reads to resolve
constructor dependencies, so removing it to improve a number breaks injection. Verify a proposed lever
by measuring it, not by reasoning about it — `importHelpers` and a v8 coverage provider both look like
fixes and both move the number not at all.

Parallel scanner lanes must not share one binary cache; give each source its own `SONAR_BINARY_CACHE` or
scan sequentially. A shared cache is never deleted to clear a symptom unless an exact corrupt path is
proven first.

## Proof

Prove the hook refuses a controlled failure, exact CI graph, one LCOV consumed twice, a current-checkout
local Sonar analysis whose waited quality gate is `OK` after any source repair, and authenticated exact-SHA
API evidence for every condition in the blocking quality profile, encrypted filenames
without plaintext twins, every required badge image endpoint returns an image using no credential other than an allowed read-only badge capability,
external secret names and required checks through APIs, and deploy dependency. Unmeasured external
enforcement or an unmeasured badge endpoint leaves the module incomplete.
Active debt may allow delivery while this module remains incomplete and non-ready.
