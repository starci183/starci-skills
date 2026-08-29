# Analyze starci-frontend-learning-resolve input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or default search retrieval, validate the invocation and verify `selection.skillId` equals `starci-frontend-learning-resolve`. Then perform these local checks:

1. Require one request approved by starci-frontend-request-review and bind its exact revision.
2. Resolve the approved learning identity and proposed authority.
3. Confirm evidence is current and bounded.
4. Reject unreviewed requests, ordinary maintenance or unrelated source work.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `learning-resolve`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |
