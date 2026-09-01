# UAT flow coverage compiler

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.uat-flow-coverage` |
| Contract revision | `7.6.0` |
| Operators | `test/uat-case-freeze, test/uat-behavior-proof, test/uat-ux-proof, test/uat-ui-proof` |
| Search tags | `uat, flow graph, happy, unhappy, recovery, coverage, merge signature` |
| Dependencies | `fe.customer-journey, fe.uat-protocol` |

## Authority

Flow coverage is internal compile guidance; it does not create a flow-audit stage or issue another
product-quality verdict. It compiles the intended UAT cases before source mutation; the durable
snapshot binds the final source/runtime only after blind UI and Quality PASS, immediately before
final-only UAT execution. Build a reachable state graph from entry through
success and every evidenced safe terminal. Include user actions, system commitments, side effects,
async/realtime edges, refresh/resume, denials, failures, recovery, and cancellation.

Compile the smallest complete flow set. A flow identity changes only when actor/recognizable entry,
business outcome/terminal, semantic owner/side-effect boundary, or recovery topology materially
changes. A route, page, viewport, copy, field, validation message, or data permutation alone is not a
new flow. Each selected flow is one canonical pair under the verified project backend:
`.worktrees/uat/<feature>/<flow>/snapshot.json` freezes intent, identities, final source heads, cases,
fixtures and proof requirements immediately before execution; `result.json` records immutable
verdicts and evidence. Feature coverage is derived from these pairs by default search, never copied
into a second index or routed checkout-local `.uat`.

The canonical happy case is always separate. Select a separate unhappy UAT case only when the branch changes a business outcome or next action, crosses auth or permission, reads or writes durable state, creates FE–BE integration risk, requires user recovery, or threatens refresh/resume continuity. An unhappy case may cover multiple examples only when start/pre-failure state, semantic owner, side effect, recovery action, terminal state, and fault scope are identical. Record the six-field signature and lower-level evidence for any omitted permutation.

Client-side validation and component-local loading, empty, error, responsive or render permutations do not become UAT cases merely because the state exists. Delegate them only with exact schema/component/integration proof and no product-decision, wiring or recovery risk. Loading or skeleton transitions may be observed inside the happy case; refresh may remain a happy-case checkpoint. Split business refusal, meaningful zero-state next action, stale/expired state, auth/security, concurrency/idempotency, rate limit, user-facing retry, transport/infrastructure, realtime failure, or different recovery.

The compiler emits selected cases, delegated lower-level tests, fixture needs, resource claims, a unique sequential execution order, and unrepresented transitions. A recoverable unhappy case ends only after recovery reaches success. A visible error is an intermediate checkpoint, never sufficient terminal proof.

The normal budget is one to five representative cases per flow: exactly one happy plus one unhappy for each distinct six-field recovery signature. One happy-only flow is acceptable when no material unhappy UAT risk remains and all omitted permutations have exact lower-level proof. More than five is an exception: each excess case must cite a distinct signature or high-risk transition. Readiness requires zero unrepresented transitions; case count itself is never the coverage metric.
