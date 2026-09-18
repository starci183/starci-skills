# fmt/4 — `suspended` as a real state: blocked, needs a design decision

Status: **not implemented.** The task as specified would write a state the canonical
`work/node@2` schema rejects, and would conflate two meanings the core doctrine keeps
apart on purpose. Recording the finding here instead, per the fmt/5 schema-ownership rule.

## What is actually true

Four premises in the assignment do not hold against this tree:

1. `schemas/work-layout.yaml:80` permits **three** leaf states, not four:
   "Only leaves author state: uninvestigate, todo or done." `suspended` is not among them.
2. The sentence "a state with no producer is vocabulary, not a state" **does not exist**
   anywhere in the repo (`grep` over all files, excluding node_modules: no match).
3. `examples/todo-app/` **does not exist** — there is no such example, so there is no
   "exact shape to match" for a `suspended` block.
4. "Nothing in the runtime writes `suspended`" is true only of the *authored* field. The
   *derived* state is a central, reachable, tested mechanism — see below.

The one premise that does hold: `kernel/ledger.mjs:270` (`executableCandidates`) and
`:280` (`decisionCandidates`) both gate on `node.state==='todo' && node.eligible===true`.
(`executableEligible`/`decisionEligible` in `ledgerSummary` at :923 are *reporting* fields
consumed only by `goal.mjs`, `kernel.mjs` and `view.mjs`; they schedule nothing.)

## The mechanism already exists, built the other way round

"Was done, its bound input changed" is already first-class — as a **derived** state:

- `core/index.mjs:799` — `n.effectiveState = localInvalid ? 'invalid' : n.stale ? 'suspended' : n.meta.state`
- `core/index.mjs:790` — pushes `suspensionReasons: [{code:'INPUT_CHANGED', ids:[id]}]`
- also derived for `PREREQUISITE_NOT_DONE` (:802) and `CHILD_SUSPENDED` (:797)

The node keeps `state: done`, keeps `completion`, keeps `evidence`, keeps history — which
is exactly the assignment's stated requirement ("keeps its completion, its evidence and
its history — that is the whole reason it is a state and not a reset"). It is derived
rather than written **deliberately**. `core/README.yaml:111-114`:

> This authored state differs from derived suspended: when recorded done loses current
> input/prerequisite validity, the validator retains the original done/evidence on disk
> and only reports suspended in its output. Do not rewrite historical proof into an
> import record.

Authored `suspended` is a *different* concept: imported or explicitly unverified scope
awaiting owner approval. Per `core/README.yaml:105-110` it "requires no fabricated
previous completion/evidence, and never satisfies a prerequisite or contributes done" —
"a business inferred from code is an observation awaiting owner approval". It requires a
concrete `suspensionReason`, enforced at `core/index.mjs:423` (`SUSPENSION_REASON`).

That is why `schemas/work.schema.yaml:1298-1308` restricts `work/node@2` — the canonical
format — to `[uninvestigate, todo, done]`. The seven-value enum at :1138 is the union
across v1 and v2; `suspended` is authorable only on legacy `work/node@1`.

## Why step 2 is unsafe

`kernel/ledger.mjs` writes `work/node@2` (module header, :10: "the only ledger API the
workflow kernel uses"). So `markReopened` writing `state:'suspended'` would:

- produce nodes the canonical `@2` enum rejects — every reopened node fails validation;
- additionally trip the `allOf` at :1283 requiring `suspensionReason` on `suspended`;
- overwrite proven history into the import-record meaning the README forbids;
- be redundant: a reopened node whose input moved *already* reports `suspended` via `n.stale`.

`markReopened` writing `todo` is not the erasure the assignment describes. The difference
between "never done" and "was done, its input changed" is preserved by `completion` and
`kernel.reopened[]` remaining on the node, and re-derived by the validator.

## The real gap, and the decision needed

There *is* a genuine bug adjacent to the diagnosis. A node whose bound input changed has:

- `state: 'done'` (retained on disk, correctly)
- `effectiveState: 'suspended'`, `eligible: true`

Because both candidate filters gate on `state==='todo'`, such a node is **never offered**.
Re-verification work is genuinely unscheduled. But the fix belongs on the **derived**
signal, not the authored field:

> admit `effectiveState==='suspended'` with a non-empty `suspensionReasons` into the
> candidate lanes, tagged as re-verification, while continuing to gate authored
> `state==='suspended'` out of the executable lane.

Admitting *authored* `suspended` instead would schedule re-authoring of unapproved
imported scope as if it were re-verification of proven work — the inverse of the intent.

**No schema change is required for that fix**, so there is no block to hand to fmt/5.
What is needed is a decision from the owner of this design:

- (a) implement the derived-signal fix above (`effectiveState`-based, re-verification tag,
  no schema change, no change to `markReopened`); or
- (b) if authored `suspended` really is wanted as a kernel-written state, that is a
  `work/node@2` enum change owned by fmt/5, and it must first reconcile with
  `core/README.yaml:105-114` and `schemas/work-layout.yaml:80`, which currently define
  authored `suspended` as meaning something else.

Option (b) cannot be coded against "the shape in the example" because that example does
not exist.
