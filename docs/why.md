# why: the owner-facing reason of an attempt

Every failed, blocked, refused, requeued or waiting attempt carries a `why` in the owner's language (config.yaml
`language`, `vi` today; the catalog is Vietnamese only, so the text is Vietnamese). It answers, in plain words: what
happened, which check or record said so, where the op's claim and the runtime's verdict disagree, and what happens now.
The raw codes stay, as the secondary key.

Three pieces, one contract:

| Piece | Where | Role |
| --- | --- | --- |
| Catalog | `modules/kernel/failure-codes.yaml` | every code the runtime emits, explained (flat map, key = code) |
| Builder / reader | `scripts/kernel/why.mjs` | pure, read-only: `whyOf`, `computeWhy`, `buildWhy`, `kernelNotesOf`, `explainCode` |
| Store | `op_attempts.why_json` | the why, written with the settle by `scripts/kernel/why-record.mjs` `recordWhy` |

## The `why` JSON (`starci/why@1`)

Key order is reading order: `headline` is the first key.

```json
{
  "headline": "The op reported done, but the runtime re-ran the check starci-validate-strict-scope-record and it is red (TARGET_MISSING).",
  "state": "failed",
  "cause": "The op's temporary directory (starci-job-scratch) was deleted when the op submitted its report, so when the runtime re-ran the check that path no longer existed. The path to validate does not exist: ...",
  "disagreement": "The op stated that the check starci-validate-strict-scope-record exited 0 (green) when run in its working directory; the runtime re-ran it after the report was submitted and it exited 1: ...",
  "next": "The Kernel will re-dispatch the op (attempt 3/5, rejected-report-retries route 1/2).",
  "owner": "op-retry",
  "codes": ["TARGET_MISSING"],
  "refs": [
    { "kind": "check", "name": "starci-validate-strict-scope-record", "runner": "settler", "status": "fail" },
    { "kind": "report", "reportId": 11 },
    { "kind": "commit", "sha": "3ad73d73..." }
  ],
  "schema": "starci/why@1", "lang": "vi", "attemptId": 13, "opId": "scope.define", "tryNo": 2
}
```

| Field | Meaning |
| --- | --- |
| `headline` | one sentence: what happened. Print this alone where there is room for one line. |
| `state` | `failed` `blocked` `awaiting-owner` `dispatch-rejected` `requeued` `worker-dead` `cancelled` `waiting-settle` |
| `cause` | which check / blocker / record, in words; the catalog's title and meaning of the primary code follow |
| `disagreement` | `null`, or what the runtime saw differently from the op's claim (op said done, the runtime's re-run was red) |
| `next` | what happens now (retry N/budget, repair, owner gate, supervisor gate, wait for a peer) |
| `owner` | who acts next: `op-retry`, `other-op:<op>`, `runtime-core`, `supervisor`, `owner` |
| `codes[]` | codes in order of importance: the first is the primary; each is a key of the catalog (`blocker:<kind>`, `failure-class:<c>` are catalog keys too) |
| `refs[]` | `{kind:'check', name, runner, status}`, `{kind:'report', reportId}`, `{kind:'commit', sha}` |

`why` is `null` for an attempt that passed or is still running: nothing to explain.

## The catalog (`modules/kernel/failure-codes.yaml`)

A flat map keyed by code (UPPER_SNAKE finding codes, kebab-case reasons, and the vocabulary families
`blocker:*`, `failure-class:*`, `route-verdict:*`, `end-state:*`, `attempt-verdict:*`, `check-status:*`):

```yaml
TARGET_MISSING:
  title: "Validation target does not exist"      # English
  title_vi: "The path to validate does not exist"
  meaning_vi: "The validation command points at a file or directory that does not exist."
  causes_vi: ["Wrong path", "..."]             # non-empty list
  nextStep_vi: "..."                              # what the runtime/Kernel does or what must happen
  owner: op-retry                                 # op-retry | other-op:<op> | runtime-core | supervisor | owner
  kind: input-invalid   # check-finding | settle-reason | dispatch-refusal | blocker | check-status | verb-refusal | runtime-fault | input-invalid
```

`npm run check` runs `scripts/checks/check-failure-codes.mjs`: it scans `scripts/ engine/ modules/` for emitted codes (a quoted
UPPER_SNAKE literal, a `[CODE]` token in a message, a kebab literal in a `code:` / `reason:` / `rejected:` / `failureKind:` /
`signal:` position, the last argument of `refuse(...)`, `hand('...')`, constant `*_REASONS|CODES|KINDS|CLASSES` lists) and
refuses an emitted code with no entry, an entry no code emits, a malformed entry, an owner outside the set, an
`other-op:<op>` naming an op that does not exist. A literal that only looks like a code (an env var name, a constant)
goes to `scripts/checks/failure-codes.not-codes` with the reason.

## Answers for the UI session

1. **Persisted and importable.** `op_attempts.why_json` holds the why (migration 0004 on the writer's first
   open of an older ledger; a fresh ledger runs it after 0001). `scripts/kernel/why.mjs` exports the pure read-only
   `whyOf(ledgerDbOrHandle, attemptRowOrId)`: the stored value, else computed now (so an attempt settled before why existed,
   or a ledger the writer has not reopened yet, still answers; a reader opened before the column exists just gets the computed
   value). Also `whyOfOp(db, workflowId, opId)`, `whysOfWorkflow(db, workflowId)`, `computeWhy`, `explainCode(code)`,
   `loadCatalog()`. `v_op_history` carries `why_json` (the UI's `/api/attempts` rows).
2. **Catalog path and shape.** `modules/kernel/failure-codes.yaml`, flat map `code -> {title, title_vi, meaning_vi, causes_vi[],
   nextStep_vi, owner, kind}`, parsed with `engine/yaml.mjs` (`loadCatalog()` in scripts/kernel/why.mjs does exactly that).
3. **The two sibling states and their UI mapping.**
   - `awaiting-owner` (lane/ask-state): the job is `jobs.status='awaiting_owner'`; the attempt keeps `verdict='blocked'` and
     `report_outcome='ask'`. `v_op_history.job_status` is the job's status (a column of the view), so the UI reads
     `job_status='awaiting_owner'` directly. `v_attempt_state.native` is `awaiting-owner` for a settled attempt whose job is
     `awaiting_owner` or whose verdict is blocked + ask; `v_op_history.ui = 'awaiting-owner'` (its own ui value, violet in the UI; not `bad`, not `waiting`).
   - `dispatch-rejected` (lane/orphan-attempt): the attempt ends `end_state='requeued'` (nothing ran) or `'effect-unknown'` (a
     worker may have started); its `settle_json` carries `{reason:'dispatch-rejected', step, signal, detail}`.
     `v_attempt_state.native` is `rejected` for requeued + settle reason dispatch-rejected (a plain requeue after a dead worker
     stays `requeued`, `effect-unknown` stays as is); `v_op_history.ui = 'rejected'` (neutral, a Vietnamese "rejected on delivery" label). The why `state` is `dispatch-rejected` (`requeued` for an
     unknown effect); `next` says it is not counted.
   The two ui values are computed by the view: `v_op_history.ui` is `awaiting-owner` / `rejected` for those two natives and
   `ui_state_map` for every other one (`ui_states` is unchanged). `0001-init.sql` carries `op_attempts.why_json` and the
   `v_attempt_state` and `v_op_history` views that compute them.
4. **Kernel notes.** Source: table `events`, kinds `kernel-decision` (entity_type `decision`, payload `{hypothesis, actionKey,
   metric, command, baseline}`), `kernel-decision-result` (same entity_id, payload `{result: keep|revert, observed}`) and
   `kernel-proposal` (entity_type `kernel-proposal`, payload `{id, title, evidence, files, tier, status}`). Reader:
   `kernelNotesOf(ledgerDbOrHandle, workflowId, {limit})` returns `[{kind:'decision'|'proposal', id, at, status, headline, ...}]`,
   oldest first (decision status `open|kept|reverted`). `api status` returns it as `kernelNotes[]`.
5. **Does `dispatch-rejected` count against `work_units.tries` (the Vietnamese "attempt n/5" display)? No.** `work_units.tries` counts JOBS of the
   unit (`jobs.try_no`), never attempts; a refused launch keeps its job (it goes back to `ready`) and opens no new job, so
   `tries` does not move. The `dispatches` counter is given back by lane/orphan-attempt's `endRejectedAttempt`. `why.next`
   for this state says, in Vietnamese, that it is not counted toward the attempts. A retry N/budget in a why is `try_no + 1` over `work_units.try_budget`.

## Read surface

- `api status`: `legs[].why` (latest attempt of each non-green leg), `legs[].attempts[]` (each with its `why`),
  `frontier.why`, `kernelNotes[]`; the text form prints `why:` lines.
- `scripts/reconciler/core-watch.mjs`: a bad leg's alert text is `<op> <state> - <why.headline>`.

## Where the why is written

`recordWhy(db, attemptId)` runs inside the ending transaction, after the attempt's end columns and settle result:
`api settle` (fail / blocked / ask), the refused launch (`rejectDispatch`), the dead-worker settle and the reconcile
requeue (`api reconcile`), and the archive / abandoned-dispatch cancel. A failure to explain never blocks the settle: it is
recorded as a `why-failed` event.
