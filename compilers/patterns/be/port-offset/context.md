# Port offset

## LOADS

None.

## Record

The input is an accepted backend runtime shape: one Source family, its applications, and the services
that bind or consume ports. The output separates durable Source allocation from product declarations
and resolved runtime projections without changing a clean effective port.

## Law

`.workspace/ports/config.json` owns the Source slot step; one `.workspace/ports/<project>.json` alone owns
that family's offset and application slots. Backend `metadata.json`
declares service identity and base ports in `portServices`, and may carry resolved `ports` for runtime
consumers. A product never stores an offset, slot, or second allocation table.

Shared services resolve as `basePort + family.offset`. Application services add
`application.slot * slotStep`. A paired frontend and backend use the same application slot and canonical
bases `3000`/`3001`, so the resolved backend port is always the resolved frontend port plus one.

## Situation codes

| Code | Situation | What the source must look like |
|---|---|---|
| `PORT-OFFSET-1` | A Source family needs durable allocation | Offset and distinct non-negative application slots live only in `.workspace/ports/<project>.json`; slot step lives in `.workspace/ports/config.json` |
| `PORT-OFFSET-2` | A backend service binds on the Source host | `portServices` declares scope/base/application and `ports` carries the resolved projection |
| `PORT-OFFSET-3` | Frontend and backend form one application | Both use the same application slot and every reached consumer matches the projection |
| `PORT-OFFSET-4` | A tool or external service cannot use family arithmetic | It has an explicit port and reason; only external is excluded from host collision proof |
| `PORT-OFFSET-5` | Allocation or projection changes | Registry, declarations, projections and consumers migrate together before runtime proof |

## Reading an accepted shape

1. Resolve Source, family, routed roles and application identities.
2. Classify every listener as `shared`, `application`, `tool` or `external`.
3. Use canonical frontend/backend bases `3000`/`3001`; preserve effective ports through family allocation.
4. Emit allocation once, declarations once, then update every reached consumer.
5. Reject partial frontend/backend migration.

## `PORT-OFFSET-1` — Source owns family and application allocation

**Situation.** Several repositories share one host and need stable non-colliding port ranges.

**What it emits in source.** One `.workspace/ports/<project>.json` record with `project`, `offset` and
`applications`, plus `.workspace/ports/config.json` for Source-wide `slotStep`; no product offset or slot authority.

**Boundary.** Service identity belongs to `PORT-OFFSET-2`; consumer repair belongs to
`PORT-OFFSET-3` or `PORT-OFFSET-5`.

## `PORT-OFFSET-2` — backend metadata declares services and projections

**Situation.** A backend stack publishes an application or shared service on the Source host.

**What it emits in source.** `metadata.json.portServices.<name>` with scope/base/application and the
resolved number at `metadata.json.ports.<name>`.

**Boundary.** Declarations do not own family allocation. Unpublished container-internal ports are out.

## `PORT-OFFSET-3` — paired applications move together

**Situation.** A frontend and backend form one routed application and consume local ports.

**What it emits in source.** Both declarations name one application key; scripts, defaults, examples
and tests consume matching projections. Frontend base is `3000`, backend base is `3001`, and both add
the same family offset and slot term.

**Boundary.** Shared datastores have no application slot and remain `PORT-OFFSET-2`.

## `PORT-OFFSET-4` — explicit ports are closed exceptions

**Situation.** A manual tool or externally hosted service must not use family arithmetic.

**What it emits in source.** `tool` or `external`, explicit `port`, and non-empty `reason`. Tools remain
in local collision checks; external services do not.

**Boundary.** Normal applications and shared infrastructure are not exceptions.

## `PORT-OFFSET-5` — migration is one family-wide structural pass

**Situation.** Allocation is absent, duplicated, stale or colliding.

**What it emits in source.** One pass updates registry, declarations, projections and every reached
consumer, followed by checker and concurrent runtime evidence.

**Boundary.** Do not renumber a clean port for aesthetics or leave a partial role migration.

## Layer held

| Code | Tier | What holds it |
|---|---|---|
| `PORT-OFFSET-1` | `enforced` | registry schema and `check-port-offsets.mjs` |
| `PORT-OFFSET-2` | `enforced` | declaration/projection checks |
| `PORT-OFFSET-3` | `documented` | routed consumer inventory and family proof |
| `PORT-OFFSET-4` | `enforced` | reason and collision classification checks |
| `PORT-OFFSET-5` | `enforced` | collision check and concurrent listener smoke |

## Inputs

| Input | Evidence required |
|---|---|
| Source registry | shared config plus one project-named family allocation record |
| backend declaration | routed `metadata.json` with `portServices` and `ports` |
| consumers | compose/env scripts, defaults, examples and paired frontend references |
| listeners | every local binding and explicitly excluded external service |

## Rules

1. Source owns offsets and slots; products own service identity and projections only.
2. Shared and application services use their formulas exactly.
3. Application slots are distinct non-negative integers.
4. Paired frontend/backend consumers migrate together.
5. A canonical frontend/backend pair uses bases `3000` and `3001`, preserving `BE = FE + 1`.
6. Tool and external exceptions carry explicit ports and reasons.
7. A clean effective port changes only for a measured collision or accepted allocation change.
8. Collision proof covers every routed local listener.

## Exceptions

- A tool port with a reason remains in local collision proof.
- An external port with a reason is excluded from local host collision proof.
- A container-internal port never published to the Source host is not a host allocation.

## Output

```text
family: <Source family>
allocation: <offset and application slots>
services: <portServices declarations>
projection: <resolved ports>
consumers: <updated runtime paths>
situations: <PORT-OFFSET-1 ... PORT-OFFSET-5>
proof: <checker, collision set and runtime listeners>
```
