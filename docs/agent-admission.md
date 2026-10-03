Owner: modules/models/selection.yaml

# Common agent admission

Every new Kernel, Op, Supervisor, worker and Critic receives a declared provider/model allow group. The pure selector
checks membership, the minimum registry tier declared for the role and operation difficulty, existing qualification or scoped eligibility, owner constraints,
quota identity and freshness, available slots, and critic independence before ranking. Registry tier describes model
policy and keeps qualification evidence separate. The canonical agent card supplies `modelAuthority`: a supported model
argument identifies a selectable launch model, while a configured logical runtime names an opaque CLI default without
attesting its underlying model. A concrete `require.model` or model-level Critic independence refuses opaque or unknown authority.

`selectAdmission({request,candidates,policy,now})` in `scripts/lib/agent-admission.mjs` reads no files or runtime state.
`policy` is `allocation.admission` from `modules/models/runtimes.yaml`. Its receipt reports policy version, the logical
attempt and scope, the selected concrete identity, every eligible identity in deterministic order, and typed rejections.

`prefer` and `avoid` are arrays of selectors; `require` is one selector. A selector names `pool`, `provider`, `model`,
or a combination. Prefer cannot add a candidate to the allow group. An unavailable require refuses the request. Owner
bias carries a role scope from `allocation.admission.ownerBiasRoles`, so an Op requirement does not constrain its independent Critic.

Window authority includes every available short and long window. Each snapshot and window must be fresh, bound to the
candidate's provider/account, and authenticated. At the declared reserve threshold a window refuses normal new admission. A trusted owner
may authorize an exact scope, role, provider and model to use this reserve while all windows remain below the declared exhaustion threshold.
Unknown, stale, exhausted or unauthenticated capacity cannot be overridden. Providers without window telemetry use a
fresh explicit owner grant with scoped roles and finite slots; they receive no invented usage percentage.

Authorized launch and operation routing prepare the machine store through its writer before observing shared capacity.
Read-only plans neither create nor upgrade the store and refuse unobserved capacity. A member's concurrency cap may
lower the canonical pool ceiling. The runtime adapter revalidates the observed quota evidence and atomically reserves a shared provider/account slot before launching. A receipt includes an
attempt identifier and fence; a downstream generic launcher consumes that receipt once rather than reserving again.
Reserved, launching, live and uncertain starts count toward capacity. `engine/db/provider-reservations.mjs`
checks the attempt and fence before accepting no-effect or closure proof. Reconciliation of an uncertain launch
requires an affirmative replay bound to its recorded host request and launch identity. A terminal-bound receipt
requires confirmed closure of its exact handle, `terminalProof` of `gone` or `disconnected`, and `processVerdict`
of `none` or `stopped`; a supplied PID must also match. A PID-only receipt requires confirmed exit of its exact PID.
Time alone does not release capacity. A capacity race may try only another candidate that passed the same hard
constraints. Existing running work keeps its admission identity under the `common-agent-admission` contract change.
