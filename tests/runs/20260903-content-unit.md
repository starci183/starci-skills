# Run — content-unit dry run (2026-09-03)

Dry session of StarCi Skills v8: one orchestrator and one operator agent, both run inside this single
process. Session root `.worktrees/sessions/20260903-dryrun-content-unit/`, kept on disk for
inspection. The workflow `content-unit` binds `content.generate` to profile `luna`
(`operators/content-generate/operator.json` → `resources.profile`), which nominally resolves to
`gpt-5.6-luna` on the OpenAI runtime (`resources/agents/profiles/openai.json`). In this test the
branch was actually run by Claude Sonnet 5, standing in for that profile — no profile boundary was
exercised, and nothing about this run says whether `gpt-5.6-luna` would reach the same stop. Neither
`.claude` nor any other tree was edited by this run; no git write command was run anywhere; MinIO and
every other network service were treated as unreachable by the test's own constraint, not probed.

## Request summary

| Field | Value |
| --- | --- |
| Workflow | `content-unit` (`workflows/content-unit.json`) — one step, one branch, `content.generate`, `ends: user` |
| Operator | `content.generate`, domain `content` |
| Unit | `courses/1-system-design-mastery/milestones/0-monorepo-and-service-scaffolding` — a real local candidate discovered under `.gitmounts/data/courses/1-system-design-mastery/milestones/`, the backend's mounted content mirror; not confirmed as the exact id the served MinIO object uses, since that object could not be read |
| Requirements | `naturalLanguages: [vi]`, `implementationLanguages: []`, `stageModes: {image: off}`, `commands: []`, `maxE2eIterations: 2`, `maxReviewRounds: 2` (workflow preset `maxReviewRounds` plus the operator's own defaults for everything else) |
| Contexts bound | `@remote/minio/courses/1-system-design-mastery/milestones/0-monorepo-and-service-scaffolding/vi` (head `null`, unread), `@worktrees/sessions/central-runtime` (head `f938db7a6fa6181bc709c361cd2f352ec9f03b4a`, the sha1 of the local `owner.json` this run read as a file, not probed live) |
| Chain requested | step 1, `content.generate` |
| Chain actually run | step 1 only; it blocked before writing any brief, edition, image, track or executable check |

## Step 1 — `content.generate`, parallel-1

**Status** `blocked`. **Stop** `BRIEF_UNBOUND`, domain `curriculum`
(`operators/content-generate/errors.json`). `routing.json` answers `content.generate.curriculum` with
`{"kind": "user"}` — a person owns this, not another operator, and not a resume.

**What the branch found.** Step 1 (validate the gate and resume) had nothing to compare: this is a
first pass, there is no prior `content-generation-receipt`, and `@remote/minio`'s frozen head in
`request.json` is `null`, so `SOURCE_DRIFT` cannot fire against nothing. Step 2 (bind the served unit
and the runtime) could read `@worktrees/sessions/central-runtime/owner.json` as a local file — it
records `status: "ready"`, generation 6, endpoints on `:3000`/`:3001`/`:8080`, last updated
`2026-09-01T19:54Z` — but this run did not probe those endpoints live, since that is itself a network
action the test forbids, so the runtime binding is read-only evidence, not a live confirmation. It
could not read `@remote/minio/.../vi` at all: MinIO and every other network service are unreachable
under this test's own constraint. Step 3 (write and freeze the brief) needs curriculum and source
evidence from exactly that alias, has none, and stops. This is the honest, first real wall the branch
meets — not a fabricated one — and it is the wall the operator's own law names for it: `BRIEF_UNBOUND`
is the one stop in the merged registry whose meaning is "The teacher brief cannot be frozen from the
bound curriculum and source evidence," which is exactly what happened. No brief was written, no
article, image, track or executable check ran, and the branch never opened the `review` exchange —
steps 4 through 9 never ran, so there is nothing to run the nested review pass against. The requested
"deliberately fresh review pass" in this test's instructions therefore did not happen, for the same
honest reason: there is nothing produced yet for a reviewer to read.

## Validator outputs (trimmed verbatim)

```text
$ node scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-1/parallel-1
response valid

$ node operators/content-generate/validate.mjs <session>/step-1/parallel-1
valid content.generate branch

$ node scripts/validate-step.mjs <session>/step-1/parallel-1
step valid
```

A valid blocked branch is green here on purpose: `validate-response.mjs` only requires an Output when
`isYes(required) && status === 'done'`, so a blocked branch with empty `fields` and no `review/`
exchange satisfies every check. This is the "a valid blocked is green" case the task named in advance.

## Artifacts written

- `.worktrees/sessions/20260903-dryrun-content-unit/state.json`
- `.worktrees/sessions/20260903-dryrun-content-unit/step-1/parallel-1/request/request.json`
- `.worktrees/sessions/20260903-dryrun-content-unit/step-1/parallel-1/response/response.json`

No `response.md`, no `brief.md`, no `data/e2e.json`, no `artifacts/` of any kind, and no `review/`
folder — the operator's own Boundary text says it "never writes an article before the brief is
frozen," and the brief never froze. `response.json.fields` is `{}`.

## Defects this run exposed

### Knowledge gaps

None found by this run. The block happened at the earliest possible point — before curriculum, style,
or any published outcome was ever read — so this run never reached deep enough into the content
domain to expose a gap in it. Reporting a knowledge gap here would be inventing one.

### Operator and contract defects

1. **`request.schema.json`'s `contexts[].head` has no meaning for a non-git alias, again.** The
   pattern is `^[0-9a-f]{40}$` or `null`. `@remote/minio` binds "by the fingerprint of the fetched
   object" and `@worktrees/sessions/central-runtime` binds "fingerprint + generation" — neither is a
   git `rev-parse HEAD`. This run could not put anything honest in `head` for `@remote/minio` (nothing
   was fetched, so `null`), and had to manufacture a sha1 of the one local file it could read for
   `central-runtime` to satisfy the pattern at all. This is the same defect
   `.claude/tests/runs/20260903-frontend-refine-subscriptions.md` already recorded against
   `@knowledge/*` and `@workspaces/device-state` (orchestrator gap 5 there); it recurs identically for
   both of `content.generate`'s own Context aliases, neither of which is a checkout.
2. **Step 2 of `content.generate` ("Bind the served unit and the runtime") names no Stops at all**,
   yet it is the step that performs the one read that can fail outright — the remote fetch. Working
   out that an unreachable `@remote/minio` surfaces as `BRIEF_UNBOUND` at step 3, rather than as
   something raised at step 2 itself, required reading step 3's Reads column (which repeats the same
   alias) side by side with step 2's, and was not stated anywhere as "a step with empty Stops cannot
   fail on its own; look at what consumes its result." A reader who stopped at step 2's own row would
   reasonably conclude the operator has no way to report an unreachable source at all.
3. **Step 1's Reads column ("`@remote/minio/<contentId>/<locale>` at the frozen unit binding") reads
   as unconditional**, but on a first pass there is no frozen binding to read — the `head` a caller
   can honestly write is `null`. Nothing in the operator says step 1 is a no-op against `null`, or that
   `SOURCE_DRIFT` (whose meaning is specifically "the observed head differs from the frozen one")
   cannot fire when nothing was ever frozen. This run inferred it; a stricter reading could have
   produced `SOURCE_DRIFT` instead of letting step 1 pass through to the real wall at step 3.
4. **`operators/content-generate/validate.mjs`'s `STAGE_DISABLED` checks are not gated on
   `status === 'done'`.** If a branch chooses to still emit a `content-generation-receipt`
   `response.md` on a blocked run — which is exactly what the precedent dry run's
   `frontend.presentation.resolve` branch did, writing a partial `response.md` under a `blocked`
   status — this operator's own validator would then require `## Findings` to record `STAGE_DISABLED`
   for the image, code, and e2e stages, none of which ever got the chance to run or not run; a branch
   blocked at step 3 cannot honestly claim a decision was made about steps 5 through 7. This pushed
   this run toward omitting `response.md` entirely, which the schema permits (the receipt's
   `Required: yes` is enforced only at `status === 'done'`) but which is a silent, per-operator
   difference in convention from the one other blocked branch on record in this tree — nothing states
   which is the intended house style.

### Orchestrator gaps

1. **No place in `state.json`'s declared shape (`id, project, startedAt, status, chain, steps,
   current, leases, requestHashes`) records that a run is a profile stand-in.** This run recorded it
   as a synthetic agent id inside `leases["1/1"].agent`
   (`content.generate/luna/claude-sonnet-5-dryrun`) for traceability, an invented convention, not a
   documented one — the same gap the precedent report raised for a different session.
2. **Nothing says who is allowed to decide a remote alias is "unreachable" versus simply not yet
   tried.** This run treated `@remote/minio` as unreachable by the task's own explicit instruction, not
   by any timeout, retry count, or error the runtime itself defined. An operator running for real would
   need that distinction settled somewhere in `alias/alias.json` or the operator's own law, and it is
   not.

## What a person owns next

`BRIEF_UNBOUND` routes to `user` under the `curriculum` domain. Whoever owns curriculum for
`courses/1-system-design-mastery/milestones/0-monorepo-and-service-scaffolding` needs to confirm the
unit id against the served MinIO object (this run only found a local mirror candidate) and make sure
`@remote/minio` and the runtime it is served through actually answer before `content.generate` is
resumed on `request.json.resume` naming `1/1`. Until then no brief exists, so nothing downstream —
editions, image, tracks, executable check, or the independent review — has anything to act on.
