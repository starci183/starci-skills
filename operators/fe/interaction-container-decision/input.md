# `fe/interaction-container-decision` input

## JSON architecture

`payload.provided` actively supplies the objective, approved direction, modeled UX-flow artifact, and exact interaction references to classify. `payload.loads` passively retrieves only the interaction-container decision knowledge and selected orchestration mode. `payload.session` keeps every candidate comparison ephemeral until skill-terminal cleanup.

The operator receives no product source and must not infer a container from whichever component already exists.
