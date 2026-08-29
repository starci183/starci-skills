# `source/conversation-query` input

The operator accepts only `context + input`.

- `context.policy`: revision-bound minimization policy; raw bodies must remain forbidden.
- `context.index`: exact default-search generation, freshness state, head fingerprint, and evidence.
- `context.candidateHeads`: metadata candidates already bounded to the requested identity; no transcript bodies.
- `input.identity`: one provider, conversation id, project, and role tuple.
- `input.authorizedScope`: the exact project and role authorization plus evidence.

No workflow stage, facts, routing decision, session lifecycle, or orchestration profile belongs in this contract.
