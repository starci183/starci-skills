# workflow.verify

Independently verifies a coordinator's digest-frozen peer portfolio. The one input snapshot fixes peer identities, exact child goals, owned scopes, coordinator done-when ownership, original session evidence locations and repository boundaries.

Only original live terminal session records or verified close-success bundles prove a peer. Messages may locate evidence but never become evidence. Each original goal ledger entry must be accepted, and every delivered repository boundary must be verified at its exact current head with valid ancestry. The operator changes no peer, repository, task state or ledger.

A done response contains `workflow-verification-report`. Its evidence-backed review covers the frozen peer set, original session proof, goal completeness and exact repository heads. Missing proof is requested; it is never inferred. The two-round limit applies only to rereading newly supplied evidence.

Tests compile the bundle and exercise synthetic local snapshot and report records. Run `python .claude/operators/workflow.verify/tests/run.py`.
