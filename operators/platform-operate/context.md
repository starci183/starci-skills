# Context for `platform.operate`

## Purpose

Context is the exact material already available to operate one shared service. It answers "what may
this operator read?" before anything is touched. Context never expands mission scope and never turns
evidence into authority.

Every reference is immutable for the invocation and bound by a `sha256:` fingerprint. Source-backed
observations additionally bind the observed source head.

## Context classes

| Context | Role in the decision | Authority status |
| --- | --- | --- |
| Knowledge index | The platform catalog and the record shape every service kind obeys. | Required. Names which records may be bound. |
| Knowledge record | One service kind, the proof it demands, and the boundary it refuses. | Required reusable law. |
| Authority | The approval, the plan hash it approves, and the effect classes it allows. | Required. The only source of permission to change anything. |
| Capability | An opaque handle plus custody evidence for one credential. | Required for use. Never a value, never a durable record. |
| Inventory | What the shared service actually is right now: resources, revisions, owners, and who holds which port. | Required evidence. The set of resources that may be touched at all. |
| Workspace source | The routed checkout and its head. | Evidence that the plan belongs to the frozen source. |
| Owner audit | Prior operations on the same service. | Evidence and regression history. |

## Required context

Every invocation requires:

1. the knowledge index plus the record for the service kind being operated;
2. one approval binding the same plan hash the desired state carries;
3. every capability the service kind needs, each as a handle with custody evidence;
4. one inventory of the shared service, fingerprinted, listing every resource the plan names;
5. the routed workspace source reference whose head equals `input.project.sourceHead`.

## Refs

Every location this operator may read, by alias. `refs.json` at the root of `.claude` resolves each alias;
a location not in this table is unreadable for this operator, and `@artifacts` is the only one it writes.

| Alias | Resolves to | Bind | Required |
| --- | --- | --- | --- |
| `@runtime` | <Source>/.worktrees/sessions/central-runtime/owner.json | fingerprint + generation | Required: The shared runtime owner: inventory, generation, health. |
| `@ports/<project>` | <Source>/.workspaces/ports/<project>.json | fingerprint | Required: Port projection the runtime binds to. |
| `@identity` | <Source>/.workspaces/device-state.json | fingerprint; the sealed keys under <Source>/.workspaces/local/credentials/*.key.enc are bound by name and never read | Required: Credential handles by name; values never appear. |
| `@declaration/<project>/<role>` | <Source>/.workspaces/projects/<project>/<role>.json | fingerprint | Optional: Which projects the shared services serve. |
| `@artifacts` | input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/ | fingerprint per artifact; every artifact an operator writes is registered in output.artifactRefs | Required: Where the operation receipt is written. |

## Shared infrastructure only

This operator serves shared infrastructure. It does not deploy product. That boundary is not advice:
a resource can only be changed if the bound inventory lists it under the same service kind, and a
product deployment target is never an observability, Sonar, or tunnel resource. A plan that reaches
for one is invalid input rather than a judgement call at execution time.

## Inventory before change

A shared service is inventoried before it is changed. The inventory is bound by fingerprint, so the
receipt can state exactly what the service was when the decision was made, and a concurrent revision
becomes visible as drift rather than being silently overwritten.

`context.inventory.portHolders` records which process already holds which port, with its evidence.
That list exists so a port conflict has a name attached to it.

## Credentials

A capability is a handle and its custody evidence. The credential behind it is resolved for use and
never logged, echoed, or persisted. The input contract refuses any string that carries credential
material, and the output contract refuses even the handle, because a receipt is a durable record read
by people.

## Boundary

Context is read-only. The operator writes the approved effect delta on the inventoried service and
its typed receipt under `input.project.artifactRootRef`. It does not edit knowledge, grant its own
approval, deploy product, or free a port by stopping the process that holds it.

## Resources

This operator runs end to end on the `opus` profile (`claude-opus-5`, runtime `claude`), declared under `resources` in `operator.json` and validated by `scripts/validate-resources.mjs`. Grants it requires: source write. It never searches the web, is not bound to Grammar, and generates no image. A grant absent from `requires` is unavailable even if the profile would permit it.
