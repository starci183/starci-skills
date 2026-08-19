# Configuration

## LOADS

None.

## Record

Bind runtime configuration to one validated, typed and immutable composition snapshot. Raw environment,
files and secret stores stop at the composition boundary.

## Law

Validate once, compose required/default/secret policy, fail closed before runtime work, inject typed
readonly views, and allow reload only as an explicit new snapshot. Configuration is not an event, log,
CQRS operation or delivery state.

## Situation codes

| Code | Situation | Binding source shape |
|---|---|---|
| `CONFIG-1` | Configuration enters the process | One parser/schema checks type, range, enum, cross-field and unknown keys |
| `CONFIG-2` | Runtime consumes settings | Typed snapshot/view only; no raw env/file/secret-store reads after composition |
| `CONFIG-3` | Optional/default/secret policy | Per-field required/default/optional/secret classification and redaction |
| `CONFIG-4` | Invalid configuration at boot | Fail before readiness, queue consumption, scheduled claim or provider registration; safe diagnostic and failed health/exit |
| `CONFIG-5` | Shared runtime configuration | Immutable readonly snapshot; explicit validated snapshot swap for reload |

## Reading an accepted shape

Resolve schema and source policy before views, and fail-closed ordering before registration. Emit every
matching code. A typed parser cannot excuse a later raw env read; readonly values cannot excuse unsafe
defaults.

## `CONFIG-1` — validate the schema once

Parse and validate all declared fields and cross-field constraints once at composition.

## `CONFIG-2` — no raw environment after composition

Inject typed snapshots or narrow views; runtime modules never read raw environment, files or secret stores.

## `CONFIG-3` — required, default and secret policy is explicit

Declare each field's required/default/optional/secret policy and redact secret values.

## `CONFIG-4` — startup fails closed

Stop before readiness, consumption, claims or registration when configuration is invalid or incomplete.

## `CONFIG-5` — typed config is immutable

Expose readonly values and perform reload only as an explicit validated snapshot swap.

## Boundaries

- `EVENT-DELIVERY` distributes facts, not mutable configuration snapshots.
- `CQRS` owns business commands/queries/events; config change is not one unless explicitly modeled.
- `OBSERVABILITY` may redact using config but never becomes a second source of values.
- `DELIVERY-ASSURANCE` may gate release; runtime still validates and fails closed.
- `INTEGRATION` consumes provider views; `RESILIENCE` consumes budget views; `ASYNC-WORK` consumes queue
  and schedule views. None reads raw sources.

## Layer held

Composition root owns reading, validation, policy and snapshot lifecycle. Consumers receive narrow views.
All five codes are documented unless a named machine enforces a syntactic subset.

## Inputs

| Input | Evidence |
|---|---|
| schema/sources | Fields, constraints, source precedence and secret owner |
| policy | Required/default/optional/secret classification |
| startup | Fail-closed ordering, readiness and safe diagnostics |
| lifecycle | Immutable snapshot or explicit reload boundary |
| proof | Invalid/missing, redaction, override and reload cases |

## Rules

1. Validate once at composition.
2. Never read raw inputs in runtime modules.
3. Make field policy and redaction explicit.
4. Fail before runtime work.
5. Expose immutable typed views.

## Exceptions

Reload is an explicit validated snapshot swap. Standalone CLIs compose at their entry point. Secret
rotation stays behind the composition owner and exposes no store client.

## Output

```text
config: <snapshot>
startup: <fail-closed order>
situation: <CONFIG-1 | CONFIG-2 | CONFIG-3 | CONFIG-4 | CONFIG-5>
reason: <schema, source, policy, startup or immutability fact>
```
