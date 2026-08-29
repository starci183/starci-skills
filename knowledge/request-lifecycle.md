# Design request lifecycle

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.request-lifecycle` |
| Operators | `request-emission, feedback-request, request-review` |
| Search tags | `request, stable id, create, feedback, review, approval, priority, grammar gap, persistence` |
| Dependencies | `fe.source-fit` |

## Record

Every approved create decision becomes a durable request before implementation changes source.

Use `.claude/requests/<stable-id>.request.json`. The stable ID derives from owner, responsibility, target tier, and reason; rerunning the same decision must address the same path and content identity. The request records evidence refs, selected flow/layout hashes, exact source boundary, fit verdict, intended owner, acceptance criteria, and blocking behavior.

`create-block-or-above` authorizes only application-owned Block/layout/page work. A declared lower-tier extension names its base/effective hashes and allowed axis. `grammar-gap` requests the routed Grammar lifecycle and blocks local reconstruction until resolved.

Fail closed on path escape, unstable identity, conflicting existing content, missing evidence, or a request that silently broadens the approved boundary. Writing a request is an explicit side effect and must be followed by a content-hash receipt.

Feedback requests are reviewed separately from resolution. Review accepts exactly one current request and an explicit `approved` or `rejected` decision. It preserves the per-session accepts/rejects ledger, records a bounded rationale, evidence hash, owner subset and `normal` or `urgent` priority, and updates only the request status and review fields. `urgent` changes queue order; it never weakens proof, permits owner expansion, or authorizes an authority mutation.

Every feedback request proposes the smallest durable promotion target: local symptom, flow law, `fe.ux`, `fe.ui`, selected Grammar, or executable machine gate. It also names proactive impact probes—the matching states, viewports, surfaces, and consumers that the resolving capability must inspect before implementation. One screenshot may justify a local correction; promotion to shared authority requires evidence that the rule generalizes and a negative boundary that prevents overreach.

Only an `approved` request may enter owner-specific learning resolution. Approval is not resolution: the review skill must not mutate `.claude`, Grammar, or product source beyond the request ledger itself.
