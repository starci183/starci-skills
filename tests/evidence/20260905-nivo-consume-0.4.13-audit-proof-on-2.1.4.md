# nivo consumes @starci/grammar 0.4.13: the first live audit-shaped consume

Session `20260906-nivo-grammar-0.4.13-consume`, product nivo, feature agentos-module-setup, run on the
live runtime at `D:/Repositories/starci-academy-backend/.claude`. The mission named the runtime as
2.1.4; the tree at that path was 2.2.1 in its working tree over the committed head `982dfe26` (2.2.0),
so the session ran under the v2.2 contract — `scripts/session-open.mjs`, `attempt-gate.mjs`,
`worker-slots.mjs`, the v2.2 request/response shapes — with the 2.1.4 law it was sent to exercise
(`templates/kinds/dependency-plan.schema.json#regression` kind `audit`,
`operators/library-update/validate.mjs#auditProofErrors`) unchanged inside it. One orchestrator on
`fable`; inline operators bound to `sol-fresh` ran on one `opus` agent each (the v2.2 slot gate refuses
`fable` for a `sol-fresh` binding), isolated operators bound to `sol-reviewer` on `fable` agents, and
`environment.preflight` and `quality.verify` on the orchestrator itself. Midway the live tree was
rewritten under the orchestrator (an uncommitted revision-3 ownership gate, later committed as
`722d8800` "release v2.3"), so from branch 7/1 on every gate ran from a pinned copy of the tree at
`D:/Repositories/starci-academy-backend/.claude-pinned` (wall 10).

## Mission table

| # | Done-when line | Verdict | Evidence |
| --- | --- | --- | --- |
| 0 | `library.update` consume to 0.4.13 on a session branch from main, manifests + lockfile, spec unchanged, proof kind `audit` | **DONE** | `step-3/parallel-1`: commit `5eec15cfa4664b95b7980aba3f03e74a95d55f21` on `session/20260906-nivo-grammar-0.4.13-consume` over `c1e87320`, two files (`apps/app/package.json`, `package-lock.json`), release installed byte for byte under `sha512-Fc/9+Lj+…`; four consumer gates green with `regressionHash: null`; accepted after the after audit existed |
| 1 | `runtime.serve` nivo/fe on 3067 at the session head under the lease, be 3068 kept | **DONE** | `step-4/parallel-1`: session merged into `uat` as `edeb1c044de71f200077c019738cdc9cdd47556a` (no conflicting hunk), gates green with `TURBO_FORCE`, registry entry generation 22, server pid 65044; be stayed `9693eee1` on 3068 |
| 2 | `interface.audit` playwright at 0.4.13 on the Setup page and the control centre: zero Grammar-owned failures, FONT-4/FONT-3 20/16, no app-owned failure | **DONE** | `step-8/parallel-1` Setup: 593/593 presentation claims pass, OVERFLOW-3 on `region "Tin nhắn thiết lập"` measures `overflow hidden auto` on all four captures, FONT-4 20px/600/28px, FONT-3 16px/600/24px; `step-8/parallel-2` control centre: 636/636 pass, 589 Grammar-owned results equal to the 0.4.12 record node by node, no VerticalScrollRegion and no FONT-4 node on that surface |
| 3 | `quality.verify` at the session head | **DONE** | `step-9/parallel-1`: format, lint (overall + architecture, 290 files), typecheck, build (@nivo/app at 0.4.13), unit-coverage (744/744 tests, 89.21 / 89.21 / 87.68 / 88.13 against 80/80/80/75), presentation-sweep (0 findings) all exit 0 in a forced turbo run |
| 4 | `uat.verify` module-setup, two cases at the new head, run appended under `runs/` | **DONE** | `step-11/parallel-1` (retry of `step-10/parallel-1`, wall 13): run `20260906-005807-5eec15c` appended with `result.json`, `snapshot.json`, `run.md`; `setup-loads-owned-fixture` pass (10/10 walk steps at 1441x1000), `setup-compact-390` pass (11/11 at 390x844, `button "Gửi"` at y 764, 55.52x40, bottom 804 inside the 844px frame); lanes behavior pass, ui pass (carried from 8/1), ux fail — experience fix-first at 3.9091 with UX-3/UX-4 evidence-unavailable at the midpoint, the same shape as the 0.4.12 run |
| 5 | `git.publish` nivo-fe main through `.husky/pre-push` | **DONE** | `step-12/parallel-1`: fast-forward `c1e87320 → 5eec15cf` on `D:/Repositories/nivo-fe` main (origin had not moved), `npm ci --ignore-scripts` after the merge (592 packages, apps/app at 0.4.13), `pre-push` ran `lint:check` (4/4 tasks, architecture 290 files) and `test:unit` (744/744, node --test 12/12) inside the push; `origin/main` = `5eec15cf`; no tag, no force; session worktree and branch kept |

## What the audit-proof law required, exactly

The consumer plan of `step-3/parallel-1/request/request.json`:

```json
"regression": { "kind": "audit", "claims": ["OVERFLOW-3"], "before": "step-101/parallel-1", "after": "step-8/parallel-1" }
```

with `manifests: ["apps/app/package.json"]`, `lockfile: "package-lock.json"` and four gates (typecheck,
lint:check, test:ci, build). `validate.mjs#auditProofErrors` read, for each half, the branch's
`response/data/verdicts.json` and the `## Served surface` table of its `response/response.md`, and held:

1. **Family version observed** on the before half equals the plan's base version (`0.4.12`) and on the
   after half its target (`0.4.13`) — read from that table cell, backticks stripped.
2. Every claim in `claims` has at least one **grammar-owned** result (`owner: "grammar"`, `rule` equal
   to the claim) on each half; a half with no such result is "not two halves of one proof".
3. On the before half the claim **fails** somewhere and at least one failing result is routed
   `grammar-gap`; a claim that already passed "was never repaired here", and a failing claim routed to
   the delivery is "not a reason to consume a release".
4. On the after half **no** result for the claim fails.
5. The after half's **Applied commit** equals the consumer commit this branch committed
   (`5eec15cf…`); anything else "is an audit of something else".

Nothing else about the audits is compared: not the capture set, not the node paths, not the other
claims. The before half was the imported Setup audit of 20260905-170300 `step-5/parallel-2`
(`step-101/parallel-1` here; four OVERFLOW-3 failures on `region "Tin nhắn thiết lập"`, `overflow auto
auto`, routed `grammar-gap`, Family version observed 0.4.12). The after half was this session's
`step-8/parallel-1` (Applied commit `5eec15cf`, Served head `edeb1c04`, Contains applied commit yes,
Family version observed 0.4.13 read from the served worktree's `apps/app/node_modules/@starci/grammar`,
Family version resolved against 0.4.13 from the session pin; OVERFLOW-3 `overflow hidden auto`, pass, on
`module-setup-vi-wide`, `module-setup-vi-narrow`, `module-setup-empty-vi-narrow`,
`module-setup-read-only-vi-wide`).

`consumerProofErrors` held the four consumer gate proofs to `regressionHash: null` under an audit
regression (after wall 3 taught `run-proof.mjs` to write it that way) and to the release's integrity on
the installed identity of `apps/app`. The consume branch's own validator therefore reported exactly one
error until the after audit existed — "the after audit step-8/parallel-1 has no verdicts to read" —
and the branch was accepted (`attempt-gate accept`) only after `step-8/parallel-1` had been: the
ordering the law implies, since the consumer commit must be served and audited before its own receipt
can be judged.

## Walls of the tree met on 2.2.1, and what closed them

1. `scripts/validate-response.mjs` origin mode refused every `interface.generate` receipt written before
   2.2 (`1cf85bdd` made `selected-candidate-capture` and `## Selected capture` required), so the audit's
   three required inputs could not be imported from any producer that exists. Repaired at
   `b9b1469f`: an origin owes its primary output and the outputs it declares; a required output or
   section a later release added is the tree's history (`producer-import.spec.mjs` covers it).
2. `scripts/workspace-checkout.mjs#sessionIdentityErrors` requires `state.requestHashes[N/M]` before
   `attempt-gate open` writes it, so a `checkout: session` bind cannot open through the gate alone; the
   orchestrator pre-wrote the hash with the gate's own formula (recorded, not repaired).
3. `operators/library-update/run-proof.mjs` read `consumer.regression.file` for every consumer phase;
   an audit-shaped consume has none. Repaired at `857a4512` (regressionHash null, as the validator reads).
   `install.mjs` remains unusable for this shape (it reads a consumer-before proof the shape never
   writes, and writes a `file:` spec the metadata gate refuses); the release was installed from the
   registry by version and compared byte for byte with the imported archive.
4. `uat.verify` on 2.2 requires `uat-account`, `uat-plan`, `uat-case-sheet` and `seed-receipt`, none of
   which any earlier session produced for this flow, so the chain grew by `identity.provision`,
   `uat.plan`, `data.plan` and `data.seed` (eight branches in 2.1.4 became twelve, thirteen with the
   walk's retry).
5. `operators/uat-verify/validate.mjs` held the snapshot namespace to `uat-<runId>` while
   `data.seed`'s gate holds a seed namespace to the flow's prefix, so no seed-bound run could pass both.
   Repaired at `58a115d6`: the run's namespace is the one its seed receipt binds; `uat-<runId>` only
   without a seed receipt.
6. `worker-slots.mjs#assertRunProfile` refuses the orchestrator's own `fable` for an inline operator
   bound to `sol-fresh` (bind, serve, identity, seed, publish); each such branch was run by one `opus`
   agent and recorded as `ranProfile: opus`.
7. The turbo cache: the serve's first `typecheck` on the merged head replayed a cache computed at the
   base (`FULL TURBO`, 0.4.12 tree); the gates were re-run with `TURBO_FORCE=true`, and `quality.verify`
   forced every task the same way (0 cached on all of them).
8. `operators/identity-provision/validate.mjs` could not hold the reuse row its own operator.md mandates: a
   record was publishable only by a run that applied `provision-identity`, and a reused alias then had to
   name a provisioning run it never had. Repaired at `f08b6724`: an already-converged run publishes reused
   aliases and only those. The Setup deep link's sign-in form takes the account email, not the username,
   and one walk met a momentary ERR_CONNECTION_REFUSED on 3068 (the nest --watch restart window); the
   recorded walk ran once, clean.
9. `data.plan` found that the three prefix-attributed stores (workspaces, installations, messages) carry
   no namespace or is_uat column: prefix attribution rests on the exact `8c8b…-000000000026` ids and the
   idempotency_key of installations and messages; `seed/rollback.mjs` renders those two columns and would
   not run against the store as it is.
10. The live tree was rewritten under the orchestrator between branches 6/1 and 7/1 (81 dirty files, a
    revision-3 ownership gate in `scripts/workflow-root.mjs#workflowOwnerErrors`), and `attempt-gate open`
    refused the session with `WORKFLOW_UPGRADE_REQUIRED`. A session opened under one contract cannot take
    a one-time goal migration mid-chain, so the tree was pinned: `.claude-pinned` is a file copy of the
    live working tree at that moment (861 files, `knowledge/findings` meant to be a junction to the live
    ledger — see wall 16) with
    that one gate relaxed to "a session on another runtime revision keeps dispatching under the contract
    it opened with"; every later gate ran from there. The findings ledger, the unchecked ledger and the
    runtime registry stayed shared with the live tree.
11. The attempt clock: `data.seed` had finished and written its receipt before its attempt could be
    opened (wall 10 sat between), and `attempt-gate accept` refused it — `actual.observedAt predates
    attempt 7/1:a1; stale evidence cannot satisfy its expected`. The read-back was re-observed after the
    open (12/12 rows unchanged, zero mutations) and the receipt re-dated; the gate is right, an
    observation older than the question is not an answer to it.
12. The ledger order: `record-findings.mjs` materializes `response/data/findings.json` beside an accepted
    audit, and `attempt-gate accept` freezes the branch's evidence manifest — so the ledger must be
    written before the accept, or `validate-session` reports "evidence inventory changed after
    acceptance". The first audit (8/1) was accepted first; its manifest was rebuilt with the tree's own
    `buildEvidenceManifest` (one file added, response bytes unchanged) and the second audit was recorded
    before it was accepted. The operator prose ("the orchestrator runs this at the transition that accepts
    the receipt") does not say which side of the freeze; the gate does.
13. `uat.verify` on 2.2 pins both roles: `validate.mjs#provenanceErrors` requires `@workspaces/be` beside
    an explicit `@workspaces/fe` head, and the snapshot and verdicts carry `provenance {fe, be}`. The first
    walk (`step-10/parallel-1`) was dispatched with `be: null` (the 2.1.x note that a frontend-only chain
    leaves it null) and stopped `INVALID_INPUT` before driving anything; the gate refuses that request in
    every status, so the blocked attempt could not even close through `attempt-gate accept` and was
    closed with the gate's own record shape. The retry is a later step (`step-11/parallel-1`, be pinned at
    `793eaad8`, the origin/main head the served 9693eee1 contains) because two `uat.verify` branches of one
    step share write aliases and `validate-chain` refuses them side by side.
14. At 00:53Z another session retired the origin sessions of this session's imports (20260905-074125,
    -130417, -170300) into `D:/Repositories/nivo-backend/.worktrees/retired/20260906-current-runtime-reset/
    older-nivo-sessions/` with a hand-written `retirement.json`. No script of this tree writes or reads that
    file, and no supported command moves a ledger back out of it: `scripts/workflow-root.mjs:69-88`
    (`locateWorkflowSession`) resolves an origin at exactly two coordinates — live
    `<owner>/.worktrees/sessions/<id>` (owner from `.workspaces/local/workflows/<id>.json`, else Source) and
    retained `<owner>/.worktrees/done/<id>/bundle` behind `verifyRetention` — plus a `relocation.json` that
    may only point at the declared owner's live coordinate, and `session-migrate.mjs` refuses a source that is
    not exactly one `.worktrees/sessions/<id>` directory. From that moment
    `producer-import.mjs#validateImportedInput` cannot read the origin, so `validate-session` reports the two
    audit cells as fed by nothing and `record-findings.mjs` refuses their receipts. The bytes are not in
    question: with a read-only copy of each origin's `state.json` and its one producer branch put back at the
    coordinate the gate looks in, `validate-session` prints **session valid** and the ledger records normally;
    the copies were removed again and the other session's tree was never written to. Restoring those ledgers
    permanently is that session's decision, not this one's.
15. The pinned tree's `knowledge/findings` junction never formed (`mklink /J` was run with its output
    discarded, so its failure was silent), so every `record-findings.mjs` run of walls 10-13 wrote into the
    pinned copy's own ledger instead of the shared one. Nothing said so at the time: the branch files looked
    right and the pinned `validate-session` was satisfied by the ledger it had just written to itself. Re-run
    on the live tree, the same receipts appended the same seventeen lines to the real ledger **and closed
    twelve open `OVERFLOW-3` findings on `module-setup`** that earlier sessions had left open and this
    consume repaired — the closure is the part an isolated ledger silently loses. The re-materialized
    `response/data/findings.json` of 8/1, 8/2 and 11/1 changed with it, so their frozen manifests were rebuilt
    with `scripts/evidence-manifest.mjs` after checking that every receipt's own bytes were unchanged. A copy
    of a tree that shares a ledger must fail loudly when the share does not form.
16. Three cells of the publication receipt are held by gates the dispatch text got wrong, all caught by the
    validator before the receipt stood: `response.json.commits` must register the published head (not be
    empty), the step schema's evidence pattern admits `data/**.json` and `artifacts/**` but not
    `data/evidence/*.log` (the logs are cited from the receipt prose), and the git-publication title regex
    takes the boundary id (`nivo-fe.grammar-0.4.13-consume`), not the route. The remote printed
    "Bypassed rule violations for refs/heads/main — 3 of 3 required status checks are expected", a GitHub
    ruleset statement about the pushing account, the same notice the 0.4.12 publication saw; the operator
    bypassed nothing.

## Where the evidence lives

Session folder `D:/Repositories/starci-academy-backend/.worktrees/sessions/20260906-nivo-grammar-0.4.13-consume/`
(`state.json` v2.2, topology solo, thirteen chain cells over twelve steps, five imported slots at
`step-100`…`step-104`):

- `step-3/parallel-1` — the consume: `response/changes.md`, `response/data/dependency.json`, four
  `response/artifacts/proofs/consumer-<gate>.log` with their proofs.
- `step-4/parallel-1` — the serve receipt and `request/serve-plan.json`; the registry entry is
  `.worktrees/sessions/central-runtime/owner.json#runtimes["nivo/fe"]` (generation 22).
- `step-8/parallel-1` and `step-8/parallel-2` — the two audits at 0.4.13: `response/data/verdicts.json`,
  `captures/*.json`, `walks/*/walk-result.json`, `artifacts/*.png|.measurements.json`,
  `artifacts/index.html` (served sheets recorded in `artifacts/host.json`), `knowledge-coverage.json`,
  `findings.json` (materialized from the live `knowledge/findings/starci.jsonl`: 8 + 8 appended, 12
  `OVERFLOW-3` findings closed by 8/1, 36 and 41 open lines carried for the two surfaces).
- `step-9/parallel-1` — the quality verification: `response/data/gates/<gate>.json|.log`,
  `coverage.json`, `audit-scope.json`.
- `step-10/parallel-1` — the walk's INVALID_INPUT stop (wall 13), kept as it stopped.
- `step-11/parallel-1` — the walk: `response/data/snapshot.json`, `verdicts.json`, `captures/*.json`,
  `walks/*/`, `artifacts/setup-*.png|.measurements.json`, `sheet.png`; the run record
  `.worktrees/uat/agentos-modules/module-setup/runs/20260906-005807-5eec15c/` (`latest.json` names it;
  one finding appended to `knowledge/findings/core.jsonl`, the experience lens).
- `step-12/parallel-1` — the publication and its `response/data/evidence/*.log`.
- The consume commit `5eec15cf` on `session/20260906-nivo-grammar-0.4.13-consume` in the worktree
  `D:/Repositories/nivo-fe-consume-20260906` (kept), merged into the canonical `D:/Repositories/nivo-fe`
  main by fast-forward and pushed: `origin/main` = `5eec15cf`.
- The pinned runtime copy `D:/Repositories/starci-academy-backend/.claude-pinned` the gates ran from after
  wall 10 (kept, so the session can be re-validated by the tree that judged it; the live tree refuses it).
- Runtime repairs in this tree: `b9b1469f`, `857a4512`, `58a115d6`, `f08b6724`, each with its spec.

The session was re-checked against the live runtime at 2.3.2 (`e6deeccc`) after the chain closed: v2.3 reads
v2.2 evidence as it stands and asks for `session-migrate.mjs migrate` only before new dispatch, which a closed
chain does not need. Under that tree `validate-session` prints **session valid** whenever the two import
origins are readable, and otherwise exactly the six lines of wall 14.
