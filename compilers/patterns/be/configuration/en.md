---
title: Configuration
---

# Configuration

## LOADS

None.

## Record

This pattern governs runtime configuration after a capability has been accepted. It defines where
configuration is shaped, validated, composed and injected. It does not choose product defaults or
secret values; those are supplied as explicit inputs.

## Law

Configuration is an immutable typed snapshot created once at the composition root. Raw environment,
files and secret stores are inputs, never a contract available throughout the application. The
snapshot validates its schema, applies declared defaults, enforces required/secret policy, fails closed
when invalid, and is the only configuration dependency runtime code reads.

The deciding question is: can the process prove at startup what values it will use, who may supply them,
and that no later code can silently reinterpret raw input?

## Situation codes

| Code | Situation | What the source must look like |
|---|---|---|
| `CONFIG-1` | Raw configuration enters the process | One schema/parser validates all fields once, with type, range, enum, cross-field and unknown-key checks |
| `CONFIG-2` | Runtime code needs a setting | It receives the composed typed config or a narrow typed view; no feature/adapter reads `process.env`, raw files or secret store after composition |
| `CONFIG-3` | A field may be absent or sensitive | Each field declares required/default policy and secret classification; secrets are not logged, serialized or given unsafe defaults |
| `CONFIG-4` | Configuration is invalid or incomplete | Startup fails closed before serving traffic or claiming work, with safe field-level diagnostics and non-zero exit/health failure |
| `CONFIG-5` | Configuration is shared during runtime | The snapshot and its nested values are immutable/readonly; reload is an explicit new snapshot and cannot mutate live assumptions |

## Reading an accepted shape

1. List settings the accepted capability needs, their source and sensitivity; do not infer defaults.
2. Build the schema/parser first, then compose the snapshot, then inject narrow views.
3. Resolve required/default/secret policy before the first runtime consumer and fail-closed behavior
   before boot.
4. Ask: is every field checked once (`-1`); can runtime code avoid raw reads (`-2`); are defaults and
   secrets intentional (`-3`); does invalid input stop the process (`-4`); can any consumer mutate or
   observe a different value (`-5`)?
5. Codes compose. A typed parser with a later `process.env` escape breaks `-2`; a readonly object with
   an unsafe default breaks `-3`.

## `CONFIG-1` — validate the schema once

One composition-root parser reads the declared sources, rejects unknown keys, checks types, ranges,
enums and cross-field constraints, and returns the typed snapshot. Consumers do not each parse their
  own subset.

Boundary: not `INTEGRATION-2`: an adapter consumes provider config, but does not own global schema
composition. Not `DELIVERY-ASSURANCE`: a CI check may validate example config; it does not replace
runtime validation.

## `CONFIG-2` — no raw environment after composition

After composition, constructors and methods receive config or narrow typed views. `process.env`, file
reads and secret-store calls are confined to the composition boundary. A test override uses the same
typed contract, not a hidden raw read.

Boundary: not `OBSERVABILITY`: redaction may use config but logging cannot become a second config source.
Not `ASYNC-WORK`: worker payload/config is separate; a job must not smuggle process environment into a
serialized payload.

## `CONFIG-3` — required, default and secret policy is explicit

Every field declares whether it is required, has a safe default, or is optional. Secret fields are
marked and remain opaque; defaults never turn an absent credential into a public or predictable secret.
Config output, errors and telemetry redact secret values.

Boundary: not `INTEGRATION-3`: provider error translation may redact provider metadata, but this code
decides which config values are secret. Not `RESILIENCE-4`: a default is not a fallback response.

## `CONFIG-4` — startup fails closed

Invalid, missing or contradictory configuration stops startup before HTTP readiness, queue consumption,
scheduled claims or provider registration. Diagnostics identify field and reason without exposing secret
content. Health and exit status make the failure unambiguous.

Boundary: not `DELIVERY-ASSURANCE`: a deployment gate can prevent release, but runtime must still fail
closed when its environment differs. Not `RESILIENCE-3`: rejecting startup is not load shedding live
traffic.

## `CONFIG-5` — typed config is immutable

The returned snapshot and nested values are readonly/frozen by construction. Consumers cannot change a
timeout, endpoint, feature flag or credential for other consumers. An intentional reload composes and
validates a new snapshot, then swaps it at a declared lifecycle boundary.

Boundary: not `CQRS`: configuration changes are not commands or domain events unless an explicit feature
contract says so. Not `EVENT-DELIVERY`: broadcasting a config fact does not make mutable config safe.

## Layer held

The composition root owns source reading, schema validation, secret policy and snapshot creation.
Modules receive typed views. Integration uses provider views, resilience uses budget views, async work
uses queue/schedule views. Event delivery, CQRS, observability and delivery assurance remain consumers
or proof owners, never alternate configuration authorities.

## Inputs

| Input | Evidence required |
|---|---|
| schema | Fields, types, ranges, enums, cross-field constraints and unknown-key policy |
| sources | Environment/file/secret source and precedence |
| policy | Required, safe default, optional and secret classification |
| startup | Readiness/claim/registration order and safe diagnostics |
| lifecycle | Immutability or explicit reload boundary |
| proof | Invalid, missing, secret-redaction, override and reload cases |

## Rules

1. Parse and validate once at composition.
2. Never read raw environment or secret stores in runtime modules.
3. Declare required/default/secret policy per field.
4. Fail closed before serving, consuming or registering work.
5. Expose one immutable typed snapshot or narrow readonly views.
6. Redact secrets from errors, logs, events and serialized config.

## Exceptions

- **Explicit reload.** A process may reload only through a declared lifecycle operation that builds and
  validates a new snapshot, publishes the swap atomically and proves readers see one version (`CONFIG-5`).
- **Standalone CLI.** A CLI may compose its own config at its entry point, but still validates once,
  fails closed and never exports raw values to libraries (`CONFIG-1,-4`).
- **Secret rotation.** A secret provider may refresh an opaque credential through the composition owner;
  consumers receive a typed view and never the store client (`CONFIG-2,-3`).

## Output

```text
config: <schema/snapshot name>
sources: <environment, file, secret provider>
views: <typed consumers>
startup: <fail-closed boundary>
lifecycle: <immutable or explicit reload>
situation: <CONFIG-1 | CONFIG-2 | CONFIG-3 | CONFIG-4 | CONFIG-5>
reason: <configuration fact that selects the code>
```
