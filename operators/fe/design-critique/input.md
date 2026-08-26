# `fe/design-critique` input

## JSON architecture

`payload.provided` freezes one candidate, its business outcome, and source observations. `payload.loads` is runtime-owned knowledge plus a fresh-context orchestration binding. `payload.session` is ephemeral and retained only until the parent skill terminal.
