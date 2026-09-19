# Lane v6-4 — REPORT: does .starciwork manage change + extension well?

Date: 2026-09-19. Read-only audit; this file is the only write. Method: read
`scripts/check-example-work.mjs`, `scripts/example-ownership.mjs`, `scripts/example-evidence.mjs`,
`scripts/example-derive.mjs`, `scripts/example-critique.mjs`, `scripts/check-stales.mjs`,
`kernel/source-staleness.mjs`, `kernel/reconciliation.mjs`, `checks/work-change.mjs`,
`schemas/work-layout.yaml` + the per-family `work-*.schema.yaml`; ran
`node scripts/check-example-work.mjs` twice and `scripts/example-derive.mjs` / `example-critique.mjs`
against both example trees; sampled evidence files, git history, and live file hashes.

**Timing caveat that is itself evidence**: the ec-be `apps/*`→`src/*` merge was in-flight in the
working tree during this audit (813 modified/deleted paths, 148 deletions, owner-path rewrites
already applied to 5 records but uncommitted). The two gate runs below bracket that repair, which
is exactly the change-isolation scenario the brief asks about.

---

## Q1. Change isolation — what exactly goes stale, and does it cascade?

**Verdict: the executable blast radius is "the owning record's own evidence, plus records that
share its code through the prover fallback." There is no recordDigest→dependents cascade.**

Mechanism, traced:

- `check-example-work.mjs` computes two digests per evidence.yaml. `recordDigest` = sha256 of the
  sibling `index.yaml`'s raw bytes (script lines 100–105) — catches *record edits*.
  `codeDigest` = `hashOwnedDirs(resolveOwnedDirs(...))` from `scripts/example-ownership.mjs`:
  sha256 over sorted `path:sha256` lines of every file under the record's `owners[].path`/`module`
  dirs (lines 121–134), where the owned dirs are the record's own, or — when it declares none —
  the dirs of *every `work/implementation` whose `proves` names it* (lines 82–88). Either mismatch
  refuses the evidence unless it carries `stale: true`.
- So a code change stales: (a) the evidence of every record that owns the touched dir directly,
  and (b) the evidence of every spec record that resolves code through a proving implementation —
  a **cascade through shared code ownership**, not through record references. A record edit stales
  **only its own evidence**: dependents' evidence hashes *their own* index.yaml, so a changed
  `br` never invalidates the `fr`/`contract`/`impl` that ref/prove it.
- The only cross-record staleness in the example model is `appliesTo`-newer — a timestamp compare
  (`example-derive.mjs` lines 180–186), computed in the derived report, not enforced by the gate.

The ec-be merge, measured twice:

- **Run 1** (owner paths still `apps/*`): 5 `done` records `OWNER_PATH_MISSING`
  (`br.checkout.place-order`, `impl.checkout.ecommerce-app-be.order-checkout`,
  `sds.checkout.order-flow`, `br.identity.sign-in`,
  `impl.identity.ecommerce-app-be.identity-account`); **8** evidence files `CODE_DIGEST_STALE`,
  all reporting `(no files found)`.
- **Run 2** (paths already rewritten to `src/*` in the working tree): `OWNER_PATH_MISSING` cleared;
  the same **8** evidence files still `CODE_DIGEST_STALE`, now with real fresh digests.
- The 8 = every `done` record in ec-be (`example-derive.mjs` tally: 11 lifecycle records, **0 done,
  8 stale, 3 todo**). Membership is *right*, not over-flagged: stored `files[]` hashes vs the moved
  files show real byte changes (`order.service.ts` `f6df7a…`→`e69251…`, `checkout.policy.ts`
  `e4cc2e…`→`949480…`, `order.client.ts` `c0a1fd…`→`e89ba8…`) — the merge rewrote, not just moved.
- Proof of the cascade shape: `contract.checkout.order-for-identity`, `fr.checkout.place-order`
  and `fr.identity.sign-in` declare **no** owners/module; their stored digests are byte-identical
  to their proving impl's (`0282dc…` = order-checkout's dir set; `fb34f8…` = identity-account's),
  and post-fix all three share the impl's new digest (`8225cac…`, `8c17c9…`). One impl owner-list
  move staled four records.
- Over-flagging that is real even though membership is right: (a) the digest keys on `path`, so a
  *byte-identical rename* stales proof — "moved" is indistinguishable from "modified" at the
  verdict level; (b) one root cause produced two refusals per record (missing path + digest); (c)
  `br.checkout.place-order`'s `module:` spans 3 module roots in 2 apps — the evidence is one blob
  digest, so a change in `integrations/order` alone would stale proof that is mostly about
  `bussiness/order`.
- What did **not** stale that arguably should have: dependents. `example-critique.mjs` computes
  the semantic blast radius — `br.checkout.place-order` → 10 dependents (contract, fr, sds, impl,
  2 integrations, 4 ui screens) — but that is report prose. Nothing suspends them: their own
  bytes/code didn't move, so their evidence stays "fresh" and `state: done` stands. The canonical
  model's edge-bound `inputDigest` invalidation ("one hop, at the edge") exists in
  `kernel/source-staleness.mjs` and the layout rules; the example gate does not implement it.

## Q2. Does per-file codeDigest tell you *which* file moved?

**Verdict: the data is there; the verdict isn't. And the digest's coverage has a demonstrated
blind spot: everything the proof runs that isn't product module code.**

- `evidence.yaml` stores `codeDigest.files[]` as per-file `{path, sha256}` — e.g.
  `br.checkout.place-order`'s evidence lists all 13 covered files with individual hashes. Diffing
  the stored list against a fresh `hashOwnedDirs` run *does* identify exactly which files moved or
  changed. But the gate only compares the top `digest` — the refusal message prints
  old-vs-new digest and no file-level diff, so the blast radius is diagnosable by hand, not by the
  tool.
- **v5-1 enumeration, done from the evidence files now**: if `src/tests/infra/**` is rewired, the
  records that stale are — **zero**. No evidence `files[]` contains any `src/tests/` path
  (`grep 'path: src/tests'` over all 114 evidence files: none); no record's `owners`/`module`
  names anything under `src/tests`, `scripts/`, `packages/`, or config roots — every owned dir is
  `src/modules/**` or `src/app/**`. v5-1 already ran (see `v5-1-REPORT.md`; `packages/e2e-kit`
  exists) and indeed staled nothing — not because nothing depended on it, but because the harness
  the assertion commands execute is outside every owned dir. `requiresProof.e2e.command` on
  `fr.checkout.place-order` literally names `src/tests/e2e/jest.config.js` — a file no digest
  covers.
- Asymmetry worth naming: spec files *inside* module dirs (`*.spec.ts`) ARE hashed — a test-only
  edit stales the proof — while the E2E stack the same evidence's commands may exercise is
  invisible.
- Two smaller replay gaps: `assertions[].command` is stored but the `--cwd` it ran under is not
  (`example-verify.mjs` requires it out-of-band; `npx vitest run src/...` is ambiguous between the
  be and fe repos), and `assertions[].id` values like `ac.checkout.place-order.becomes-a-buyer`
  are never ref-checked — `check-example-work.mjs` `continue`s evidence files before `collect()`
  runs (line 79–82), so an evidence can claim an ac id no record owns.

## Q3. Adding feature `promo-code` to ec-be — what must exist before `impl` can be `done`?

Walk-through of the gate-enforced spine vs convention:

**Enforced by `check-example-work.mjs`:**

1. `features/promo-code/impl/ecommerce-app-be/<name>/index.yaml` — id must equal
   `impl.promo-code.ecommerce-app-be.<name>` (path-mirrored id check, enforced).
2. `owners[].path` dirs exist on disk (`OWNER_PATH_MISSING` refuses `done`; warns `todo`).
3. Sibling `evidence.yaml`: `record` names the impl's id, every assertion carries a `command`
   (`PROOF_NOT_REPLAYABLE`), `recordDigest` and `codeDigest` both match current bytes.
4. Every id in `proves[]` resolves (generic ref check) **and** is `done`
   (`PROVES_TARGET_NOT_DONE`) — so the br/fr/sds/contract records the impl claims to realise must
   exist and be proven first. This is the ordering spine.
5. If the impl is frontend (`repository` resolves to a `role: fe` workspace entry) or `proves` a
   `work/ui-screen`: `IMPL_BEFORE_DIRECTION` — every relevant ui-screen of the feature must be
   `done` first; a ui-screen reaches `done` only with a `generation.tool: image_gen.imagegen`
   direction asset and a coverage map naming every declared state (enforced). A `done` fe impl
   additionally needs real capture artifacts passing `checks/render.mjs`/`brand.mjs` — the brand
   binding is implicit and lands here.
6. `uat-flow` `done` needs a settled `runs/<runId>/` with screens, videos, and `result.md`
   recording `outcome: pass` (enforced).
7. Generation-bearing assets are refused on anything but `work/ui-screen`.

**Not enforced — shortcuts that pass the gate:**

- Catalog entry (`.starciwork/index.yaml`, `work/catalog`) and the feature record
  (`features/promo-code/index.yaml`, `work/feature`) are convention only — nothing cross-checks
  catalog↔dirs or requires the feature node. (`work-layout.yaml` even says
  `featureCatalog: features/index.yaml` while both real trees put it at `.starciwork/index.yaml` —
  doc drift.)
- An impl with **no `proves`** has no enforced upstream at all: with owners + fresh evidence it
  can be `done` proving nothing. An impl with **no owners** skips `OWNER_PATH_MISSING` entirely
  and gets `codeDigest` omitted — `done` with proof bound to no code. And a *frontend* impl in a
  feature that simply authors no `ui/` records passes `IMPL_BEFORE_DIRECTION` vacuously
  (`relevantUi` is empty ⇒ no refusal) — skipping the draw step entirely is a way to satisfy the
  ui-before-impl rule, not a violation of it.
- `requiresProof` blocks (`unit.forEach: composes`, `e2e.command`, contract `provider/consumer
  required: true`) are read by no check — `fr.task.complete` documents a `requiresProof.e2e`
  command that does not exist in the repo, and nothing refuses it.
- `acceptanceCriteria` short names (`[is-idempotent, is-reversible]`) aren't id-shaped, so the
  gate never verifies they correspond to `ac/` records — asymmetric with `ac.rule`, which is
  checked.
- The `work-*.schema.yaml` files are not executed by the gate: `work/implementation` *requires*
  `revision` as a full 40/64-hex sha, yet `impl.task.todo-app-frontend.task-list` carries
  `revision: 5ff83e19` and passes. Requireds, patterns and `additionalProperties` are
  documentation, not enforcement.
- At the kernel level (not this gate), `kernel/reconciliation.mjs` adds the real
  "feature lands beside decided records" discipline — `extensions.work3.reconciliation` rows
  (`reference`/`conflict`/`new`, seven mechanical findings incl. `reconciliation-missing`,
  `conflict-edited`, `reference-restated`). It reads canonical `node@2` trees
  (`business/srs/...` paths), so it does not apply to this example layout either.

## Q4. `br.checkout.place-order` gains a statement — what must change, and what forces it?

Required by mechanism:

- `statements[] += …` → `recordDigest` mismatch → evidence refused unless regenerated or marked
  `stale: true` (+ `staleReason` naming rev/clause per the stale contract). Enforced.
- `change.rev` bump + `kind: clarifying` (additive per `checks/work-change.mjs`'s
  `classifyChange`: previous normative entries all held verbatim + additions). **Not enforced by
  the example gate** — it only checks `change.kind` is in the closed vocabulary. The real check is
  `starci work-change check --work <tree> --against <previous tree>` (`checks/work-change.mjs`):
  `CHANGE_UNRECORDED` (normative moved, no rev bump), `CHANGE_KIND_MISMATCH` (declared ≠ computed),
  `REV_NOT_MONOTONIC`, `WITHDRAWS_UNKNOWN_STATEMENT`, `EVIDENCE_STALE_UNMARKED`,
  `STATE_RESTS_ON_STALE_EVIDENCE`. But it needs a baseline tree handed to it — the Work tree keeps
  no history, so without an external snapshot (git ref) the verification can't run.
- Dependent propagation: `conflictsWith {record, rev}` is refused on rev mismatch, and
  `blockedBy {record, rev}` goes stale when the target reaches `done` at ≥ the cited rev — so a
  rev bump is the actual signal that reaches rev-pinning dependents. Skipping the bump is possible
  and undetected by the gate; it just makes every rev-cite silently describe the wrong content.
- ac additions: new `ac/<name>/` record under the br + a short name in `acceptanceCriteria` —
  nothing forces either (see Q3).
- New statement ⇒ new assertion ⇒ evidence re-run (or `stale: true`) — forced by `recordDigest`.

Did the mechanics get followed at `br.task.complete.once` rev 2? **Yes, substantially:**

- Record carries `change: {rev: 2, kind: breaking, withdraws: ["A complete task is never
  reopened."], reason: …}` — verbatim withdrawal + reason, per vocabulary.
- Re-proof actually happened: the record's comment documents regenerated evidence for both rev-2
  statements (`complete-task.handler.spec.ts`, `reopen-task.handler.spec.ts`, `live-proof.sh`
  22/22 on a dedicated port); its evidence's `recordDigest` still matches today (the gate flags
  only `CODE_DIGEST_STALE` — the task module changed *again* afterward, which is the system working,
  not a skipped step).
- Dependents were forced to move: `fr.task.complete` and `fr.task.reopen` dropped their
  `blockedBy` edges onto `br.task.complete.once` rev 2 — comments in both records state the gate
  "refuses an edge onto a done record," i.e. the `blockedBy`-staleness rule drove the cleanup.
  `gap.task.reopen-not-specified` was authored for the missing flow and then closed — the
  named-absence pattern used as designed.
- Caveat: `withdraws` verbatim-ness is verifiable only via git history (the file enters this
  path's history already at rev 2); the tree itself retains no baseline, so `work-change` can't
  confirm it in place. And `work-change`'s evidence rules are **inert on the example trees**
  regardless — it reads an `evidence:` block *inside* the record, while examples keep a sibling
  `evidence.yaml`; no example record has an inline `evidence` field, so `EVIDENCE_STALE_UNMARKED`
  et al. can never fire here.

## Q5. Rename/refactor resilience — did identity-by-id hold?

**Verdict: held against the code move, by construction; no migration tooling exists, and the
id-scheme does not survive Work-tree renames.**

- Record ids derive from the `.starciwork` path (`expectedId`: family + feature + name segments),
  never from code paths — the `apps/*`→`src/*` move broke **zero** ids and **zero** refs. All
  breakage was confined to owner-path strings and evidence digests, exactly where it should be.
- But the repair is entirely manual — the in-flight working-tree diff shows hand-edited
  `owners`/`module`/`composes[].module` across the 5 records. Nothing in `scripts/` rewrites a
  path prefix. Worse, the same module path is denormalized into four field shapes
  (`br.module`, `impl.owners[].path`, `sds.owners[].path`, `fr.composes[].module`) and
  `ownedRelPaths` reads only the first two — `fr.checkout.place-order`'s `composes[].module` was
  dangling at `apps/order/...` with **no check** (it happens to be fixed in the in-flight edit,
  but a missed one stays silently stale).
- `moduleRootOf` does provide file-level resilience: `/**` globs and literal file paths normalize
  to the module root, so intra-module file moves are not, by themselves, broken references.
- The id-scheme's own fragility is recorded in the gate's header comment: renaming
  `impl/todo-app` → `impl/todo-app-backend` left 13 records whose ids still said `todo-app` —
  because id = f(tree path), a *Work-tree* rename changes identity, and every inbound ref is a
  string that must be rewritten at every referrer. The id-place check exists precisely because
  that drift once went unnoticed.
- And because the path is hashed into `codeDigest`, even a byte-identical directory rename stales
  all covering evidence and forces re-running assertions — rename is priced as rewrite.

## Q6. What the model can't express that real maintenance needs

1. **Repo resolution is a sibling-directory coincidence.** `repoRootFor`
   (`example-ownership.mjs:43–50`) resolves a non-be repository as
   `dirname(backendRoot)/<repositoryName>` — which works here only because the four example
   "repositories" are sibling dirs in *one* git repo (no `.git` in any of them). The real binding
   (`.workspaces/projects/<p>/work.json`, `pathFromSource` per role, per
   `schemas/workspace-routing.yaml`) can place the FE checkout anywhere and is never read. If the
   fe repo isn't a sibling named exactly right, every `impl/*/…frontend…` evidence goes
   `(no files found)` — mass *false* stale — or worse, a coincidentally named sibling hashes the
   wrong code silently.
2. **Nobody re-proves `impl/todo-app-frontend/*` when that repo changes.** The codeDigest does
   cover fe bytes when the sibling exists, but detection happens only when someone runs the gate,
   and regeneration is a manual `example-evidence.mjs --cwd <fe>` invocation. No watcher, no
   scheduler, no hook on the other repo. The accrued result is visible now: todo-be sits at 75 of
   205 lifecycle records stale; both trees' `_derived/` are stale; 200 gate refusals total.
3. **Evidence doesn't say which repo it ran against.** `files[]` paths are repo-relative
   (`src/app/tasks/page.tsx` under fe is indistinguishable from a be path — `hashOwnedDirs`
   silently keeps the last on collision); no repository name, commit, or cwd is recorded.
   `impl.revision` exists but is informational (unchecked; the one in the tree is a short sha that
   fails its own schema pattern). The canonical model solves this properly —
   `starci/source-identity@1` binds `{repository, origin, state, commit|baseCommit, coverage}` and
   `check-stales.mjs` diffs covered paths against the stored git revision — but the example trees
   don't use it.
4. **The two Work generations diverge.** Canonical (`work/node@2`): evidence inside the record,
   `inputDigest` bound on edges, `effectiveState: suspended`, git-bound `sourceIdentity`,
   `work-change` baseline classification, `reconciliation` tables. Example layout (15 families):
   sibling `evidence.yaml`, owner-path digests, no edge digests — so semantic invalidation of
   dependents isn't modeled at all, and `work-change`/`check-stales`/`reconciliation` are all
   inert on these trees. The examples exercise a simplified discipline; lessons learned here
   transfer imperfectly to a real enrolled tree.
5. **Smaller structural gaps observed:** payload YAML under `assets/` is parsed as a record
   candidate and refused (`id is undefined` ×6 — generation-receipts/direction-check provenance
   can't live beside its node); `BLOCKER_UNROOTED` is a permanent warning class the gate
   deliberately doesn't refuse; `proves` is not a classified edge in `example-derive.mjs`
   (filed under `unclassifiedEdges`), so the tree's most load-bearing edge is invisible to the
   derived used-by index; absolute machine paths leak into ui asset `inputRefs`
   (`C:/Users/Hi/orca/workspaces/...` inside committed records).

---

## Three failure modes the current model *will* hit next month

**FM1 — FE/other-repo path drift mass-stales records with no rebind path.**
Already half-happened: `src/app/tasks` → `src/app/[lang]/…` in todo-app-frontend produced 5
`OWNER_PATH_MISSING` + stale evidence on fe impls; the next fe repo relocation (or any checkout
that breaks the sibling-name coincidence) turns every fe evidence `(no files found)` at once, and
nothing distinguishes "repo moved" from "code changed." *Minimal fix:* resolve repositories
through the bound routing (`work.json` `pathFromSource`, or an explicit `--repo id=root` map like
`check-stales` already takes) instead of the sibling convention, and stamp `repository` +
repo revision into `evidence.yaml` so a stale verdict names *which* input moved.

**FM2 — Record edits accumulate silent semantic drift; "done" decays into decoration.**
Edit `br.task.single-owner`'s statements tomorrow: its own evidence stales, but every fr/contract/
impl that refs or proves it keeps valid evidence and `state: done` — the critique already computes
that `br.checkout.place-order` alone touches 10 dependents, only 4 of which carry staling evidence.
A month of spec edits leaves a tree where `done` means "once proven against something that has
since changed" and nobody can see which completions rest on moved premises. *Minimal fix:* record
an `inputDigest` (the canonical model's edge-bound digest — `work-layout.yaml` rules already
specify it) on evidence or on the ref itself — hash of the bound record's normative projection —
and refuse/suspend when it no longer matches; one hop, at the edge, exactly as documented.

**FM3 — One directory rename = N hand-edits + forced re-proof of unchanged code.**
`src/modules/bussiness` is a typo'd directory name that *will* be fixed; that single rename will
stale every covering evidence (path-in-digest), require hand-editing four different field shapes
per affected record, and leave `composes[].module` dangling unchecked if missed. *Minimal fix:*
one path-remap command that rewrites a prefix across all path-bearing fields *and* emits the
evidence with a recorded path-map — i.e. hash files keyed on module-relative paths so a pure move
updates digests without re-running assertions; flag stale only on content change or root loss.
Bonus: this is also what makes the `files[]` diff (Q2) mechanically consumable instead of
hand-diffed.

### Secondary observations (not failure-mode-ranked)

- `requiresProof` is dead weight — declared acceptance machinery nobody checks.
- `evidence.yaml` isn't self-replaying (no `cwd`); assertion ids aren't ref-checked.
- `featureCatalog: features/index.yaml` in `work-layout.yaml` contradicts both real trees
  (`.starciwork/index.yaml`).
- `_derived` freshness is gated (`check-example-derived.mjs`) but both trees currently fail it —
  generated-state drift is already the norm, not the exception.
