# Lane v7-7 — ecommerce-app-be evidence re-proof (Phase 2)

Date: 2026-09-19 (UTC). Scope per brief: `examples/ecommerce-app-be/.starciwork` — **every
`evidence.yaml` except `ui/**` (v7-10) and `uat/**` (v7-12)** = 8 files. Writes stayed inside those
8 files plus this report and `ex-testing/lint/scratch/v7-7-*`; no `index.yaml`, no product source,
no `packages/**`, no other lane's tree.

**Result: the 8 in-scope evidence files are regenerated from real runs, `outcome: pass`, zero
`stale: true`, and the gate refuses 0 of them.** ec-be's only remaining refusals are 6 `ui/**/assets/*.yaml`
payload-id refusals (v7-5's documented honest residual, inside v7-10's scope).

---

## 1. Phase discipline (why the timing looks odd)

Markers awaited: `done/v7-2.done`, `v7-3.done`, `v7-4.done`, `v7-5.done`. Polled every 45–60 s from
**11:25:35Z** across 7 bounded wait invocations — **98 poll rounds logged**, last recorded round
12:43:09Z, budget expiry 12:52Z — in `ex-testing/lint/scratch/v7-7-wait.log`.

| marker | landed |
| --- | --- |
| v7-2 | 11:37:06Z |
| v7-3 | 11:47:35Z |
| v7-5 | 11:47:44Z |
| v7-4 | **12:46:44Z — after my last poll round; the regeneration was already running** |

At **12:55:35Z** the brief's 90-min timeout lands. The last logged poll round is 12:43:09Z with
v7-4 still missing, so I proceeded on the brief's fallback and started the regeneration at
**12:44:22Z** — 11 minutes inside the budget's tail. What happened next removes the residual risk
outright: **v7-4 landed at 12:46:44Z, mid-regeneration**, and its marker shows every one of its
edits in the todo tree; `examples/ecommerce-app-be/.starciwork` had **no non-`ui` `index.yaml`
touched after 11:35:59Z** (mtime sweeps at 12:43:09Z and again after regeneration). I then re-ran
the gate *after* v7-4 landed — 12:54:19Z, 12:58:40Z and 13:06:33Z — each time with **0 evidence
refusals in my scope**, so no second re-proof was needed. Regeneration pass: 12:44:22Z–12:49:43Z,
plus `fr.checkout.place-order` re-run at 13:04:16Z (see §4).

## 2. What was on disk when I arrived (and why I did not trust it)

Gate baseline at 11:22Z: `295 record(s), 2518 ref(s), 114 evidence file(s): 134 refused, 4 warned` —
**134 refused, all 134 in `todo-app-backend`; zero in ec-be.** All 8 ec-be evidence files had been
rewritten by `scripts/example-evidence.mjs` at **10:00:29Z–10:04:17Z**, i.e. before any phase-1
marker existed (v6-4's 8 `CODE_DIGEST_STALE` refusals were gone). So the digests matched the tree
that existed at 10:04, not the tree phase-1 was building — exactly the ordering this lane exists to
fix. Rather than assume the 10:04 files were truthful, I re-ran every command myself.

**Independent replay audit** (`ex-testing/lint/scratch/v7-7-replay.cjs` → `v7-7-replay-unit.jsonl`,
`v7-7-replay-e2e.jsonl`), 11:28Z–11:34Z, from the ec-be cwd. The point is non-vacuity: `jest -t <pattern>`
exits **0** when the pattern matches nothing, so a recorded `exit: 0` proves nothing by itself. Every
command's jest summary is captured:

| # | command (verbatim from evidence) | exit | jest summary |
| --- | --- | --- | --- |
| U1 | `npx jest -t ac.checkout.place-order.empty-cart-is-refused --runInBand` | 0 | Tests: 2 passed, 207 skipped, 209 total |
| U2 | `npx jest -t ac.checkout.place-order.stock-is-checked-at-confirmation --runInBand` | 0 | Tests: 2 passed, 207 skipped |
| U3 | `npx jest buyer.controller.spec --runInBand` | 0 | Tests: 2 passed, 2 total |
| U4 | `npx jest order.client.spec --runInBand` | 0 | Tests: 10 passed, 10 total |
| U5 | `npx jest -t fr.checkout.place-order --runInBand` | 0 | Tests: 2 passed, 207 skipped |
| U6 | `npx jest -t sds.checkout.order-flow --runInBand` | 0 | Tests: 41 passed, 168 skipped |
| U7 | `npx jest -t t-refuse --runInBand` | 0 | Tests: 4 passed, 205 skipped |
| U8 | `npx jest -t ac.identity.sign-in.known-pair-issues-a-session-token --runInBand` | 0 | Tests: 1 passed, 208 skipped |
| U9 | `npx jest -t ac.identity.sign-in.wrong-pair-is-refused-alike --runInBand` | 0 | Tests: 1 passed, 208 skipped |
| U10 | `npx jest -t fr.identity.sign-in --runInBand` | 0 | Tests: 1 passed, 208 skipped |
| U11 | `npx jest src/modules/bussiness/order … src/features/checkout --runInBand` | 0 | Test Suites: 14 passed, 14 total; Tests: 78 passed |
| U12 | `npx jest src/modules/bussiness/account … src/features/identity --runInBand` | 0 | Test Suites: 11 passed, 11 total; Tests: 59 passed |
| E2 | `npx jest --config src/tests/e2e/jest.config.js "order-lifecycle\|checkout/payment-failure\|checkout/checkout-journey\|identity/sign-up-sign-in"` | 0 | Test Suites: 5 passed, 5 total; Tests: 8 passed |

E2 covers all four recorded e2e commands: each is a subset of that path-pattern, every spec boots its
own run-owned compose project (`src/tests/infra/platform/stack/e2e-stack.service.ts`), and jest exits
0 only if every matched suite passed. Per-suite: `order-lifecycle/cross-service-identity` 22.3 s,
`identity/sign-up-sign-in` 19.6 s, `checkout/payment-failure` 6.5 s, `order-lifecycle/order-history`
7.0 s, `checkout/checkout-journey` 7.5 s — all PASS. No conditional-skip guard exists on these specs
(only `resilience/*.e2e-spec.ts` self-skip when docker is down, and none is cited here), so a passing
suite is real work. No `ec-e2e-*` container or volume survived the run (`docker ps -a`, `docker volume ls`).
Docker daemon: 29.5.2.

**Verdict on the 10:04 evidence: truthful but prematurely binned.** No fabricated arm, no vacuous
`-t`, no `stale: true` escape. The only defect was the one the phase-1 wait exists to prevent —
v7-2's record edits at 11:29–11:36Z moved 5 of the 8 `recordDigest`s.

## 3. Brief step 1 — the digest refusals collected in scope

At 11:23Z: 0 (the 10:04 regeneration had cleared v6-4's 8). After v7-2 landed, gate at 11:56Z
(`v7-7-gate-2.txt`) reported exactly **5** in my scope — verbatim:

```
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/br/place-order/evidence.yaml: recordDigest 079672eda2b3aa0b3ae34b6575f5095c2e34a085d7dcb03cecf09d3365ced52f no longer matches br.checkout.place-order's current digest 88476273ac70ac482e7d66c3f9ff74be39118388da647144d4e91f93b4794839; refused unless it carries stale: true
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/contract/order-for-identity/evidence.yaml: recordDigest 7fc74198773d3729a9ea1f15f617d712174f0f59e59c84b2a5ac1f527c3a0853 no longer matches contract.checkout.order-for-identity's current digest aff856b8335f392308fe7f28bae74cb8beaccf402aa1f59a4edb1682fb1c49c6; refused unless it carries stale: true
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/fr/place-order/evidence.yaml: recordDigest 39f173bcc7dce1ac27465cad4ceac68a701003c9267812a2863387c7b372d2e1 no longer matches fr.checkout.place-order's current digest 0e43c3b75e56f5a951d678df6dd512f6a72e3fa47ce3ecd20a0dec58b8eb8df5; refused unless it carries stale: true
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/sds/order-flow/evidence.yaml: recordDigest 7eff66ea99da9a8136b3f714caad5b496abec3f2ab713407011f7641cd4ec11f no longer matches sds.checkout.order-flow's current digest 762388603ac2c492ce6dfa3443e614ab549d21a8fede592a4ba5b985b46abd9a; refused unless it carries stale: true
REFUSED examples/ecommerce-app-be/.starciwork/features/identity/fr/sign-in/evidence.yaml: recordDigest 386f244787bc7237ac991b8ff040672117947a751e5981ce3f54d9a92f5a2bda no longer matches fr.identity.sign-in's current digest cc71b69107d1060e4ce8170c0f72292ce99dd35d248c1bc4d889e2638c0c2f2f; refused unless it carries stale: true
```

That matches v7-2's own hand-off line — *"5 expected recordDigest refusals await the evidence lane"* —
so the count, not just the kind, is corroborated from both ends. No `CODE_DIGEST_STALE` remained: the
`apps/*`→`src/*` owner rewrite happened at 09:54Z, before the 10:04Z regeneration.

## 4. Step 2 — the re-proof (what I changed)

`node ex-testing/lint/scratch/v7-7-reprove.cjs` (log: `v7-7-reprove.log`) ran
`node scripts/example-evidence.mjs --work examples/ecommerce-app-be/.starciwork --record <id> --cwd examples/ecommerce-app-be --assert …`
once per record, from `.claude/`, re-executing every command for real. All 20 assertions in that pass
exited 0; the later `fr.checkout.place-order` re-run wrote a 4-arm file (all exit 0), taking the
in-scope total to **21 arms, every one exit 0**. Every file reports `outcome: pass`,
`provenance.actor: example-evidence`. Nothing was hand-edited and no digest was typed in.

Final state of the 8:

| record | arms | exits | codeDigest files | code digest | outcome |
| --- | --- | --- | --- | --- | --- |
| br.checkout.place-order | 3 | 0,0,0 | 14 | `583b0dfbd116…` | pass |
| contract.checkout.order-for-identity | 3 | 0,0,0 | 56 | `8225cac6fb41…` | pass |
| fr.checkout.place-order | 4 | 0,0,0,0 | 56 | `8225cac6fb41…` | pass |
| impl.checkout.ecommerce-app-be.order-checkout | 2 | 0,0 | 56 | `8225cac6fb41…` | pass |
| sds.checkout.order-flow | 3 | 0,0,0 | 18 | `7c2e18f0d629…` | pass |
| br.identity.sign-in | 2 | 0,0 | 13 | `d848f1c9c882…` | pass |
| fr.identity.sign-in | 2 | 0,0 | 43 | `8c17c94e44d0…` | pass |
| impl.identity.ecommerce-app-be.identity-account | 2 | 0,0 | 43 | `8c17c94e44d0…` | pass |

Assertion-set deltas (both **additive**, both closing a hole v7-2's rev-2 record edits opened; every
added command was run and verified before it was written):

1. `fr.checkout.place-order`: the arm `e2e` now runs the command the record itself declares as
   required proof, `npx jest --config src/tests/e2e/jest.config.js checkout/checkout-journey`. The
   pre-existing command was kept as `e2e-refusal-paths` (`order-lifecycle checkout/payment-failure`),
   so nothing previously claimed was dropped. Before this, no arm in the file ran the record's own
   `requiresProof.e2e.command`.
2. `fr.checkout.place-order`: added `flow-unknown-product` = `npx jest -t unknown-product --runInBand`
   (1 real test: `checkout-refusal.spec.ts:52` "unknown-product answers 400 BAD_REQUEST naming the
   product"), covering the `unknown-product` exception flow v7-2 added to that fr at rev 2.
3. Everything else — 19 of the 21 arms — carries verbatim the command already on record, one of them
   under a renamed id (item 1), so no previously recorded proof was dropped by this lane.

Post-hoc replay of two regenerated files through the official replay tool
(`scripts/example-verify.mjs`, outputs `v7-7-verify-1.txt`, `v7-7-verify-2.txt`):

```
br.identity.sign-in: verified - every assertion replayed with a matching outcome
fr.checkout.place-order: verified - every assertion replayed with a matching outcome
```

## 5. Brief step 4 — gate after re-proof

```
313 record(s), 2661 ref(s), 120 evidence file(s): 120 refused
```

The closing run at 13:13:16Z (`v7-7-gate-close.txt`) reads `… 90 refused` — todo-be kept dropping
refusals while this lane finished (v7-6 still in flight). Across all four post-re-proof runs (12:54Z,
12:58Z, 13:06Z, 13:13Z) the ec-be evidence-file refusal count is **0** and unchanged.

* In-scope digest refusals (`CODE_DIGEST_STALE` + `RECORD_DIGEST_STALE`) in ec-be: **8 → 0**
  (v6-4's count was 8; mid-lane 5; now 0).
* All remaining ec-be refusals, verbatim (none is `evidence.yaml`; all are inside `ui/**`, v7-10/v7-5):

```
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/cart/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.cart.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/landing-home/assets/direction-check.yaml: id is undefined, but its place says ui.checkout.landing-home.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/landing-home/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.landing-home.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/shop-browse/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.shop-browse.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/stock-refused/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.stock-refused.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/identity/ui/sign-in/assets/generation-receipts.yaml: id is undefined, but its place says ui.identity.sign-in.assets
```

* Tree-wide warnings: **0** (4 at my 11:23Z baseline; v7-4's blocker-rooting removed the rest). The
  other 114 refusals are all in `todo-app-backend` (v7-6 re-proof in flight, v7-9 render captures) —
  outside this lane.
* Out-of-scope observation in the same tree, for v7-10/v7-13: the 5 `ui/**/evidence.yaml` written at
  11:49–11:50Z each carry `outcome: fail` with raw exits `0,1,1`. That is honest raw-exit recording,
  not a v7-7 finding; those ui records are not `done`, so the gate raises no refusal on them.

## 6. What I could NOT prove, and why

1. **`fr.identity.sign-in` rev-2 exception flow — "a registration needs a plausible email and a
   password of at least 8 characters; anything less is refused before any account work".** The code
   does enforce it (`src/features/identity/graphql/mutations/session/register/register.resolver.ts:40`
   → `if (!email.includes("@") || password.length < 8)`), but **no test in the repository exercises
   that branch**: `register.resolver.spec.ts` has exactly two tests ("registers a fresh visitor…",
   "a taken address is EMAIL_TAKEN, nothing else"), and the e2e journey
   (`src/tests/e2e/identity/sign-up-sign-in.e2e-spec.ts`) registers only with a valid
   `e2e-journey-pass-1` pair. There is therefore **no replayable command that could back the claim**,
   so no arm was written for it — a proof I cannot run is not evidence. Authoring the missing spec is
   a product-source change, outside the fleet's "keep edits inside `.starciwork`" boundary. Left as a
   gap for v7-13 (and v7-2, as the record's owner): either the spec lands, or the claim comes off a
   `done` record.
2. **`sds.checkout.order-flow` `requiresProof.transitions.forEach: stateMachine.transitions` is not
   machine-checkable, and its arm named `transitions` does not literally satisfy it.** The arm runs
   `-t t-refuse`, and `t-refuse` is **not** one of the five declared transition ids (`t-verify`,
   `t-add`, `t-stock`, `t-pay`, `t-confirm`) — it is a test name in `checkout.policy.spec.ts:139`.
   The five transitions *are* covered, but by the sibling arm `implementation`
   (`-t sds.checkout.order-flow`, 41 real tests across every transition's describe block). I kept the
   arm ids as recorded rather than renaming them, because a rename changes nothing the gate reads and
   v7-8's derived rebuild is running against these files right now. Flagged for v7-14 if the fleet
   wants assertion ids that name what they prove.
3. **`br.checkout.place-order` AC `becomes-a-buyer` is bound by path, not by name.** Its arm is
   `npx jest --config src/tests/e2e/jest.config.js order-lifecycle` — a path pattern. No test anywhere
   is named `ac.checkout.place-order.becomes-a-buyer`; the behaviour is asserted inside
   `order-lifecycle/order-history.e2e-spec.ts` ("a buyer placing several orders builds a confirmed,
   paid history both services can read"), which does call `GET /internal/buyers/:personId` and expect
   `hasOrders` true (lines 117, 272–283). Real proof of the AC, but the AC→test link rests on reading
   the spec, which no check verifies (v6-4 §Q2: `assertions[].id` is never ref-checked).

## 7. Record↔code contradictions

* **Found and already resolved by its owner** (so my evidence proves the corrected text):
  `contract.checkout.order-for-identity` claimed `GET /buyers/:personId` while the provider is
  `@Controller("internal/buyers")` (v6-3 finding 4). I read the wrong-path version at 11:26Z; v7-2
  fixed it at 11:34Z as rev 2 `kind: clarifying` with the reason naming the code as truth. The
  record's new refusal taxonomy (`404` = the honest no-orders answer, non-200/timeout =
  `ORDER_SERVICE_UNAVAILABLE`, off-shape 200 = `ORDER_CONTRACT_MISMATCH`) **is** covered by the arms I
  re-binned: `npx jest order.client.spec --runInBand` runs the six consumer tests that assert exactly
  those branches (`order.client.spec.ts:154,173,186,209,221,233`), and `buyer.controller.spec` covers
  the provider's "not a 404" rule.
* **Left in place (not mine to edit, v7-2's family):** `br.checkout.place-order` changed a normative
  statement's wording ("Idempotency-Key" → "idempotency key") while keeping
  `change: {rev: 1, kind: initial}` — no rev bump. Invisible to this gate (v6-4 §Q4), and `work-change`
  cannot classify it in place because the tree keeps no baseline. Cosmetic in content, but it is the
  pattern that makes rev pins silently wrong.
* **No digest-vs-code contradiction remains in scope**: every `files[]` entry in all 8 evidence files
  is a path that exists on disk right now, and per the brief's "watch for" item — **0 of the 8 pin any
  `apps/…` path** (counts: 14/56/56/56/18/13/43/43 files, `on-disk-missing: 0` in each), because the
  regeneration recomputed them rather than anyone editing a digest.

## 8. Reproduce

```bat
:: gate + scope counts
node scripts/check-example-work.mjs
:: independent replay of every distinct in-scope command (non-vacuity)
node ex-testing/lint/scratch/v7-7-replay.cjs unit
node ex-testing/lint/scratch/v7-7-replay.cjs e2e
:: the re-proof itself
node ex-testing/lint/scratch/v7-7-reprove.cjs
:: official replay of a regenerated record
node scripts/example-verify.mjs --work examples/ecommerce-app-be/.starciwork --record fr.checkout.place-order --cwd examples/ecommerce-app-be
```

Artifacts kept under `ex-testing/lint/scratch/`: `v7-7-gate-1.txt`/`.code` (11:22Z baseline),
`v7-7-gate-2.txt` (mid-lane, the 5 recordDigest refusals), `v7-7-gate-3.txt`, `v7-7-gate-final.txt`,
`v7-7-gate-final2.txt` (post-v7-4), `v7-7-gate-close.txt` (13:13Z closing run),
`v7-7-wait.ps1`/`v7-7-wait.log` (phase-1 polling),
`v7-7-replay.cjs` + `-unit.jsonl` + `-e2e.jsonl`, `v7-7-probe.cjs`, `v7-7-reprove.cjs` + `.log`,
`v7-7-verify-1.txt`, `v7-7-verify-2.txt`, `v7-7-inventory.txt`, `v7-7-ev-summary.txt`.

## 9. Hand-off

* v7-8 (`_derived` rebuild): ec-be evidence changed at 12:44–13:04Z after v7-2's records — rebuild
  `ecommerce-app-be/.starciwork/_derived/` against these files (its `_derived/index.yaml` was last
  written 12:56Z, i.e. before my `fr.checkout.place-order` re-run at 13:04Z).
* v7-13 (closer): the only unprovable claim in ec-be is §6.1 (`fr.identity.sign-in`'s register
  precondition — code enforces it, no test exercises it). §6.2/§6.3 are link-strength nits, not lies.
* v7-2: your rev-2 churn is fully re-binned; your contract-path fix is now backed by evidence that
  proves the taxonomy you wrote. `br.checkout.place-order` still carries `rev: 1` after a normative
  edit (§7).
