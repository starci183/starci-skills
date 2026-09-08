# platform-operation-receipt — runtime project/role

One paragraph: which route entry was inventoried, which rung was climbed and attested, and which proof
set was proved. Written by `runtime.serve` (kind `runtime`) and `identity.provision` (kind `identity`)
as `response/response.md`. It proves the entry reached the approved state; it proves nothing about
any product.

## Binding

| Field | Value |
| --- | --- |
| Operator | `runtime.serve` |
| Step | `step-1/parallel-1` |
| Project | `project` |
| Service | `project/role` |
| Service kind | runtime |
| Owner | `platform-team` |
| Approval | `.stacks/dev/environment.json#sha256:0000000000000000000000000000000000000000000000000000000000000000` |
| Desired state | `sha256:0000000000000000000000000000000000000000000000000000000000000000` |
| Inventory fingerprint | `sha256:1111111111111111111111111111111111111111111111111111111111111111` |

## Convergence

| Field | Value |
| --- | --- |
| Convergence | already-converged |

## Inventoried resources

| Resource | Kind | Revision | Owner |
| --- | --- | --- | --- |
| `project/role` | runtime | g-14 | `platform-team` |

## Port holders

| Port | Holder | Evidence |
| --- | --- | --- |

## Mutations

| Effect | Resource | Before | After |
| --- | --- | --- | --- |

## Checks

| Check | Resource | Status | Evidence |
| --- | --- | --- | --- |
| `endpoints-served` | `project/role` | passed | `probes/endpoints-served.json` |

## Findings

| Code | Resource | Port | Holder | Statement |
| --- | --- | --- | --- | --- |
| `RUNTIME_HEAD_REUSED` | `project/role` | — | — | the running head already contained the wanted commit and its endpoint answered, so nothing was restarted |
