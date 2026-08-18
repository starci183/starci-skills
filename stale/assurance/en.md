---
title: Delivery assurance
---

# Delivery assurance

## LOADS

| Alias | Target | Why |
|---|---|---|
| `@assurance-be` | `compilers/patterns/be/delivery-assurance` | authoritative seven-part backend fence |

## Stale signature

Backend assurance is required by default. Only tracked
`starci.deliveryAssurance.required: false` with a non-empty `reason` yields `not required`. Missing policy,
`required: true`, or false without a reason keeps assurance required. For a required backend, any missing
or non-blocking reached `ASSURANCE-*` fact is stale; partial adoption is not a smaller profile.

## List evidence

Read the manifest policy first. For `not required`, report the exact reason and stop this module. Otherwise
read `@assurance-be` and inspect names/wiring only: Husky check-only pre-push, active PR CI, one unit LCOV
producer, Codecov consumer, Sonar scan plus quality gate, fixed encrypted stack records, symbolic GitHub
secret references, required checks and deploy dependency. Never decrypt credentials. Provider values and
required-check app binding stay `unmeasured external` without authorized API evidence.

## Repair inventory

Run only after source gates are green. Display repository writes separately from external mutations:
manifest/lockfile, hook, workflows, coverage/provider config, encrypted records, provider project creation,
GitHub Secrets/Variables and required checks. Show `scripts/publish-secret.mjs --plan` commands without values.

## Apply

Apply `@assurance-be` as one graph: local pre-push lint+unit; active PR CI with check-only lint,
typecheck/build and exactly one coverage run; one `coverage/lcov.info` consumed by Codecov and Sonar;
blocking Codecov project/patch plus Sonar quality gate; encrypted stack custody and GitHub projections;
required checks; every existing deploy dependent on verification. A repository with no deploy invents none.

Secrets come from process env by name or hidden input through `scripts/publish-secret.mjs`; never chat,
stdout, command arguments or plaintext tracked files. Repository tokens target one repository unless the
provider actually issued wider scope.

## Proof

Prove the hook refuses a controlled failure, exact CI graph, one LCOV consumed twice, encrypted filenames
without plaintext twins, external secret names and required checks through APIs, and deploy dependency.
Unmeasured external enforcement leaves the module incomplete.
