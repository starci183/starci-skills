Owner: modules/models/selection.yaml

# Common agent admission

Every new Kernel, Op, Supervisor, worker and Critic receives a declared provider/model allow group. The pure selector
checks membership, the minimum registry tier declared for the role and operation difficulty, existing qualification or scoped eligibility, owner constraints,
quota identity and freshness, available slots, and critic independence before ranking. Registry tier describes model
policy and keeps qualification evidence separate. The canonical agent card supplies `modelAuthority`: a supported model
argument identifies a selectable launch model, while a configured logical runtime names an opaque CLI default without
attesting its underlying model. A concrete `only.model` or model-level Critic independence refuses opaque or unknown authority.

`selectAdmission({request,candidates,policy,now})` in `scripts/lib/agent-admission.mjs` reads no files or runtime state.
`policy` is `allocation.admission` from `modules/models/runtimes.yaml` with the usage thresholds of `modules/models/tiers.yaml` (`usage`). The candidates are the members of one tier chain (`modules/models/tiers.yaml`), and the receipt's `pick` is the common picker's record: `scripts/lib/tier-pick.mjs` applies the hard filter, the owner bias, a live seat's own member, the balance step (`balance.maxStreak`, `balance.maxSharePercent`) and the chain order by tokens, in that precedence. Its receipt reports policy version, the logical
attempt and scope, the selected concrete identity, every eligible identity in deterministic order, and typed rejections.

`prefer`, `avoid` and `only` are arrays of selectors. A selector names `pool`, `provider`, `model`,
or a combination (a pool id string names the pool). Prefer moves a member first and cannot add a candidate to the allow group; avoid removes it; only keeps the named members. A bias that leaves no member refuses the request and says why; the picker never drops the bias itself. Owner
bias carries a role scope from `allocation.admission.ownerBiasRoles` (every seat by default), narrowed by the bias's own `roles`.

Window authority includes every available short and long window. Each snapshot and window must be fresh, bound to the
candidate's provider/account, and authenticated. At the declared reserve threshold (90 percent) an automatic pick skips the member for this pick only; it stays in the chain. A trusted owner
bias that names the member, or an owner reserve grant for an exact scope, role, provider and model, keeps it usable from 90 up to 95 percent (`usage.biasPercent`); from 95 percent a member is refused even with a bias.
Unknown, stale, exhausted or unauthenticated capacity cannot be overridden. Providers without window telemetry use a
fresh explicit owner grant with scoped roles and finite slots; they receive no invented usage percentage.

A headless call (`modules/models/tiers.yaml` `calls`, tier use `call`) is admitted by the same selector and the same reservation:
`scripts/agent/call-admission.mjs` builds the candidates from the call tier's chain with `role` `op`, reserves one provider slot
before the child starts, marks it `launching` and then `live` with the child's pid, and releases it on the proof that the
child exited (`process-exited`), or `failed-before-launch` when nothing started. A refusal is one of three kinds: `quota`
(every member at the reserve threshold or out of tokens), `capacity` (no free provider slot) or `unavailable` (the hard filter
dropped every member: login, circuit, runtime). A call tier is never read as a seat: `tierMembers` throws for it without `use: 'call'`.

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
