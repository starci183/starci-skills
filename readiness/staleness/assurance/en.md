---
title: Delivery assurance
---

# Delivery assurance

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@assurance-be` | `compilers/patterns/be/delivery-assurance` | module | authoritative seven-part backend fence |
| `@assurance-fe` | `compilers/patterns/fe/delivery-assurance` | module | authoritative seven-part frontend fence |

## Stale signature

Backend and frontend assurance are required by default. Only tracked
`starci.deliveryAssurance.required: false` with a non-empty `reason` yields `not required`. Missing policy,
`required: true`, or false without a reason keeps assurance required. For a required backend, any missing
or non-blocking reached `ASSURANCE-*` fact is stale; partial adoption is not a smaller profile.

## Required README badges

Every required backend or frontend README carries this complete token-free set. A missing badge is an assurance
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
`<SONAR_HOST_URL>/api/project_badges/measure?project=<projectKey>&metric=<metric>`. Neither URL may contain
`token`, credentials or an opaque secret query. Every image endpoint must return an SVG, and every badge
must link to the matching provider repository/project dashboard.

## List evidence

Read the manifest policy first. For `not required`, report the exact reason and stop this module. Otherwise
read `@assurance-be` for a backend or `@assurance-fe` for a frontend and inspect names/wiring only: Husky check-only pre-push, active PR CI, one unit LCOV
producer, Codecov consumer, Sonar scan plus quality gate, fixed encrypted stack records, symbolic GitHub
secret references, token-free README badges for Codecov plus SonarQube quality gate, coverage, bugs,
vulnerabilities, code smells, maintainability, reliability and security, required checks and deploy
dependency. Never decrypt credentials. Provider values and required-check app binding
stay `unmeasured external` without authorized API evidence.

## Repair inventory

Run only after source gates are green. Display repository writes separately from external mutations:
manifest/lockfile, hook, workflows, coverage/provider config, encrypted records, provider project creation,
GitHub Secrets/Variables and required checks. Show `scripts/publish-secret.mjs --plan` commands without values.

## Apply

Apply the routed assurance pattern as one graph: local pre-push lint+unit; active PR CI with check-only lint,
typecheck/build and exactly one coverage run; one `coverage/lcov.info` consumed by Codecov and Sonar;
blocking Codecov project/patch plus Sonar quality gate; encrypted stack custody and GitHub projections;
reachable token-free README badges for Codecov and the full SonarQube quality metric set; required checks; every existing deploy
dependent on verification. A repository with no deploy invents none.

Secrets come from process env by name or hidden input through `scripts/publish-secret.mjs`; never chat,
stdout, command arguments or plaintext tracked files. Repository tokens target one repository unless the
provider actually issued wider scope.

## Proof

Prove the hook refuses a controlled failure, exact CI graph, one LCOV consumed twice, encrypted filenames
without plaintext twins, every required badge image endpoint returns an image without a credential in the URL,
external secret names and required checks through APIs, and deploy dependency. Unmeasured external
enforcement or an unmeasured badge endpoint leaves the module incomplete.
