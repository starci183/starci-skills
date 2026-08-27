# `fe/ui-direction` output

## JSON architecture

`payload.artifact` contains three or four materially different UI directions, their visuals, tradeoffs, comparison axes, and one evidence-backed recommendation. A ready result also contains `payload.reviewPreview`: one interactive `visualize` HTML binding, its exact hash, rendered direction and surface identities, responsive states, and exact approval commands. `payload.state` is either pending review or blocked. All artifacts remain task-session data and are purged at the parent skill-terminal after handoff acknowledgement.
