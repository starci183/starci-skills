# Port offset

## LOADS

None.

## Record

The input is an accepted backend runtime shape: one Source family, its applications, and the services
that bind or consume ports. The output separates durable Source allocation from product declarations
and resolved runtime projections without changing a clean effective port.

## Law

`.workspace/ports/config.json` owns the Source-wide slot step, and one
`.workspace/ports/<project>.json` is the only persistent owner of that family's offset and application slots. Backend
`metadata.json` declares service identity and base ports in `portServices`, and may carry resolved
`ports` for consumers. A product never stores `portOffset`, slot numbers, or a second allocation table.

Shared services resolve as `basePort + family.offset`. Application services resolve as
`basePort + family.offset + application.slot * slotStep`. The frontend and backend of one application
use the same slot, so they move together. The canonical application pair uses frontend base `3000` and
backend base `3001`; therefore the resolved backend port is always the resolved frontend port plus one.
Tool and external ports are explicit exceptions with reasons.

## Situation codes

| Code | Situation | What the source must look like |
|---|---|---|
| `PORT-OFFSET-1` | A Source family needs durable allocation | The family offset and distinct non-negative application slots live only in `.workspace/ports/<project>.json`; the shared slot step lives in `.workspace/ports/config.json` |
| `PORT-OFFSET-2` | A backend service binds on the Source host | `metadata.json.portServices` declares its scope and base port; `metadata.json.ports` carries the resolved projection |
| `PORT-OFFSET-3` | A frontend and backend belong to one application | Both declarations name the same application slot and every reached consumer uses the corresponding projections |
| `PORT-OFFSET-4` | A tool or external service cannot use family arithmetic | The declaration uses an explicit port and non-empty reason; only `external` is excluded from host-collision proof |
| `PORT-OFFSET-5` | Allocation or a projection changes | The family migrates atomically, all reached consumers move together, and collision proof runs before runtime smoke |

## Reading an accepted shape

1. Resolve the Source, project family, routed roles and application identities.
2. Inventory each local listener and classify it as `shared`, `application`, `tool` or `external`.
3. Use canonical application bases `3000` for frontend and `3001` for backend; preserve clean effective
   ports through the family offset rather than shifting either base.
4. Emit the Source allocation once, backend service declarations once, then update every reached projection consumer.
5. Reject partial migration: a frontend/backend pair with different slots is not an intermediate valid state.

## `PORT-OFFSET-1` — Source owns family and application allocation

**Situation.** Several repositories share one host and need stable, non-colliding port ranges.

**What it emits in source.** One `.workspace/ports/<project>.json` family record with `project`, `offset`
and `applications`, plus the Source-wide `slotStep` in `.workspace/ports/config.json`. Product repositories
contain no offset or slot authority.

**Boundary.** It does not declare services; that is `PORT-OFFSET-2`. It does not repair a consumer;
that is `PORT-OFFSET-3` or `PORT-OFFSET-5`.

## `PORT-OFFSET-2` — backend metadata declares services and projections

**Situation.** A backend stack publishes an application or shared service on the Source host.

**What it emits in source.** `metadata.json.portServices.<name>` with `scope`, `basePort`, and
`application` when required, plus the resolved number at `metadata.json.ports.<name>`.

**Boundary.** `portServices` describes service identity; it does not own the family offset or slot.
Container-internal ports that are never published are outside this declaration.

## `PORT-OFFSET-3` — paired applications move together

**Situation.** A frontend and backend form one routed application and both bind or consume local ports.

**What it emits in source.** Application declarations naming the same application key, with scripts,
env examples, defaults and tests reading the matching resolved projections. The frontend declares base
`3000`, the backend base `3001`, and both add the same family offset and slot term.

**Boundary.** A shared datastore has no application slot and remains `PORT-OFFSET-2` with `shared` scope.

## `PORT-OFFSET-4` — explicit ports are closed exceptions

**Situation.** A manually started tool or an externally hosted service has a port that family arithmetic
must not renumber.

**What it emits in source.** `scope: tool` or `scope: external`, an explicit `port`, and a non-empty
`reason`. Tools remain in local collision checks; external services do not.

**Boundary.** A normal app, datastore, broker or identity service is not an exception merely because its
current number is convenient.

## `PORT-OFFSET-5` — migration is one family-wide structural pass

**Situation.** Allocation is absent, duplicated, stale, or collides with another routed listener.

**What it emits in source.** A single pass updating the registry, declarations, projections and all
reached consumers, followed by checker and concurrent runtime evidence.

**Boundary.** A clean effective port is not renumbered for aesthetics. A partial role migration is invalid.

## Layer held

| Code | Tier | What holds it |
|---|---|---|
| `PORT-OFFSET-1` | `enforced` | per-project/config registry schemas and `check-port-offsets.mjs` |
| `PORT-OFFSET-2` | `enforced` | metadata declarations/projections checked by `check-port-offsets.mjs` |
| `PORT-OFFSET-3` | `documented` | routed consumer inventory plus family-wide proof |
| `PORT-OFFSET-4` | `enforced` | explicit reason and collision classification in `check-port-offsets.mjs` |
| `PORT-OFFSET-5` | `enforced` | collision check plus concurrent listener smoke |

## Inputs

| Input | Evidence required |
|---|---|
| Source registry | `.workspace/ports/config.json` plus `.workspace/ports/<project>.json` family records |
| backend declaration | routed `metadata.json` with `portServices` and `ports` |
| consumers | compose/env scripts, application defaults, examples and paired frontend references |
| listeners | every local host binding and every explicitly excluded external service |

## Rules

1. Source owns offsets and slots; products own service identity and projections only.
2. Shared and application services use their respective formulas exactly.
3. Each application slot is a distinct non-negative integer.
4. Frontend and backend consumers for one application migrate together.
5. A canonical frontend/backend pair uses base ports `3000` and `3001`, preserving `BE = FE + 1`.
6. Tool and external exceptions carry explicit ports and reasons.
7. No clean effective port is renumbered without a measured collision or accepted allocation change.
8. Collision proof covers every routed local listener.

## Exceptions

- **Tool listener.** An explicit tool port with a reason participates in local collision checks.
- **External service.** An explicit external port with a reason is excluded from local host collision checks.
- **Container-internal port.** A port never published to the Source host is not a host allocation.

## Output

```text
family: <Source family>
allocation: <offset and application slots from .workspace/ports/<project>.json>
services: <metadata portServices declarations>
projection: <resolved metadata ports>
consumers: <updated backend/frontend runtime paths>
situations: <PORT-OFFSET-1 ... PORT-OFFSET-5>
proof: <checker, collision set and concurrent runtime listeners>
```
