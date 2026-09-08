# service-receipt — service-id

One paragraph: which service of which environment was brought to which state, what proved it, and who
holds it now. Written by `service.operate` as `response/response.md`; read by `quality.verify`, which
posts to the service this receipt says is answering, and by the person who reads what the machine is
running.

## Binding

| Field | Value |
| --- | --- |
| Operator | `service.operate` |
| Step | `step-1/parallel-1` |
| Environment | `dev` |
| Service | `service-id` |
| Kind | observability |
| Desired | up |
| Observed | up |
| Endpoint | `http://127.0.0.1:9000/health` |
| Holder | 4242 |
| Approval | `.stacks/dev/environment.json#sha256:0000000000000000000000000000000000000000000000000000000000000000` |

## Checks

| Check | Status | Evidence |
| --- | --- | --- |
| `service-declared` | passed | the declaration names this service with its kind, command, probe and holder |
| `command-run` | passed | the declared command ref was run once and returned 0 |
| `probe-answered` | passed | the declared endpoint answered 200 |
| `holder-recorded` | passed | the process tree of pid 4242 answers on the declared port |

## Fallbacks taken

| Code | Action |
| --- | --- |

## Findings

| Code | Statement |
| --- | --- |
| `SERVICE_ALREADY_IN_STATE` | the service already stood in the desired state; the command was not run and nothing was restarted |
