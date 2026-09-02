# Context for `release.deploy`

## Purpose

Context is the exact material already available to deploy one release. It answers "what is declared,
what is authorized, and what is currently running?" before the first mutation. Context never widens the
target and never turns a precedent into an authorization.

Every reference is immutable for the invocation and bound by a `sha256:` fingerprint. Source-backed
observations additionally bind the observed source head.

## Context classes

| Context | Role in the decision | Authority status |
| --- | --- | --- |
| Deployment intent | The durable product-owned declaration in `.stacks`: environment, topology, host, domain owner, workflow, probes. | Required. The only source of what should exist. |
| Lifecycle knowledge | Compare-and-set law, monitoring semantics, recovery limits, rollback validity. | Required reusable law. Never edited here. |
| Validated manifest | One exact manifest, already validated, pinned to one release identity. | Required. Verification precedes an immutable build and a rollout. |
| Authorization | The declared grant covering this project, environment, target, and the `deploy` action. | Required. Deployment is never implied by an ordinary task. |
| Credential handles | Opaque names resolved through existing custody. | Required where the plan needs them. Values never appear. |
| Observed state | The target's current revision, active release, and active digest at a stated time. | Required evidence. The baseline for every compare-and-set. |
| Evidence references | Workflow runs, registry records, host and provider observations. | Evidence only. Never a verdict. |

## Required context

Every invocation requires:

1. the declared intent whose environment equals the target environment;
2. the lifecycle knowledge binding;
3. a manifest validated against exactly this release;
4. an unexpired authorization scoped to this project, environment, and target;
5. the observed state of that same target, whose active release is the one this run replaces.

A missing or foreign-scoped authorization is `AUTHORIZATION_MISSING`. A manifest pinned to a different
release is `MANIFEST_INVALID`. Neither is repaired here: an unauthorized deployment does not become
authorized by being useful.

## Refs

Every location this operator may read, by alias. `refs.json` at the root of `.claude` resolves each alias;
a location not in this table is unreadable for this operator, and `@artifacts` is the only one it writes.

| Alias | Resolves to | Bind | Required |
| --- | --- | --- | --- |
| `@receipt/quality-verification/<invocationId>` | <@artifacts of the producing invocation>/<receipt file> | fingerprint + the sourceHead the receipt binds | Required: Verification precedes an immutable build. |
| `@oci/<image>` | ghcr.io/<image>@<digest> | digest | Required: The immutable image, by digest. |
| `@identity` | <Source>/.workspaces/device-state.json | fingerprint; the sealed keys under <Source>/.workspaces/local/credentials/*.key.enc are bound by name and never read | Required: Credential handles by name; values never appear. |
| `@workflow-run/<runId>` | GitHub Actions run <runId> of the routed repository | run id + conclusion | Optional: CI evidence of the build and rollout. |
| `@artifacts` | input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/ | fingerprint per artifact; every artifact an operator writes is registered in output.artifactRefs | Required: Where the deployment receipt is written. |

## Credentials are names, never values

`context.credentials` carries `secret-ref://` handles and their custody references. There is no field
anywhere in this contract that accepts a credential value, so a token pasted in place of a handle is
rejected as malformed input rather than quietly carried into a plan, a log, or an argument list.

Resolution happens through existing custody at execution time. The receipt records which handles were
resolved and nothing else.

## Concrete bindings on this project

Pushing `main` triggers the GitHub Actions workflow, and boot takes roughly eight to nine minutes, so
a monitoring deadline shorter than the steady window it must contain produces a guaranteed false
failure. The GraphQL typename probe returning `200` is the readiness signal, which is why at least one
declared probe must be public: a run observing only container health proves nothing a user could see.

## Boundary

Context is read-only. The operator applies only the declared host, migration, domain, and rollout
mutations against the frozen release, writes its receipt under `input.project.artifactRootRef`, and
restores the exact declared rollback release when that branch is taken. It does not edit the intent,
revalidate the manifest into something else, rebuild the immutable artifact, or adopt a release that
appeared from another run.

## Resources

This operator runs end to end on the `opus` profile (`claude-opus-5`, runtime `claude`), declared under `resources` in `operator.json` and validated by `scripts/validate-resources.mjs`. Grants it requires: source write. It never searches the web, is not bound to Grammar, and generates no image. A grant absent from `requires` is unavailable even if the profile would permit it.
