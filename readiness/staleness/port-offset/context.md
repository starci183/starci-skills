# Port offset

## LOADS

None.

## Law

`.workspace/ports/config.json` is the only authority for the Source-wide slot step, and one
`.workspace/ports/<project>.json` is the only authority for each persistent family offset and application
slot map. A product repository may declare service identity and base ports and may carry resolved `ports`
for runtime consumers; it never owns an offset or slot.

Shared services resolve as `basePort + family.offset`. Application services resolve as
`basePort + family.offset + application.slot * slotStep`. The default application occupies slot `0`;
additional applications use distinct non-negative slots. Frontend and backend services follow the same
formula, so an application pair moves together.

A service declaration in backend `metadata.json` uses one of these scopes:

- `shared`: requires `basePort`;
- `application`: requires `basePort` and `application`;
- `tool`: requires an explicit `port` and non-empty `reason`, and participates in host collision checks;
- `external`: requires an explicit `port` and non-empty `reason`, and is excluded from local host
  collision checks because it is not bound by the Source runtime.

## Stale when

- the registry config or any project allocation record is absent or invalid;
- a routed family or application has no allocation, two applications share a slot, or a product stores
  `portOffset`, `basePorts`, `fixedPorts`, an offset note, or another allocation authority;
- a declared service cannot resolve, its resolved `ports` projection differs from the formula, or a
  local effective port collides with another routed service;
- a frontend or other consumer hardcodes a value that differs from the backend projection.

## List evidence

Run `node .claude/scripts/check-port-offsets.mjs`. Report registry root, config path, slot step, each included family,
application slots, service projection, collision set, exclusions and every exact finding. This command is
check-only and never opens a target secret or writes a target.

## Inventory

Record the registry, routed backend metadata, every declared service and every known frontend/runtime
consumer. Separate allocation defects from consumer drift. An excluded project remains named as excluded;
silence never implies measurement.

## Apply

Write the shared slot step once in `.workspace/ports/config.json` and each family allocation once in
`.workspace/ports/<project>.json`. Replace product allocation ownership with
`portServices` declarations and a derived `ports` projection, then update all reached consumers. A family
migration coordinates its routed frontend and backend as one structural pass because a partial move creates
a false runtime pair. Do not renumber a clean effective port unless resolving a measured collision.

## Proof

Run the checker across every in-scope family, search target repositories for retired allocation fields,
then start all in-scope application runtimes concurrently and prove every declared local listener is unique
and reachable. Docker data services stay running; runtime smoke does not expose datastore ports publicly.
