# A4 dry run 1 — `business.decide` on `pro-subscription`

Date: 2026-09-02. Backend head `0b540dd2` (working tree dirty). Businesses root
`starci-academy-backend/.worktrees/businesses` (its own git worktree, branch `codex/businesses/starci-academy`).
Objective: revise the Pro subscription promise from its `pending` head toward `in-progress`.

Both artifacts pass the operator's validators; a copy with a broken `operatorId` is rejected with
`$.operatorId: expected "business.decide"`, so the green is a measurement: [input.json](input.json),
[output.json](output.json).

## What was bound

| Binding | Value | How it was obtained |
| --- | --- | --- |
| Backend source head | `0b540dd21e250a346e6206c70225849cc31ead8e` | `git rev-parse HEAD` |
| Business head | `sha256:eccaeaad…` state `pending` | `business-registry-v1.json` → `featureHeads.pro-subscription.head`, `authorityStatus` |
| Fact claims | 8, each with path and line range read from `git show HEAD:<path>` | settlement idempotency and unpaid path, reconcile decision, grant dispatch, three membership-gated consumers, AI quota |
| Unknown claims | 5, `sourceHead: null` | offer entry, read entry, purchase, expiry, cancellation: all in untracked directories |
| Discovered consumers | 7 | AI entitlement, global chat, community quota, blog gate, reconcile worker, courses checkout, course refund |
| Lifecycle branches | expiry, cancellation, recovery, legacy-settle | from the head's `states` and `migration` sections |

## Outcome

`blocked` · `EVIDENCE_MISSING` · owning domain `backend` · retryable.

Every Pro-specific enforcement lives only in three untracked directories
(`mutations/pro-subscription/`, `queries/pro-subscription/`, `modules/bussiness/pro-subscription/`),
so no fact claim can bind them to a head, and a `fact` claim without a head is invalid input by the
operator's own rule. At the bound head, `grantForTransaction` dispatches only `AiSubscriptionPurchase`,
`MembershipPurchase`, and `Enroll`, and the three entitlement consumers found read
`membershipService.isActive`, not a Pro subscription. The promise the head describes is therefore not
yet enforced by any committed source, which is exactly the "true in the offer, false at the guard"
failure the operator exists to refuse.

## Findings about the skills tree, not the product

1. **Head layout drift.** The v8 contract pins `businessesRootRef` to `…/.worktrees/businesses` and
   requires a head at exactly `<root>/<featureId>`, one flat segment down. The real root stores
   `features/<featureId>/model.json`, a content-addressed `objects/sha256/` store, a
   `business-registry-v1.json` map of feature heads, and `history/by-id.json`. Fourteen features
   already live in that shape. The contract was written without reading the root; the root is the
   authority, so the contract, its two schemas, and its self-test must adopt `features/<featureId>`
   and the registry as the head index. Until then every real invocation carries a `headRef` that
   validates and does not exist.
2. **Root discovery is unowned.** `workspace.bind` binds a route, a checkout, git policy, write roots,
   and runtime; nothing in v8 produces `businessesRootRef`. The value in this input was typed by hand.
   Either the route grows a `businessesRootRef` derived from the backend checkout, or
   `business.decide` derives it from the routed `gitRoot`; one of the two must own it.
3. **Content-addressed authority binds even when uncommitted.** The business head is untracked in
   its worktree (`?? features/pro-subscription/`, `?? objects/sha256/eccaeaad…`), yet its content hash
   is a real fingerprint, so `context.authority` binds cleanly. Source facts cannot do the same,
   because a line range means nothing without a commit. The asymmetry is correct and worth stating
   in `context.md`.

## Closed since this run

Finding 1 closed by `3aaada85`: contract, both validators, and the self-test name heads at
`features/<featureId>`; `input.json` and `output.json` here already carry that shape and validate
against the live package. Finding 2 closed by `6aa4d3b8`: `workspace.bind` derives
`route.authorityRoots.businesses` from the checkout and rejects a typed value that disagrees. Finding 3
is stated in `business.decide/context.md` through the registry description.

## Facts for the product owner

- The Pro subscription backend work is uncommitted on `mtp`: three new directories plus edits to the
  reconcile worker, grant service, AI entitlement, chat policy, community quota, and blog gate.
- The Pro business head is uncommitted in the businesses worktree, together with `course-advisor` and
  `course-community` heads and two objects; the registry and history files are modified.
- At head `0b540dd2` no committed consumer grants anything on a Pro subscription.

Nothing here was changed by the dry run.
