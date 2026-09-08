# environment-readiness — project

One paragraph: which project, roles and environment were checked, whether a flow's identity was
probed, and how many walls stand. Written by `environment.preflight` as `response/response.md`
before any chain opens; it names every wall at once and repairs none of them.

## Binding

| Field | Value |
| --- | --- |
| Project | `project` |
| Roles | fe, be |
| Environment | `env` |
| Flow | — when no flow was named |
| Declaration | `.stacks/env/environment.json#sha256:0000000000000000000000000000000000000000000000000000000000000000` |

## Checks

| Check | Family | Status | Evidence |
| --- | --- | --- | --- |
| `declaration.fe` | declaration | ok | the portable declaration and its hydrated route both resolve |
| `checkout.fe.clean` | checkout | wall | the working tree carries uncommitted paths on the mutation branch |
| `identity.flow.signin` | identity | skipped | no flow was named |
| `approval.release` | approval | ok | person, the schema default for the class |

## Walls

| Wall | Owner | Repair |
| --- | --- | --- |
| `checkout.fe.clean` | checkout | open a session and move the change onto its branch; nothing is stashed here |

## Fallbacks taken

| Code | Action |
| --- | --- |
| `CODE` | what the fallback did; no rows when none was taken |
