---
title: Api-evolution
---

# API evolution

## LOADS

None.

## Record

The input is an accepted API operation, schema, event-facing payload or client contract. This module
decides how that contract changes without silently breaking callers: what is additive, when a break
needs explicit negotiation, how deprecation ends, which errors/enums/pages remain stable, and what
tests prove compatibility. It covers GraphQL, REST and equivalent public service boundaries; an
internal function is only in scope when another independently released consumer depends on it.

## Law

Compatibility is semantic, not merely “the server still compiles”. Add fields and optional capabilities
without changing existing meaning; never silently reinterpret a required field, enum value, error code
or cursor. A breaking change has an explicit version/negotiation mechanism and a migration path. A
deprecated surface has an owner, telemetry, sunset criteria and a removal change; a comment saying
“deprecated” is not a lifecycle. Errors use stable machine identity, enums tolerate unknown future
values where the protocol allows it, and pagination cursors remain opaque. Provider and consumer
contract tests exercise old and new clients against the supported versions.

The boundaries are explicit. `transport` places routes, headers, GraphQL fields and protocol syntax;
`exception-identity` owns failure code/class identity; `naming` owns source vocabulary; `data-access`
owns persistence migrations; `maintainability` judges change isolation; `testing` owns test mechanics.
This module decides compatibility meaning and evolution evidence, not those implementation details.

## Situation codes

| Code | Situation | What the source must look like |
|---|---|---|
| `API-1` | A released contract needs a non-breaking extension | New fields/options are additive and optional/defaulted; existing fields, meanings, errors and pagination behavior remain valid |
| `API-2` | A change cannot preserve old semantics | An explicit version/negotiation signal selects the breaking contract; old and new semantics are not silently mixed |
| `API-3` | A public surface is being deprecated or removed | Deprecation has owner, notice, telemetry, migration, sunset and removal criteria, followed by a separate removal proof |
| `API-4` | Error, enum or pagination representation is exposed | Machine error codes/paths, enum evolution behavior and opaque stable cursor/page semantics are documented and preserved |
| `API-5` | A contract change is proposed or released | Consumer/provider compatibility tests cover supported old/new clients, fixtures, negotiation and failure cases |

## Reading an accepted shape

1. Inventory consumers, release versions, fields/arguments/enums/errors/cursors and the semantics they
   rely on. A source type alone is not the contract.
2. Classify the change as additive, negotiated breaking, deprecation or removal before editing schema.
3. Preserve old meaning and defaults. If that cannot be done, choose an explicit negotiation signal.
4. For a deprecation, name the owner, migration, telemetry and measurable removal gate.
5. Freeze error/code/path, enum unknown handling and cursor semantics as contract fixtures.
6. Add compatibility tests for old and new consumers, including malformed and unsupported-version paths.
7. Apply every matching code independently; an additive field still needs stable error/pagination and tests.

## `API-1` — additive changes preserve old meaning

**Situation.** A released operation needs an extra field, optional argument, capability or event member.

**Source shape.** New response fields are optional or have a safe server default; new request inputs
are optional and do not alter the meaning of omitted inputs. Existing nullability, ordering, error
codes and authorization semantics stay intact. A consumer that does not know the new field can still
parse and use the old answer.

**Boundary.** Not `NAMING-*`: a good symbol name does not make a schema change compatible. Not
`DATA-*`: a migration may be required, but persistence compatibility does not prove wire compatibility.
Not `API-2`: if old and new meaning cannot coexist, this code stops and explicit negotiation applies.

## `API-2` — breaking semantics require explicit negotiation

**Situation.** A field type/nullability, required input, enum meaning, error shape, pagination rule or
authorization behavior cannot preserve old consumers.

**Source shape.** Version is selected by an explicit route, header/media type, GraphQL schema/version
or equivalent declared negotiation that is validated before dispatch. The selected version has one
coherent contract and its documentation/tests; no user-agent guess, date switch or silent behavior
branch decides which semantics the client receives.

**Boundary.** `TRANSPORT` implements the route/header/schema door; `API-2` requires that the door make
the breaking choice visible and deterministic. `EXCEPTION-IDENTITY` keeps failure codes stable within
each version. `MAINTAINABILITY` may isolate implementations but does not authorize a hidden break.

## `API-3` — deprecation has a measurable lifecycle

**Situation.** A field, endpoint, enum value, version or client capability must eventually disappear.

**Source shape.** The deprecated surface is marked in the contract with replacement guidance and a
date/owner; usage is measured by client/version/tenant; migration is documented; a sunset is announced;
removal waits for stated usage and support criteria. Removal is a distinct change with a compatibility
test proving the intended old contract is no longer promised.

**Boundary.** Not `MAINTAIN-*`: stale code cleanup is not a deprecation lifecycle. Not `TRANSPORT`:
the header or directive displays deprecation, while this code owns evidence and timing. Not
`EXCEPTION-IDENTITY`: deprecated error codes need migration too but identity remains stable until removal.

## `API-4` — errors, enums and pagination stay stable

**Situation.** A caller branches on an error, stores an enum, or resumes a page later.

**Source shape.** Errors expose stable machine code and structured path/metadata; human wording and
transport status are separate. Enum additions have an unknown/fallback policy and do not silently
repurpose existing values. Cursors are opaque, scoped to their operation/version and invalidated with
a stable error; order and page boundary semantics are documented rather than inferred from IDs.

**Boundary.** `exception-identity` chooses class/code identity; `API-4` keeps that identity compatible
for clients. `transport` maps it to GraphQL/REST syntax. `PERF-1` bounds page cost; this code preserves
the pagination contract. `naming` does not govern wire enum spelling once released.

## `API-5` — compatibility is executable

**Situation.** A provider changes a contract, publishes a version or removes a deprecated surface.

**Source shape.** Contract tests run old consumer fixtures against the provider, new consumer fixtures
against the new contract, and negotiation/error/unknown-enum/cursor cases. A schema diff is reviewed
with a consumer matrix; tests assert semantics, not only generated types or HTTP 200. Removal tests
prove the advertised sunset behavior and migration.

**Boundary.** Not generic `TESTING-*`: that module chooses lane and assertion placement; `API-5` names
the compatibility matrix and the contract facts to freeze. Not `PERF-4`: latency budgets can be a
separate assertion and do not establish semantic compatibility.

## Layer held

| Code | Tier | Held by |
|---|---|---|
| `API-1` | `documented` | Schema diff and consumer review; semantic compatibility needs released-consumer evidence |
| `API-2` | `documented` | Negotiation integration tests and versioned contract review |
| `API-3` | `documented` | Usage telemetry, owner/sunset record and removal review |
| `API-4` | `documented` | Wire contract fixtures and client behavior tests |
| `API-5` | `documented` | Provider/consumer compatibility matrix and schema-diff gate |

## Inputs

| Input | Evidence required |
|---|---|
| consumers | Released clients, versions, generated SDKs and actual usage |
| contract | Fields, arguments, enums, errors, cursors, defaults and semantics |
| change | Additive, breaking, deprecated or removal classification |
| negotiation | Explicit version signal and selected contract |
| lifecycle | Replacement, owner, telemetry, sunset and removal criteria |
| proof | Schema diff, fixtures, old/new consumer tests and failure cases |

## Rules

1. Treat existing meaning, nullability, error codes, enum values and cursor semantics as contracts.
2. Make additive inputs optional/defaulted and additive outputs ignorable by old clients.
3. Negotiate every unavoidable break explicitly and deterministically.
4. Give deprecation an owner, replacement, telemetry, sunset and removal gate.
5. Keep error identity stable, enum unknown behavior explicit and cursors opaque/scoped.
6. Run old/new provider-consumer contract tests; generated types alone are not proof.
7. Keep transport, exception identity, naming, data access, maintainability and testing in their own modules.

## Exceptions

- **Private unreleased API.** A contract with no independently released consumer may change before its
  first release, but it still needs one coherent source shape and tests for its declared consumers.
- **Security emergency.** Immediate removal or rejection may precede normal sunset; publish the break,
  preserve stable failure identity and add migration/compatibility evidence afterward.
- **GraphQL field deprecation.** A schema directive is useful notice, not the lifecycle by itself;
  owner, usage and sunset still apply.
- **Enum wire limitation.** If a protocol cannot tolerate unknown values, negotiate/version before adding
  one rather than pretending the client fallback is safe.

## Stops

Stop when consumers or released semantics are unknown, a break has no explicit negotiation, deprecation
has no owner/telemetry/sunset, error/enum/cursor contracts are message- or ID-inferred, or compatibility
proof is only a compile/build check. Stop before removal when migration and usage criteria are absent.

## Proof

| Code | Minimum proof |
|---|---|
| `API-1` | Schema diff plus old-client fixture proves old fields/meaning and omitted new fields still work |
| `API-2` | Version negotiation test proves each signal selects one contract and no silent cross-version behavior |
| `API-3` | Deprecation record/telemetry and removal test prove replacement and sunset gate |
| `API-4` | Wire fixtures assert stable error code/path, enum fallback and opaque cursor semantics |
| `API-5` | Provider/consumer matrix runs old/new clients through success, failure, unknown and cursor cases |

## Output

```text
consumers:   <released clients and versions>
change:      <additive | negotiated-breaking | deprecated | removal>
contract:    <fields/errors/enums/pagination semantics>
negotiation: <explicit signal, or none>
lifecycle:   <owner, replacement, telemetry, sunset and gate>
situation:   <API-1 | API-2 | API-3 | API-4 | API-5>
verdict:     <holds | violates | stop>
proof:       <schema diff, fixture or compatibility matrix>
```

## Scope

This pattern governs semantic API compatibility, explicit breaking negotiation, deprecation/removal
lifecycle, stable error/enum/pagination contracts and executable compatibility proof. It does not
place transport routes, name source symbols, choose exception identity, perform data migrations, refactor
modules or select generic test lanes; those remain `transport`, `naming`, `exception-identity`,
`data-access`, `maintainability` and `testing`.
