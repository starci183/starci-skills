# fable.md

## ghost-context

**Definition.** A sentence in a canonical file only makes sense if the reader knows the
*old* state of the repo. A new reader sees a negation of something they never saw, so they
do not understand what the sentence is saying or why it comes first.

**Example.** `CONTEXT.md:1` opens with "StarCi is a **distless** source layout". The word
`distless` only means something to someone who knows the repo used to build out a `.dist`.
A fresh chat or a new project reads a word that does not exist in English, negating
something that is not in the tree.

**Rule derived.** Canonical files (`CONTEXT.md`, `README.md`, `modules/**`, `docs/**`)
describe the present with affirmative sentences: "this tree is the runtime; `node` reads it
directly". History ("used to be X, no longer") goes into `CHANGELOG.md` or
`.experiments/practices/`, never into the first sentence of the context.

**How to spot it.** Compounds with `-less`/`no-`/`former`/`legacy`/`no longer` in a
definition position, where the negated thing appears nowhere else in the tree.

## feedback-sediment

**Definition.** Each round of feedback piles another layer of rules onto a file without
removing or merging the older layers. After many rounds the file holds strata of sediment:
the top says A, below it says B, further below says "if not C then A and B". Each sentence
was true at the time it was written; read as a whole, the file contradicts itself. A new
reader cannot tell which layer is the current rule, and an LLM reading it will pick a layer
at random or invent a compromise rule, that is, hallucinate.

**Example.** The role of chat in `CONTEXT.md` has four layers:

| Layer | Location | What it says |
|---|---|---|
| A | `CONTEXT.md:3` | "Chat is the trigger only." |
| B | `CONTEXT.md:3` | "With explicit unattended authority, `watchdog.mjs` owns the five-minute cadence" |
| C | `CONTEXT.md:5` | Chat runs the supervisor loop: observe, patch `.claude`, restart the kernel |
| D | `CONTEXT.md:33` | "One chat monitors one workflow ... no unattended solo runner and no second control plane" |

A and C contradict directly: trigger-only cannot patch the contract and restart the kernel.
B and D contradict: there is "unattended authority" but "no unattended solo runner". C and D
contradict: one chat supervises several workflows via `poll.mjs --workflow <id>...` but "one
chat monitors one workflow". Each layer comes from one round of feedback: the watchdog was
added later, the supervisor later still, and sentence D was probably written to block an old
proposal about a solo runner. No sentence was ever removed.

**Different from ghost-context.** Ghost-context is one sentence referring to a past that no
longer exists. Feedback-sediment is many sentences that all exist in the present but negate
each other.

**Rule derived.** When feedback changes a rule, replace the old sentence; do not write a new
sentence below it. One concept gets one paragraph, and that paragraph is the latest version.
If a condition is needed ("if not C"), the condition lives in the same paragraph as the rule
it modifies. History ("earlier said A, now says B") goes into `.experiments/practices/`, not
into the canonical file.

**How to spot it.** The same subject noun (chat, kernel, watchdog, op) appears with the verb
"only" / "never" / "no other" in two paragraphs far apart. Grep the subject and put the
sentences side by side; if you have to explain "this one was written first, that one later",
there is sediment.

**Where to sweep.**

- [ ] `CONTEXT.md` subject "chat": merge A/B/C/D into a single paragraph about the three
      roles a chat can take (trigger, workflow-chat monitor, supervisor) and the condition
      for each role
- [ ] `CONTEXT.md` subjects "kernel" and "watchdog": sweep the same way
- [ ] `docs/architecture.md:12` "spawned, not supervised, by chat" versus the supervisor
- [ ] `modules/kernel/driver-loop.yaml` header "chat = goal creator + trigger only" (line
      ~12) versus `modules/supervisor/supervise.yaml`

### Case: `modules/ops/ops/interface.draw.yaml` (360 lines, 7 commits in 2 days)

Reading an arbitrary file, the result:

1. **Truncated sentence from patching.** Step 1: "When a screen's direction is genuinely
   owner-level taste — a novel surface, a brand moment, or materially different layout
   architectures that all satisfy the accepted requirements." The sentence ends with no main
   clause. Commit `614e67d55` replaced the latter half ("the representative set may hold
   alternative candidates...") with a new rule "The default is one candidate per screen" but
   left the condition clause of the old rule in place.
2. **Repeated sentence from insertion.** Step 2 has "Include real product-shaped content:"
   followed by 5 lines of new rules, then "Include real product-shaped content," again,
   continuing the old sentence. Commit `0b0b9e33a` inserted the new block into the middle of
   the old sentence instead of rewriting the sentence.
3. **Top of file says A, bottom says B.** Steps: default one candidate per screen. The
   `business.whenNeeded` block at the bottom: "When the owner must pick between visual
   candidates". Commit `614e67d55` fixed steps and did not fix business.
4. **One rule, four places.** "Do not guess the image model name" appears 4 times (read
   `profile`, write `designSource`, step 2, proof `imagegen-provenance`). "typed blocker" 4
   times. The skeleton rule 3 times (step 2, step 3, and implicitly in step 1). Each round of
   feedback piles the rule into every place that can be read, so fixing one place leaves the
   other three out of step.
5. **Mild ghost-context.** Read `knowledge` hard-codes the list of rule ids from
   `concepts.yaml` (SURFACE-UNIT-1, LABEL-EXTERNAL-1, ...). That is a copy of an authority
   that lives in the Grammar package; when the package changes, this line becomes a ghost.

General remark: this file breaks no rule, but it has three layers of sediment visible to the
naked eye (truncated sentence, repeated sentence, top-bottom mismatch) and one layer visible
only by counting (a rule repeated 3–4 times). The fix is not to add sentences: rewrite each
step as one paragraph, put each rule in one place, and either generate the `business` block
from steps or drop it.

- [ ] Fix the truncated sentence in step 1
- [ ] Merge the two "Include real product-shaped content" in step 2
- [ ] Sync `business.whenNeeded` with the one-candidate default
- [ ] One place per rule: model-name, typed-blocker, skeleton

**Who gets confused, and how.**

| Reader | Reads which block | Consequence |
|---|---|---|
| `[Op]` agent receiving a dispatch | `steps[].action.en` | On a truncated sentence it guesses the main clause, usually guessing the old rule that was just dropped |
| Kernel at settle | `proofs`, `blockers` | A rule that lives only in a step and not in a proof gives no ground to fail |
| A later chat receiving feedback to patch | the whole file | Sees one rule in four places, cannot tell which is the origin, fixes one and leaves three out of step, or adds a fifth place. This is how sediment multiplies itself |
| A stranger reading the open-source repo | the `business` block because it is short | Trusts the old summary, misreads the current default |

**Fixing principle.** Each rule has one place to "do" (a step) and at most one place to
"grade" (a proof). Read/write blocks only describe data and hold no rules. The condition
clause of an old rule is deleted outright when the new rule has its own condition. The
`business` block is generated from steps in the same commit, or dropped.

**Example fix for step 1 (truncated sentence).**

Before: `When a screen's direction is genuinely owner-level taste — ... requirements. The
default is one candidate per screen: alternative candidates are generated only when the
owner explicitly asked ...`

After: `Generate one candidate per screen. Generate alternatives only when the owner asked
for options in the goal, a directive or a prior review note; then park an owner ask so the
owner picks, keep every candidate as direction, and retain the unchosen ones as evidence.`

**Example fix for step 2 (repeated sentence).**

Before: `Include real product-shaped content: every visible datum ... non-conformant.
Include real product-shaped content, screen purpose, component regions, ...`

After: `Include screen purpose, component regions, state, viewport, accessibility and
forbidden treatments. Every visible datum is concrete plausible data derived from the
accepted business record: numbers, currency, dates, names, statuses, copy. Skeleton or
shimmer appears only when the directed state is the loading state.`

Step 3 replaces the repeated passage with: `Reject any direction that breaks a step-2 rule and regenerate
within the bounded set.` The skeleton rule adds one proof so the kernel can grade it.

## Owner decisions (2026-09-22)

- `.experiments/` stays as is, not promoted.
- Version goes to the `1.0.0-alpha.N` line. `2.0.0` is the number of the old package; tags `v2.x`/`v6.x` likewise.
- Preparing `1.0.0-alpha.2`. Theme: canonical files say one thing, once
  (de-sediment, no ghost-context, one list of verbs).
- The only version authority is `package.json`; do not create a `VERSION` file.

## op-shape: what an op is today, and why responses are uneven

Measured over 35 ops in `modules/ops/ops/` (13,512 lines, from 156 to 1,287 lines per op).

**An op today, by exactly what the machine reads:**

| Dimension | What is typed | What is only prose |
|---|---|---|
| Input | Packet from `starci kernel dispatch`: `op`, `brief` (yaml path), `context{workflow, records, owned_paths}`, `constraints{model, budget, lease}` | All business parameters: number of candidates, number of audit rounds, file thresholds. No op has a `params`/`inputs` key |
| Context | `reads[]` lists record paths | The `purpose.en` of each read holds rules, not just a description of the data |
| Return | `starci/op-report@1` JSON via `starci kernel report`: `outcome`, `summary` ≤600 chars, `files`, `checks`, `open`, `question`, `blocker`. Only this is validated (`report-envelope.mjs`) | `writes[]` additionally declares `handoff` (E/response.yaml, 7 ops), `matrixHandoff` (E/job-result.yaml, 23 ops), and per-op files: draws, flows, apiDelivery, assetManifest, intake, decision, scope, goal, verification |

**Three causes of uneven responses:**

1. **No schema for the op manifest.** 35 ops share 14 core keys, but 17 ops add 15
   self-invented keys: `commitPolicy`, `qualityPolicy`, `deliveryPolicy`, `assetPolicy`,
   `modePolicy`, `executionModes`, `proposalAuthority`, `migrationAuthority`,
   `cutSetAuthority`, `refactorPolicy`, `docsPolicy`, `goalPolicy`, `intakePolicy`,
   `adHocPolicy`, `canonicalWorkPolicy`... `build-ops-registry.mjs` states "fields absent are
   omitted, never invented", meaning it rejects nothing. Only `interface.audit` has its own
   spec.
2. **Parameters live in prose.** "one candidate per screen" (`interface.draw:195`), "five-round
   loop" (`interface.audit`, repeated 5 times), "at least two options" (`provision.ask:64`),
   "more than twelve files, more than eight proof demands, three or more" (`work.author:212`).
   If the owner wants 3 candidates they must write it into the goal, and the op has to read
   the goal prose to find it. That is where hallucination happens: the agent reads "owner
   explicitly asked" and decides for itself what counts as "asked".
3. **23 ops are told to write files nobody reads.** Grep over all of `scripts/ engine/
   skills/`: only `serve-ask.mjs` reads `draws.yaml`. No script reads `job-result.yaml` or
   `response.yaml`. Agents write files following the descriptive prose, each in its own way,
   and the kernel does not validate because it does not consume them. This is the direct
   source of "uneven op responses".

**Additionally:** `modules/ops/_common.yaml` still carries the vocabulary "matrix 3 rows × 3
parallel cells", "coordinator", "secondary types", "cell" from the old model, while
`CONTEXT.md` says one op, one agent, no fan-out. Ghost-context inside the common file every
op reads.

**Proposed shape of an op (`starci/op@1`), fixed, with schema and check:**

```yaml
id: interface.draw
goal: {en: ...}                 # one sentence
params:                         # typed parameters, with defaults, and who may set them
  candidatesPerScreen: {type: integer, default: 1, min: 1, max: 3, setBy: owner}
context:                        # data the op may read; description only, no rules
  reads: [{id, path, purpose}]
effects:                        # what the op may write
  writes: [{id, path, schema}]
steps: [{reads, writes, action}] # the "do" rules, one place per rule
returns:                        # exactly op-report@1 + typed per-op outputs
  outputs: {draws: {schema: starci/draws@1}}
proofs: [{id, requirement}]     # the "grade" rules
blockers: [{code, condition}]
policy: {}                      # one map in place of 15 self-invented keys
route: {...}
```

Drop the `business` block (generate it from steps or let the registry generate it). Drop
`handoff`/`matrixHandoff` when there is no consumer. Params travel along the path: goal →
`starci kernel enqueue --params` → packet → op reads `params.candidatesPerScreen`; api validates
params against the op's schema before dispatch. Then "generate 2-3 images" is a value, not a
sentence.

End-state evidence: `scripts/checks/check-op-manifest.mjs` runs over the 35 ops, rejecting
unknown keys, params without defaults, writes without schema, and numbers hard-coded in
`action.en` when the op has a param of the same meaning.

- [ ] Schema `starci/op@1`
- [ ] Check `check-op-manifest.mjs`
- [ ] `starci kernel enqueue --params` + validate + packet.params
- [ ] Move `interface.draw` to the new shape as the model (candidatesPerScreen)
- [ ] Sweep `_common.yaml` to drop the matrix/cell/coordinator vocabulary

## host-boundary: every call to Orca goes through scripts, the agent does not read the contract

**Measured state.**

| Question | Result |
|---|---|
| Which scripts spawn `orca` directly outside `scripts/api/orca/`? | None. Every spawn goes through `orcaRun()` in `scripts/api/orca/lib.mjs`. 27 wrappers, one file per verb |
| Do wrappers read `modules/host/orca/calls.yaml` to assemble argv? | No. Argv is hard-coded in each wrapper (`['terminal','send','--terminal',...]`) |
| Does any script call `orca agent-context` to compare the live schema? | No. `providers.mjs` only compares YAML with YAML, never runs orca |
| What does `calls.yaml` say about itself? | "wrappers build argv only from these entries, verify each command and flag against the live agent-context before the first effect". No code implements either half |
| Who is told to read the contract and check the live schema? | `CONTEXT.md:31`: the agent must load the 7 files `modules/host/orca/*.yaml`, run `providers.mjs`, and "the live `orca agent-context --json` signature is checked before effects" |

Conclusion: the boundary in code is already right, but the prose pushes host checking up to
the agent. The agent reads 2,088 lines of Orca contract to "check" something a script should
check. This is a source of hallucination: the agent assembles `orca` commands from
`calls.yaml` instead of calling the wrapper, or "checks" the live schema by imagining it.

Two authorities for one argv: the wrapper code (real) and `calls.yaml` (claims to be the
source). Comments in `worker-start.mjs`/`worker-stop.mjs`/`worker-release.mjs` say
"calls.yaml classify, evaluated in contract order" but it is hand-copied, the file is not
loaded.

A third path: `skills/orca-cli/SKILL.md` teaches the agent to run the `orca` CLI directly and
`orca skills get orca-cli`. This skill is for human chat, but sits in the same skill tree
that the kernel and ops read.

**Proposed rule.** No agent (kernel, op, chat, supervisor) runs `orca` or reads
`modules/host/orca/*`. The kernel calls `api.mjs`. Chat and supervisor call
`scripts/api/orca/<verb>.mjs` for read verbs and `terminal-send`. The Orca contract is data
for `lib.mjs`, not documentation for agents.

**Concrete work.**

- [ ] `lib.mjs` loads `calls.yaml`: `orcaRun(verb, params)` assembles argv from `command` +
      `flags`, rejects undeclared flags. Wrappers become thin, no more hard-coding. One
      authority.
- [ ] `lib.mjs` runs `agent-context` once per process (cached), compares `compare: [command,
      flags]` before the first mutation, `onMismatch` stops as `calls.yaml` already promised.
      `providers.mjs` gains `--live`.
- [ ] `CONTEXT.md:31` cut down to one sentence: host calls go through `scripts/api/orca/`, the
      agent does not run `orca` and does not read the host contract. Delete the list of 7
      files and the agent-context check sentence.
- [ ] `check-host-boundary.mjs`: red if any `spawn*('orca'` appears outside
      `scripts/api/orca/`, or if agent-facing prose (`CONTEXT.md`, `modules/kernel/*`,
      `modules/ops/*`, `skills/{define-goal,start-kernel,workflow-chat}`) contains an
      `orca <verb>` command instead of a wrapper path.
- [ ] `skills/orca-cli` split out of the kernel/op load path, or state at the top: for human
      chat only, kernel and ops do not read it.
- [ ] `modules/host/claude` and `modules/host/codex` swept the same way: a contract that no
      script reads either gets a script, or is dropped.

## supervisor-poll: cross-checking `DEVIN_POLL_BUG.md` (2026-09-22)

Devin supervised two workflows AUTH and WSPV via `poll.mjs`, logging 7 runtime items (A1–A7)
and 8 product findings (B1–B8). The assistant checked each A item against the code at HEAD
`6279f4895`.

| Item | Devin says | Assistant check | Verdict |
|---|---|---|---|
| A1 impl→audit evidence | fixed `e881f0159` | `interface.implement.yaml:174` declares `E/screens/**/*.png + E/runtime.json + E/measurements.json`; audit reads at `:104` | Correct. But Devin's open question matters more than the fix: the producer measures `measurements.json` itself and then audit trusts those numbers. Audit must measure itself with the locked Playwright runner (mechanism already exists in `uat.assisted.prepare`) |
| A2 liveness classifier | fixed `6279f4895` | Regex has `esc (?:twice )?to` and braille `[⠀-⣿]…\d` | Correct |
| A3 claude worker-start does not open the circuit | open | `api.mjs:1011-1081` only writes the circuit on `authFailure` or the `readiness` branch; an empty worker-start error falls through → `providerHealth: null` | Correct. `runtimes.yaml allocation.cooldownMs` is already a map by `failureKind`, only a `worker-start` key (data) and one branch in code are needed |
| A4 dead ask URL | open | `poll.mjs openAsks()` takes the last `ask-serving` event, no probe. **But** `serve-ask.mjs:568` already emits `ask-serving-expired` and poll does not read it | Cheaper fix than Devin proposed: poll reads `ask-serving-expired` first, HTTP probe only for URLs not yet expired. `supervise.yaml:41` already promises "relayed only after re-verifying they answer 200", a prose-only contract |
| A5 superseded ask still ASK-OPEN | open | Only 3 kinds: `ask-serving`, `ask-serving-expired`, `ask-answered`. No `ask-withdrawn` | Correct. The new kind must go into `serve-ask.mjs` or `api.mjs` when parking a replacement ask, and poll reads it |
| A6 kernel only woken by the watchdog | watching | `starci kernel report` already wakes the kernel after committing the row (practice 21/9, Derived 10). The remaining hole is a race inside the kernel's own turn: it consumes the report and only then decides to yield | Disagree with option (a) poll wakes it itself: the supervisor becomes a second liveness actor, duplicating the watchdog and against `supervise.yaml never`. The right fix: the kernel yields only after the latest `starci kernel status` returns no actionable frontier. One line in `driver-loop.yaml` + `kernel-prompt.md` |
| A7 codex lacks browser tooling | watching | `interface.draw` already uses `route.riskHints: [host-tool-required:image_gen.imagegen]` | The mechanism exists, not yet applied: `interface.audit` declares `host-tool-required:browser-dom`, the agent card declares the capability, route-model filters |

**Grit inside `poll.mjs` itself that Devin did not see.**

- `reportsSince` takes `LIMIT 30` and only then filters `report_id > since`. With more than
  30 reports in one interval the older reports are dropped, and `lastReportId` jumps past
  them permanently. It must be `WHERE report_id > ?`.
- The interval 180000 is written in three places: `supervise.yaml:30`, `:31`, `poll.mjs:30`.
- `poll.mjs` is a mechanism sitting under `modules/` (already noted in the host-boundary
  section).

**Grit inside Devin's own log file.**

- It sits at `starci-academy-backend/DEVIN_POLL_BUG.md`, outside `.claude`. The repo
  prescribes practice logs at `.experiments/practices/YYYY-MM-DD-<slug>.md` with
  Practiced/Observed/Derived/Open. Left outside, the next supervise round cannot read it.
- Section B (product findings) does not belong in a runtime file; it is audit evidence,
  belonging to the project's `.starciwork`. Devin labelled them correctly, only put them in
  the wrong place.
- A1 and A6 are two design decisions waiting on the owner, not bugs. They must be split out
  of the bug list so they are not wrongly "fixed" by a small patch.

**Work proposed from this round.**

- [ ] Move `DEVIN_POLL_BUG.md` to `.experiments/practices/2026-09-22-supervisor-round1.md`
- [ ] `poll.mjs`: `WHERE report_id > ?`; read `ask-serving-expired`; probe the remaining URLs
- [ ] `api.mjs`: unclassified worker-start error → `failureKind: 'worker-start'`, cooldown from `runtimes.yaml`
- [ ] `ask-superseded` event when parking a replacement ask
- [ ] `driver-loop.yaml` + `kernel-prompt.md`: yield only after the latest `starci kernel status` shows no work
- [ ] `interface.audit` `route.riskHints` + capability on the agent card
- [ ] Owner decision: does audit measure itself or trust the producer (A1)

### Addendum to Devin's new A7: a rejected dispatch still holds the binding

`rejectDispatch` (`api.mjs:1043-1046`) deliberately writes `payload.managed = {dispatchId: <rejected>,
rejectedBeforeContract: true}` so reconcile has evidence. But `explicitReportDispatchIdOf`
(`api.mjs:2016-2019`) and `reportDispatchIdOf` (`:2011`) read `managed.dispatchId` without
looking at the `rejectedBeforeContract` flag, while `requireDispatchedReportBinding` (`:2020`)
compares against `contracts.dispatch_id`. Contracts are right (new ctx), payload is wrong
(old ctx), so a valid report is rejected with `report-contract-unbound`. One field carries
two meanings: "live binding" and "reject evidence", distinguished only by a flag that readers
do not check.

Do not delete the binding on reject as Devin proposed: reconcile loses its evidence
(practice 21/9, Derived 4). The right fix: the report binding comes from the `contracts` row
(already the real source), and a rejected dispatch goes into `payload.rejectedDispatches[]`
instead of overwriting `managed.dispatchId`.

- [ ] `report`/`check`/`settle` take the dispatch from `contracts`, not from `payload.managed`
- [ ] `rejectDispatch` writes into `payload.rejectedDispatches[]`, does not overwrite `managed.dispatchId`

## Repo-wide grit roundup (2026-09-22, HEAD `6279f4895`)

Four agents swept four areas, and the assistant verified directly the items marked ✓. Numbers
in parentheses are file:line. Priority: P0 wrong behavior or misleads the reader; P1 causes
hallucination or drift; P2 hygiene.

### P0: wrong behavior, or docs promise what the machine does not do

1. ✓ CI `todo-app-example.yml:89,166` calls `node cli/main.mjs`, the `cli/` directory does
   not exist; `--config architecture.json` does not exist either. The workflow cannot go green.
2. ✓ No workflow runs `npm test`; CI runs only 1/86 specs. `example-coverage.yml:5` mentions
   a "root ci.yml" that does not exist. The `schemas/**` trigger (`:12,18`) is a removed path.
3. ✓ `api.yaml:224-229` declares 5 refusals for `enqueue` (`workflow-finished`, `unknown-op`,
   `already-queued`, `empty-paths`, `workflow-unknown`); `cmdEnqueue` checks none of them.
   Same file: `route-refused`, `spawn-failed`, `path-collision`, `path-illegal`,
   `plan-lineage-missing`, `contested-lease`, `effect-unknown` appear in no `.mjs`.
4. `api.yaml:106` "a read never mutates the ledger" but `observe` appends events (`:403`).
5. `supervise.yaml:41` promises ask URLs are "relayed only after re-verifying they answer
   200"; `poll.mjs` does not probe (Devin A4).
6. `calls.yaml:5-9` promises wrappers assemble argv from the contract and compare the live
   agent-context; no code does either (host-boundary section).
7. `providers.mjs` is called a fail-closed validator by `CONTEXT.md:31`; for claude/codex it
   only checks that the file parses.
8. ✓ Private age key `examples/todo-app-backend/.starcistacks/dev/runtime/env/demo.agekey`
   is tracked in git, and the CI `live` job decrypts with it. If it is a deliberate demo key,
   say so explicitly; if not, rotate it.
9. `dispatch.yaml:32` and `driver-loop.yaml:618` cite `engine/constants.mjs` for TTL/limits;
   the 11-line file only exports `ENGINE_SCHEMA` + `isEnrolled`. The real TTL is at
   `api.mjs:1095`.
10. `modules/goal/{anatomy,legality,archetypes,existing}.yaml` ~20 cites to functions that do
    not exist (`cutOpFor`, `goalPhase`, `reviseGoal`, `openOwnerAsk`,
    `applyWorkflowAmendment`...).
11. `selection.yaml:223` cites `model-policy.mjs`, which does not exist. `driver-loop.yaml:498`,
    `verdict-contract.yaml:139` cite `init/CLAUDE.md`; `init/` only has `AGENTS.md`.

### P1: contract contradictions, two authorities, ghost-context

12. Old model still alive: `_common.yaml:95` "3 rows × 3 cells, coordinator, secondary";
    `registry.yaml:15,43` `executionModes.solo` + `levels: [user-coordinator,...]`;
    `host/claude|codex/index.yaml:11,22` solo mode + coordinator roles. `driver-loop.yaml:769`
    says "there is no Coordinator". The `coordinator` vocabulary is still in
    `api.mjs:1397,1438,1550`.
13. Concurrency: `profile-registry.schema.yaml:30` `const: 3`; `runtimes.yaml:21` `20`;
    `host/claude/*` four places `3`; `_common.yaml` `3`.
14. `driver-loop.yaml:167` `cutExecution` splits one op into N parallel jobs;
    `dispatch.yaml:316` and `registry.yaml:41` `fanOutWithinOperation: forbidden`. One
    sentence is needed to say plainly that cut differs from fan-out.
15. The api verb list in 7 places, 7 different counts (README 8, CHANGELOG 8, CONTEXT 13,
    kernel-prompt 15, docs/cli 14, start-workflow.yaml ~13, api.yaml 17, code 18,
    `bin/starci.mjs:21` missing 5).
16. Blocker kinds in 3 places: `report-envelope.mjs:9`, `kinds.yaml:80`,
    `verdict-contract.yaml:79`, each with a "keep in step" sentence pointing at the others.
    Outcome list in 3 places. Effort vocabulary written twice within one function
    (`config.mjs:30,38`).
17. `normalizeOwnedPath` has 2 copies with different semantics: `api.mjs:1096` accepts
    glob/absolute/`..`, `engine/admission.mjs:12` rejects. The test holds a third copy
    (`op-ipc.spec.mjs:63`).
18. `readOwnerConfig()` copy-pasted in `start-workflow.mjs:60` and `route-model.mjs:57`, and
    each copy dynamic-imports `engine/config.mjs` as a third "preferred" copy.
19. The `workflows.phase` queued→running UPDATE + event is duplicated verbatim at
    `api.mjs:1124` and `start-workflow.mjs:616`.
20. `jobs.status` has no CHECK; the vocabulary lives only in `ledger-db.mjs:12` and
    `api.mjs:72-74`.
21. `CONTEXT.md:7` writes the `settle` enum as `done|partial|failed|ask|blocked`; that is the
    enum of report. `verdict-contract.yaml:60` `settle` is `pass|fail|blocked`.
22. `CONTEXT.md:43,61,63` describes the layout `features/<f>/{business,architecture,ui,...}`;
    `work-layout.yaml:9,12` uses the families `br, ac, fr, nfr, data, journey, decision, sds,
    ui, impl, uat`. `schemas/index.yaml:495,545,549` calls the SRS/SDS tree both
    "retired/dormant" and "current".
23. `supervise.yaml:26` "never writes the ledger" but the `kernel-dead` step runs
    start-workflow (claims an inbox row). `CONTEXT.md:5` chat patches `.claude` mid-flight vs
    `CONTEXT.md:75` runtime maintenance is a separate authority.
24. Numbers in prose: retry ×3/×5/×2 in 4 places; watchdog 300000 in 7 places; observe
    180000 in 3 places and collides with the supervisor poll and one Orca timeout; wedge 10
    minutes (`kernel-prompt.md:178`) vs stall 5-8 minutes (`driver-loop.yaml:667`), no
    constant in code.
25. Ghost `.json`: 8 profiles `registry.json`/`runtimes.json`; `dispatch.yaml:154`
    `goal-plan.json`; `runtimes.yaml:5,23` `config.json`; ✓ `engine/config.mjs` 6 error
    strings "Invalid config.json" while the file is `config.yaml`;
    `docs/config-format.md:10` lists a `config.example.json` that does not exist.
26. Other ghosts: `engine/constants.mjs:3` points at `bin/starci-skills.mjs`;
    `runtime-root.mjs:24` a function named `readDistJson`; `start-workflow.mjs:101-110`
    "half-landed lane" merges every file in `scripts/api/orca/`; `ledger-db.mjs:28-32`
    postmortem written as a docstring; `.gitignore:29` keeps an ignore only to tell of a
    deleted directory.
27. Docs vs code: `docs/installation.md:5` Node 20 vs engines 22.13; `:30` installs 6 skills,
    code installs 2; `docs/cli.md:5` denies `starci <verb>` which the bin has;
    `docs/ops.md:9` "31 manifests", actually 35; `docs/ledger-db.md:5` cites a `LEDGER_DDL`
    that no longer exists; `docs/releasing.md:20` relies on a `prepack` that is absent;
    `config.example.yaml:37` `model/runtimes.yaml` wrong path;
    `skills/define-goal:64`, `start-kernel:24`, `workflow-chat:31` describe output labels
    (`LEDGER`, `WILL-WRITE`) that the script prints differently.
28. Schema: ~28 `schema:` consts used in `modules/` are not in the `schemas/index.yaml`
    catalog; 2 files stamp a const different from `id` (`agent-hierarchy`, `goal-plan`);
    `verdict-contract.yaml:152` cites `starci/workflow-report@1` which does not exist;
    `knowledge/code-examples` two spellings of the schema id aliased inside the schema.
29. Language: Vietnamese in `skills/define-goal:30-31,80`, `CONTEXT.md:5`,
    `supervise.yaml:8`, `modules/goal/{anatomy,archetypes,legality}`, `verdict-contract:115`,
    `driver-loop:484`, `knowledge/patterns/be/comment.yaml:234`. `docs/` is clean.

### P2: dead code, tests, packages, hygiene

30. ✓ 10 `scripts/api/orca/*` wrappers nobody calls (orch-check/reply/send, run-show/use,
    task-list/update, worker-abandon/list/read). `scripts/agent/{health,kill,spawn}.mjs` are
    only mentioned by `docs/cli.md`. `admission.mjs` exports `ownedPathLeaseRequests`,
    `retryDisposition`, `deriveRetryLineage` used only by tests. `bias.mjs` has an export
    nobody imports even though `--routing-bias` is in define-goal.
31. ✓ 3 checks nobody runs: `sanitize-orca-fixture`, `probe-reference-conventions`,
    `spec/assets`. 3 checks of 28-38 KB called only by their own spec: `check-work-surfaces`,
    `check-work-history`, `check-work-replay`. Only 2/28 checks are called by op yaml.
32. Tests: 6 specs take nearly all of 272s (`npm-package` 261s because of a cpSync of the 503
    MB `packages/`); 4 specs hard-skip (`work-record-schemas` ×2, `work-change` ×2); 4 specs
    keep a "lane has not landed" scaffold that is now meaningless; 3 specs mostly
    `assert.match` on YAML prose (`progressive-spec-authoring` 57/64,
    `interface-audit-contract` 65/114); a second Orca stub inline in
    `start-workflow-restart.spec` with a different env var from the shared helper.
33. Packages: `packages/grammar/reference-renders/` 15 MB of PNG tracked, nobody reads it;
    `packages/package.json` workspaces only `eslint/*`, engines 20.9 vs root 22.13; `fe-kit`
    used only by examples. `examples/todo-app-backend/coverage/` tracked even though
    CONTRIBUTING forbids generated output.
34. `package.json`: no `check`/`lint`; `tests/` + `scripts/` ship in the tarball;
    `.experiments/` tracked. The local `config.yaml` has drifted from the example (`debug:
    true` is not documented).
35. `api.mjs` 2248 lines under the header "One thin command"; `engine/index.mjs` imports
    `scripts/checks/spec/` across layers backwards; `sleep` in `orca/lib.mjs` is a
    synchronous block.
36. Missing docs that are cited: `docs/kinds.md` (work-layout, check-example-work),
    `docs/model-catalog.md` (4 profiles), `docs/examples/todo-app-grit.md`,
    `examples/application-stacks/tiny-stateful`, `tests/sds-payload.spec.mjs`.

### Suggested order for alpha.2

1. **Facade**: P0.1–2 CI (`ci.yml` + fix or delete the todo-app workflow), P0.8 decision on
   the key.
2. **Contract tells the truth**: P0.3–7, 9–11. Each refusal or cite either has code or is
   deleted from the yaml. Evidence: `check-contract-cites.mjs` reads every
   `citation:`/`enforcedBy:`/`source:` and greps for what is cited.
3. **One authority**: P1.15–20. Verb list, blocker kinds, normalizeOwnedPath,
   readOwnerConfig.
4. **Bury the old model**: P1.12–14. Delete coordinator/matrix/solo, settle concurrency, cut
   differs from fan-out.
5. **De-sediment CONTEXT.md**: P1.21–23 plus the feedback-sediment section above.
6. **Numbers into data**: P1.24. Each number in one place in `runtimes.yaml` or
   `driver-loop.yaml`, code reads it.
7. P1.25–29 and P2 as capacity allows.

## alpha.2 lanes (2026-09-22, base `f87a8f34b`)

The fixing principles are in `CONTRIBUTING.md` under "Editing contracts and prose". Each lane
gets one worktree, one allowlist, commits on its own branch, no push. Fable merges in the
order A, D, B, C and only then plugs in E. Devin works directly on `main` under a separate
allowlist.

| Lane | Who | Allowlist | Work |
|---|---|---|---|
| A | Opus | `.github/**`, `package.json` scripts, `.gitignore`, `packages/package.json` engines | `ci.yml`, `check` script, `modules/schemas/**` trigger, ignore coverage |
| B | Opus | `modules/kernel/**`, `engine/**`, `scripts/kernel/{api,start-workflow,report-envelope,watchdog}.mjs` except Devin's region, `route-model.mjs`, `runtimes.yaml allocation:`, `kinds.yaml blockers` | verb surface + check, real refusals, observe, cites check, one authority for lists/functions, numbers into data, engine ghosts |
| C | Opus | `modules/models/**` except B's 2 regions, `modules/host/**`, `_common.yaml`, `modules/goal/**`, `modules/schemas/**`, `modules/quality/**`, `providers.mjs` | delete coordinator/matrix/solo, one concurrency number, dead cites, `.json` ghosts, schema catalog + check, host claims |
| D | Opus | `scripts/api/orca/**` delete, `scripts/agent/**`, 3 orphan checks, `tests/**`, `reference-renders`, `examples/**/coverage` | dead wrappers, test scaffolds, shared Orca stub, `npm-package.spec` < 60s, untrack coverage |
| E | Opus, after B+C | `CONTEXT.md`, `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/**`, `skills/**`, `.experiments/**`, `knowledge/` rename | de-sediment chat/kernel/watchdog, ghost `distless`, verb list cite, docs vs code, Vietnamese |
| Devin | Devin | `modules/supervisor/**`, `scripts/kernel/serve-ask.mjs`, `scripts/kernel/api.mjs` only `rejectDispatch`, `reportDispatchIdOf`, `explicitReportDispatchIdOf`, `requireDispatchedReportBinding`, `writeProviderCircuit` and the readiness/auth branch; `scripts/kernel/terminal-liveness.mjs`; `modules/ops/ops/interface.{implement,audit}.yaml` | A3–A8 in `DEVIN_POLL_BUG.md`, following the verdicts in the supervisor-poll section |

**Message to Devin (relayed by the owner):**

1. Read `CONTRIBUTING.md` under "Editing contracts and prose" before editing further.
2. Commit `1cc1f19ed` added the sentence "stale form URLs ... relayed only after re-verifying
   they answer 200" to `supervise.yaml` but `poll.mjs` does not probe. Either probe, or drop
   the sentence. The same commit's sentence "only the watchdog wakes them" is wrong: `api
   report` wakes the kernel after committing the row (`op-ipc.spec`). Fix the sentence.
3. Commit `e881f0159` stuffed a rule into `writes[].content` and joined three paths with `+`
   inside one `path` field. Rules go into `steps[].action`, one entry per path or one glob.
4. A7: do not delete `managed.dispatchId` on reject. The report binding comes from the
   `contracts` table; a rejected dispatch goes into `payload.rejectedDispatches[]`.
5. A6: do not let `poll.mjs` wake the kernel. Fix it in the kernel: yield only after the
   latest `starci kernel status` has no actionable frontier.
6. Move `DEVIN_POLL_BUG.md` into `.claude/.experiments/practices/2026-09-22-supervisor-round1.md`
   in the Practiced/Observed/Derived/Open format; put section B into the project's
   `.starciwork`.
7. `poll.mjs`: `reportsSince` must use `WHERE report_id > ?`, not `LIMIT 30` and then filter.

**Gates waiting on the owner:** is `demo.agekey` a demo or must it be rotated; fix or delete
`todo-app-example.yml`; may agents edit `examples/` records; A1 does audit measure itself or
trust the producer.

## Fable's decisions (2026-09-22, the owner delegated everything until `1.0.0-alpha.2` ships)

1. **`demo.agekey`: keep, it is a deliberate demo.** The key only opens the demo env of the
   `todo-app-backend` example and the CI `live` job needs it to run without secrets.
   Condition: everything encrypted with this key is a demo value, no real credential;
   `examples/todo-app-backend/README.md` and the workflow header carry one sentence "demo
   key, committed on purpose, encrypts demo values only". If the example later needs a real
   secret, the key moves into a GitHub secret and is rotated, not now.
2. **`todo-app-example.yml`: fix it to run with existing scripts, delete any step that has no
   script.** `node cli/main.mjs architecture check` is replaced by
   `node scripts/checks/check-scoped-lint.mjs --profile <nest|next> --root examples/<app> --all`
   and the equivalent architecture check in `scripts/checks/` if the example has config;
   otherwise the step is deleted. Do not keep `if: false`: a step either runs or does not
   exist. The workflow must be green on the current tree before merging.
3. **Agents may edit `examples/`.** The checkers and schemas under `modules/schemas/` are the
   authority; records in the example must match the schema, not the other way round.
   Evidence is regenerated by the owning script (`scripts/example/*`), not edited by hand.
   `tests/work-change.spec.mjs` and `tests/work-record-schemas.spec.mjs` drop their skips:
   write the 8 missing schemas from real records, fix records to match, or fix the checker if
   the checker is what deviates from `work-layout.yaml`.
4. **A1: audit measures itself.** `interface.audit` measures DOM/computed-style with the
   locked Playwright runner (the `uat.assisted.prepare` mechanism), through `E/screens` + the
   serving origin recorded in the producer's `E/runtime.json`. The producer's
   `E/measurements.json` is self-report; audit may cross-check it but it is never proof.
   Applies before audit round 2. This area is in Devin's allowlist; if Devin has not done it
   by the time lanes B, C, D have merged, lane G does it.

**Scope of `1.0.0-alpha.2`: every drift found in this file, nothing left behind.** The owner
decided on 2026-09-22: "all the drifts you found". Lanes by dependency:

| Lane | Waits on | Work |
|---|---|---|
| E prose | B, C | feedback-sediment section + ghost-context + P1.21–23, 25–29 docs/skills/CONTEXT part |
| F2 examples | C | 8 missing schemas from real records, drop 4 skips, evidence regenerated by script |
| G supervisor | Devin | items Devin has not landed when B, C, D finish: poll.mjs moves to scripts/supervisor, `WHERE report_id > ?`, ask-serving-expired, ask-superseded, worker-start failureKind, A7 contracts binding, A1 audit measures itself, riskHints |
| H op-shape | B, C | schema `starci/op@1`, `check-op-manifest.mjs`, typed `params` + `starci kernel enqueue --params` + packet.params, drop handoff/matrixHandoff without consumer, drop the `business` block, migrate 35 ops, fix the interface.draw case |
| I host-boundary | C, D | `lib.mjs` reads `calls.yaml`, live `agent-context` once per process, `providers.mjs --live`, `check-host-boundary.mjs`, `orca-cli` skill split from the kernel load path |
| J quality-bar | C | QUALITY-BAR Evidence group becomes a check (`done` → artifact exists + digest matches), tick checkboxes by check name |

**Exit conditions for alpha.2:** `npm run check` green, `npm test` with no skip other than
PowerShell 7, CI `ci.yml` and `todo-app-example.yml` green on `main`, the CHANGELOG alpha.2
entry lists exactly what landed, tag `v1.0.0-alpha.2` after the owner reviews the diff.

### Lane J landed: `check-evidence-binding.mjs` and three schema holes for F2/C

The check runs on real examples: todo-app-backend 122 `EVIDENCE_DIGEST_MISMATCH` (61
records) + 25 `ASSERTED_NOT_OBSERVED`; ecommerce-app-be 385 mismatches (10 records) + 2. This
is real drift, evidence older than source. F2 regenerates it with
`scripts/example/example-evidence.mjs`, not by hand.

Schema holes (C/F2 must close them before F2 drops the skips):

1. `codeDigest` is a field that both the example tree and `scripts/example/example-ownership.mjs`
   use, but no schema under `modules/schemas/` declares it. `work-evidence.schema.yaml` is
   `additionalProperties: false` so every `evidence.yaml` in the example fails its own schema.
2. `work-evidence.schema.yaml` requires `provenance.servedVersions[].{repository,commit,artifact}`;
   0 records have it. A required field nobody uses means either drop the requirement or the
   example is wrong.
3. `work-implementation.schema.yaml` requires `directory`, `files`, `revision`, `verification`;
   `work-layout.yaml` says the gate rejects `directory`/`files` and uses `owners[]`. Schema
   and layout overlap; `work-layout.yaml` is the authority, the schema follows.
4. `work-ui-screen.schema.yaml` has no viewport/breakpoint/theme/assets;
   `work-uat-flow.schema.yaml` has no video/recording/failure-path. Two QUALITY-BAR §5
   bullets cannot be checked yet because there is no field to read. F2 adds fields when
   writing the 8 missing schemas.

The check is not yet in `npm run check`: lane I or the final lane wires it into the
`package.json` `check`.

### Lane F1 landed: `todo-app-example.yml` runs exactly what exists

Four jobs `records`, `backend`, `frontend`, `live`; the old `uat` job (npm ci into a
directory without a manifest, an artifact glob nobody writes) is merged into `live`. The demo
key opens 10 `.enc` files, all short lowercase phrases, no vendor prefix, no DSN. Decision 1
stands.

Two steps are still red on the current tree, left alone because they are real drift:

- `check-example-work.mjs` rejects 207 records (180 todo-app-backend, 27 ecommerce) because
  `recordDigest`/`codeDigest` are stale. F2 regenerates them with `scripts/example/*`.
- `check-scoped-lint.mjs` for both profiles returns `ARCH_CONFIG_INVALID` because the
  example's `package.json` declares `file:../../packages/{e2e,fe}-kit` which lies outside
  `--root`. The check needs to understand a dependency path outside root when it is inside
  the same repo (`scripts/checks/check-scoped-lint.mjs`, assigned to F2). Profile `next` adds
  `CANON_VERSION_MISMATCH`: `modules/models/code-patterns.yaml:456` pins fe canon `3.0.2`,
  `packages/eslint/fe/package.json:3` is `3.1.0` (lane C).
- `modules/ops/ops/uat.verify.yaml:165` declares evidence under `E/`; the real harness
  `examples/todo-app-frontend/e2e/lib/paths.ts:36` writes `runs/<runId>/...` without `E/`
  (lane H when migrating ops).
- 18 `.webm` UAT files tracked under `.starciwork/**/videos/`: runner-generated evidence,
  keep.

### Lane D landed: 10 wrappers, 3 CLI shells, 2 orphan checks deleted; shared Orca stub; coverage untracked

Kept with reasons: `terminal-list` (the workflow-chat skill calls it), `bias.mjs`
(`--routing-bias` is alive end-to-end via define-goal → goal row → `cmdRoute`),
`probe-reference-conventions.mjs` (cited by knowledge), `reference-renders/` (cited by
interface.audit and QUALITY-BAR).

Work that falls to other lanes:

- C: `calls.yaml` still has 10 entries without wrappers (`run-use:60`, `run-show:66`,
  `task-update:79`, `task-list:85`, `worker-read:144`, `worker-list:150`,
  `worker-abandon:174`, `check:199`, `send:206`, `reply:212`) and `:34` says reconcile reads
  `task-list`/`worker-list` while only `worker-show` has code. Delete the entries or state
  plainly "not issued by StarCi".
- E: `docs/cli.md:56,59,60` and `docs/host-contract.md:111` point at the deleted
  `scripts/agent/{spawn,health,kill}.mjs`.
- B: the comment at `engine/ledger-db.mjs:296` mentions `sleep`, which was renamed
  `sleepSync`.
- H: `interface.implement.yaml:268-283` declares the asset-manifest shape that the validator
  `spec/assets.mjs` (deleted, never called) used to check; now the contract has no
  executable. Give it a check or lower the claim.
- F2: 4 critique files in `examples/*/.starciwork/_derived/` carry the old path stamp,
  regenerate.
- Nobody has wired: `check-work-{surfaces,history,replay}` are called only by their own spec.
  Only 2/24 checks are called by ops. H decides when migrating ops (which check the proofs
  cite).
- `probe-reference-conventions.mjs` needs `eslint` + `@typescript-eslint/parser`, which are
  not in the tree; Fable decides: keep as an external-only workflow, say so in the header, do
  not add a devDependency.

Note for every lane: the worktree has no `config.yaml` (untracked) so `goal-entry.spec` ×2
and `json-exceptions.spec` fail in the worktree but not on `main`. That is not a regression.

### Lane C landed: old model buried, one concurrency number, schema catalog with check

`registry.yaml` has one `executionModel`; `host/claude|codex` keep one real `index.yaml` per
host; `_common.yaml` is free of matrix/cell; `runtimes.<pool>.maxParallel` is the only number
the code enforces; ~25 ghost function cites in `modules/goal/` became rules the yaml owns
itself; the `.json` ghosts are gone; `check-schema-catalog.mjs` covers 54 stamps;
`json-exceptions.spec` is green again (it was red before because 4 storybook paths do not
exist on disk).

Work that falls to other lanes:

- B: `driver-loop.yaml:289` cites `maxParallelOps` which nobody enforces, either enforce it or
  drop the cite; `driver-loop.yaml:484`, `verdict-contract.yaml:115` still carry a leftover
  Vietnamese phrase; `engine/config.mjs` 6 `config.json` strings (already in B's brief).
- H: ~15 ops still have `reads: matrix` / `writes: matrixHandoff`, keeping the matrix
  vocabulary alive through the generated registry. Drop when migrating op-shape.
- `maxParallelOps: 20` kept temporarily because B cites it; after B decides, C or H deletes
  it.

### Lane B landed: kernel contracts tell the truth, one authority for verbs, lists, functions, numbers

18 verbs on every surface + `check-api-surface.mjs`; refusals only remain what the code
prints (`empty-paths`, `unknown-op`, `workflow-finished` implemented with specs; 3 ghost
refusals deleted; 5 renamed to the real strings); `observe` moved to the write group in
`api.yaml`; `check-contract-cites.mjs` covers `modules/kernel`; blocker kinds/outcomes/
effort/job status each in one place; `normalizeOwnedPath`, `readOwnerConfig`, phase
transition each one implementation; numbers into `runtimes.yaml allocation.*`; engine/kernel
ghosts gone. Fable wires three new checks into `npm run check` (`check-api-surface`,
`check-contract-cites`, `check-schema-catalog`).

Fable's decisions on the points B left open:

- `already-queued` dropped because `cutExecution` deliberately enqueues N jobs of the same
  op; the real fence is the path lease. No cut-aware refusal is added in alpha.2.
- No `CHECK(status IN ...)` is added to `jobs`; `JOB_STATUSES` in `ledger-db.mjs` is the
  vocabulary.
- `readDistJson` rename: the last lane (K) does it together with
  `check-scoped-lint.mjs:7,186`.
- The refusals of `report` (`report-contract-unbound`, `report-dispatch-unbound`,
  `report-job-not-active`) are documented after Devin/G fixes A7.

Work that falls to other lanes:

- E: `README.md:17` 8 verbs; `docs/ledger-db.md:149-153`, `docs/host-contract.md:131`,
  `docs/workflow-kernel.md:89` still carry deleted refusal names;
  `docs/examples/todo-app-standard.md:111,194` path `scripts/example-evidence.mjs`;
  `runtimes.yaml:5,23` "config.json"; bare filenames in `citation:` at
  `modules/goal/anatomy.yaml:344`, `legality.yaml:310-425`,
  `modules/schemas/relationships.yaml:46-137` (E or H, run
  `node scripts/checks/check-contract-cites.mjs --scan modules --scan docs --scan CONTEXT.md --scan skills`).
- C already handled: `selection.yaml` model-policy cites, profiles model-catalog,
  `work-layout.yaml:38`, `schemas/index.yaml:520`.

### Lane I landed: host boundary enforced

`lib.mjs` reads `calls.yaml` to assemble argv, live `agent-context` runs once per process
before the first mutation, `providers.mjs --live`, `check-host-boundary.mjs` is in `npm run
check`, and the three skills orca-cli/orchestration/computer-use state "for the owner's chat
only". 8 `calls.yaml` entries without wrappers deleted; `check` and `send` kept because
recipes need them, with the missing wrapper stated. Fable deletes the inline `orca account
list` fallback in `scripts/api/quota/orca-account.mjs`.

### Lane E landed: prose says one thing, once

`CONTEXT.md` 38 paragraphs → 29, nine contradictions removed (chat three roles, watchdog
liveness-only, settle enum, work layout cite, host boundary in one sentence).
README/CONTRIBUTING/CHANGELOG cite the authority; docs match the code; skills name the reader
and the labels exactly as the script prints them; `.experiments` S* row is the real layout.

Remaining for the closing lane K (after H, G, F2):

- 16 bare-filename cites need full paths: `modules/goal/anatomy.yaml:345`,
  `modules/goal/legality.yaml:313,326,352,415,422,429`,
  `modules/schemas/relationships.yaml:46,49,52,55,55,58,61,64,137`.
- `config.example.yaml:37` `model/runtimes.yaml` → `modules/models/runtimes.yaml`.
- `scripts/example/example-render-proof.mjs:9` cites `docs/examples/todo-app-grit.md`;
  `scripts/checks/check-example-work.mjs:484,504` cite `docs/kinds.md` (F2 may have fixed it).
- `.gitignore:2` `/.dist*/` ghost.
- `readDistJson` rename + `check-scoped-lint.mjs:7,186`.
- `check-contract-cites --scan modules --scan docs --scan CONTEXT.md --scan skills` must be
  clean; wire this wide scan into `npm run check` instead of only `modules/kernel`.
- `check-evidence-binding.mjs` and `check-op-manifest.mjs` (H) into `npm run check`.

### Lane H landed: `starci/op@1`, typed params, 36 ops migrated

619 findings → 0; catalog 13,522 → 10,829 lines; `business`/`handoff`/`matrixHandoff` gone;
params: `interface.draw.candidatesPerScreen=1` (owner, max 3), `interface.audit.maxRounds=5`,
`provision.ask.minOptions=2`, `work.author.{maxFiles=12,maxProofDemands=8,componentsTriggeringCut=3}`,
`*.decide.readingsStated=3`. A1 audit measures itself landed. Two silent corruptions fixed:
blockers `AUDIT_SCOPE_INCOMPLETE`/`AUDIT_INPUT_CHANGED` used to parse into a `null` key;
`uat.verify` `E/` path.

## orca-hierarchy: why the Orca sidebar is a mess (2026-09-23, ledger nivo-backend)

The owner sees in Orca: two `[Kernel] wf-nivo-workspace-provision`, two `[Op] interface.implement`
gpt-5.6-luna 18h sitting at the root, an "Idle" op under one kernel. Cross-check:

| Sidebar | Real ledger/Orca | Cause |
|---|---|---|
| 2 WSPV kernels | signal `kernel` points at `term_d2f101cf`; terminal `term_aef50872` "Kernel orchestration…" is still alive and not in the signal; the kernel job is at attempt 4 | A kernel restart (watchdog/supervisor `start-workflow --goal`) creates a new terminal but does not close the old one |
| `[Op] interface.audit - Idle` under a kernel | job `interface.audit a4` **failed** 15:52, dispatch `ctx_23ab4762` was rejected at worker-start (exactly Devin's A7), terminal `term_b6fa4c43` still open | `rejectDispatch` releases the lease but does not close the terminal it created |
| 2 `[Op] interface.implement` luna 18h at root, ticked | `interface.implement a19` succeeded via managed worker codex `ctx_427183f`; the old managed Tasks | Settle only does `worker-stop` + `worker-release`, does not delete the Task; the Task belongs to a Run bound to the **old** kernel terminal, the restarted kernel has a new terminal so the Task falls out to the root |
| Title "devin.exe: Kernel orchestration for…" | `[Kernel] <wf>` is applied only to the Task display name | Terminal rename exists only for managed workers, not for Devin terminals |

The ledger's `starci kernel hierarchy` is right: every op has `parent = agent:kernel:<wf>`. What is
wrong is the Orca tree (Run → Task → terminal), which is not synchronized on kernel restart
and when a job ends.

**Rule:** a workflow has exactly one live kernel terminal; a finished job (settle, reject,
finish) leaves no live terminal or Task behind; the workflow's Run is always bound to the
current kernel terminal.

**Lane L (after G, since both touch `rejectDispatch` and settle):**

- [ ] `start-workflow.mjs` restart: close the old kernel terminal (`terminal-close`) before
      writing the new signal; if closing fails it is an incident, not silent
- [ ] `rejectDispatch`: a terminal/worker that was already created is closed (`terminal-close`
      or `worker-stop` + `worker-release`) in the same reject transaction
- [ ] settle/finish: close the terminal for every adapter, and for a managed worker move the
      Task to done/archived through a wrapper that has a contract (restore `task-update.mjs`
      which lane D deleted because nobody called it; now someone does)
- [ ] Kernel restart: the workflow's Run re-binds to the new kernel terminal (restore
      `run-use.mjs` if Orca needs that command), so new Tasks sit under the new kernel
- [ ] Devin/command-terminal terminals: set the title `[Kernel] <wf>` / `[Op] <op> a<n>` at
      creation (`terminal-create --title`) instead of letting the provider choose
- [ ] `check`: a check that reads the ledger + `terminal-list` and reports a live terminal
      belonging to no live job (`ORPHAN_TERMINAL`), a workflow with >1 kernel terminal
      (`DUPLICATE_KERNEL`)
- [ ] Practice entry for this round

**Exact root cause (from reading code 2026-09-23):**

1. `scripts/kernel/start-workflow.mjs:563-565`: a kernel restart `UPDATE jobs SET payload_json=?`
   replaces the **entire** payload of the kernel job, so `orca.runId` is lost. The next
   dispatch calls `ensureWorkflowRun` (`api.mjs:1465`), does not see a runId, and
   `run-create`s a **new** Run bound to the new kernel terminal. Old Tasks in the old Run,
   new Tasks in the new Run: those are the two trees in the sidebar.
2. `start-workflow.mjs:438-455`: a stale kernel is `releaseManagedWorker`d only when it is a
   managed dispatch; a Devin kernel (`launch: terminal`) is never `terminal-close`d. The
   signal is deleted, the job is marked `stopped`, but the terminal lives on.
3. `createOperationTask` (`api.mjs:1506`) creates the Task with `run` + `from`, without the
   `parent` flag that `task-create` has. The Orca tree is derived from the Run, so (1) is
   enough to break it.

`.claude` **does** enforce at creation: every op is a Task in the workflow's Run, `from` the
kernel terminal, and the ledger `hierarchy` is the source of relations. `.claude` does
**not** enforce continuously: restart does not keep the Run and does not close the old
terminal; reject does not close the terminal; settle does not clean up the Task; no check
compares the ledger with `terminal-list`. Lane L fixes exactly these three points: keep
`orca.runId` across restart (merge the payload instead of replacing), close the old kernel
terminal for every adapter, and the check.

## parallel-gear: number of parallel agents by task size, the owner turns one knob (2026-09-23)

The owner's idea: a long task gets 3 agents, a very long one 6; turn the knob up and it is 5
and 10. The owner adjusts only one thing.

**Current state.** `config.yaml budgets.maxOps` is only validated, nobody enforces it. The
real number is `runtimes.<pool>.maxParallel`. `starci kernel estimate` computes slices from
`allocation.slicing` by a 15–30 minute window, not by size class. The owner has no knob.

**Design.**

```yaml
# config.yaml (owner)
parallel:
  gear: 1          # 1 = normal, 2 = high; extensible, never renamed
budgets:
  maxOps: 8        # ceiling on running ops of one workflow, now really enforced

# modules/models/runtimes.yaml (runtime data)
allocation:
  slicing:
    size:                                   # size classes by measured closure
      l:  {from: {files: 12, assertions: 40},  agents: {1: 3, 2: 5}}
      xl: {from: {files: 40, assertions: 150}, agents: {1: 6, 2: 10}}
```

- `starci kernel estimate` returns `size: s|m|l|xl`, `agentsRequested` (from the table × gear),
  `agentsAchievable` (the number of path-disjoint slices that can actually be cut) and
  `reason` when achievable < requested.
- `s`/`m` tasks are always 1 agent. The table applies only to `l`, `xl`.
- The hard ceiling is still `runtimes.<pool>.maxParallel` + provider slots +
  `budgets.maxOps`. Gear does not raise the ceiling; when slots run short the remaining
  slices stay queued and `starci kernel status` says why.
- The `from` thresholds come from real data: the closure of implement/refactor jobs in the
  nivo ledger (read a copy, read-only), not guessed.
- `starci kernel status` adds `queuedBecause` for each queued job: `pool-full`, `path-lease`,
  `dependency`, `circuit-open`, `max-ops`.

Lane M (Opus) does this.

### Lane F2 landed: 8 schemas, 4 skips dropped, evidence replay, `file:` boundary fixed

Rejected records 292 → 2 (two `accounts.yaml` in ecommerce containing literal credentials,
left as is). The schema was what deviated, not the records, except 23 hand-edited inputs
listed in the report. `check-scoped-lint` profile `next` now really runs: 108 real
`ARCHITECTURE_VIOLATION` in `todo-app-frontend`, previously masked by `ARCH_CONFIG_INVALID`.
10 ui/brand manifests that used to claim pass now really fail because their `verify-*.mjs`
previously could not even load.

**Still red, and why:**

- `check-example-work` still has 88 records with stale digests; 58 evidence records need
  Docker (Postgres/Keycloak, compose, SePay sandbox) to replay. On this machine Docker
  Desktop is off. → The owner turns on Docker Desktop, the assistant plugs in lane F3 to
  finish the replay. Without this step the `records` job of `todo-app-example.yml` stays red.
- The 26 `ASSERTED_NOT_OBSERVED` are all `work/gap@1`: a gap is an authored-by-nature record,
  it needs to be added to `AUTHORED_BY_NATURE` in `check-evidence-binding.mjs` (lane K).
- `examples/todo-app-backend/architecture.json`: 8/10 owner entries point at a barrel
  `<module>/index.ts` that does not exist and is forbidden by the `import-owner-entry` rule
  itself. The example's contract contradicts itself; lane K fixes the owner entries to
  follow the rule.
- `CANON_VERSION_MISMATCH`: `code-patterns.yaml:456` pins fe canon 3.0.2 vs `packages/eslint/fe`
  3.1.0 (lane K).

### Lane L landed: the Orca tree follows the ledger continuously

The Run survives restart (payload merge instead of replace), the old kernel terminal is
closed before the new signal is written, Tasks have `parent` and title `[Op] <op> a<n> · <wf>`
at creation, reject/settle/finish close the terminal, worker and Task (`task-update --status
done`, wrapper restored), `check-orca-tree.mjs` reports
`DUPLICATE_KERNEL`/`ORPHAN_TERMINAL`/`DEAD_KERNEL`/`TASK_OUTSIDE_RUN` every poll round. The
rule is at `modules/kernel/start-workflow.yaml orcaTree.rule`. Still open: Orca has no verb
to archive a Task; `TASK_OUTSIDE_RUN` only reports, it cannot reparent.

## Model catalog (owner finalized 2026-09-23)

Drop entirely `gpt-6-astra`, Claude Fable (pool `claude-fable`, `fable-astra`), every
`gpt-5.6-*`, `claude-opus-5`. The catalog keeps only:

| Model | Id | Price in/out per MTok | Source |
|---|---|---|---|
| GPT‑6 Sol | `gpt-6-sol` | $2 / $10 | owner, 2026-09-23 |
| GPT‑6 Luna | `gpt-6-luna` | $0.10 / $0.50 | owner, 2026-09-23 |
| Claude Opus 5.5 | `claude-opus-5-5` | $4 / $20 | platform.claude.com models overview; 1M ctx, 128K out, adaptive thinking always on, API default effort `medium` |

Codex pool: easy/medium `gpt-6-luna`, hard/insane `gpt-6-sol`. Claude pool every tier
`claude-opus-5-5`. Devin unchanged. The catalog does not store prices. Lane N does this,
together with the list of keys in the owner's local `config.yaml` that need changing.

## supervisor night log 2026-09-23

Supervisor: the session "Upgrade .claude context", poll every 10 minutes (`config.yaml supervisor.pollIntervalMs`),
following `modules/supervisor/supervise.yaml`. Two workflows: AUTH `wf-nivo-app-auth-mub1d7gs`,
WSPV `wf-nivo-workspace-provision-mub1hxxt`.

- 03:05 WSPV kernel reports every dispatch dying at `task-create`. Cause: lane L passed a terminal
  handle into `--parent`, Orca only accepts a task id; the fake Orca accepted it so the suite was green. Patched
  `3861d7723`, the fake Orca now rejects a non-task parent, `calls.yaml` records the value type. Told the
  kernel via `terminal-send`; the kernel re-dispatched, audit round 2 started and reported `done` at 20:11.
- 03:08 `supervisor.pollIntervalMs` into config (`e749d0c76`); lane M merged (`93536d4b5`).
- 03:12 `queuedBecause` reported wrongly: the intake leg `request.analyze` that never had a job was treated as blocking
  every job, `actionable` stayed true. Patched `bd1647a4b`: a previous leg only blocks when it has a waiting/running job;
  `readyOperations` counts only `ready` jobs. This exposed a real bug in WSPV: 4 parallel audit cells all hold the same
  path `.starciwork/kernel-evidence/<wf>` so the path lease queues them (open, see below).
- 03:14 Another session blindly replaced `gpt-5.6`→`gpt-6` and wrote `interface.draw` output straight into the `main`
  tree; the supervisor's commit swept in the rename by mistake, and was split apart again. The stray change was stashed
  (stash@{0}, not deleted). 03:17 that session committed `43ddc335a` while the supervisor was resolving the lane N merge
  conflict: the content is right (lane N + the conflict resolution), the message is wrong ("astra, Fable unchanged").
  Messaged the session "Starci backend prompt batching".
- 03:20 Lane N enters `main`: the catalog only keeps `gpt-6-sol`, `gpt-6-luna`, `claude-opus-5-5`.
  The owner's `config.yaml` changes pools `fable-astra`/`opus-sol` → `sol-opus`, validate OK. Lane M's pool-full
  spec fixed to `claude-agent` (`9be80cf96`).

- 03:30 Patched `path-kernel-custody` (`1f69780ec`): enqueue rejects owned paths inside
  `kernel-evidence|kernel-strays|kernel-approvals`. Digest merges `TASK_OUTSIDE_RUN` (`c7cee13da`).
  The draw session confirmed `43ddc335a` is its own (it committed the whole index by mistake); it will land the ui records
  itself with `git commit --only`. The fork session opened the archetype lane spec-foundation/greenfield-scaffold,
  the supervisor will merge.

- 03:50 The owner delegates: "I'm going to sleep, you approve on your own, as long as the workflows are done when I
  wake up". The supervisor answers UI/direction asks in the owner's place, stating in the receipt note that the answer
  is given under delegation, with the reason. Not done: human UAT (login, the owner's OAuth consent), choosing the payment
  provider (`decision.workspace-provision.payment-provider-shortlist` is still open). Additional patches: asks in the
  owner's language + each option with an image (`759b02af0`), the UAT runner spawning npx on Windows (`ca21ddb89`,
  `cc3d29d93`), watchdog `--repair` + wake only when actionable (`e21a2e77d`).

- 04:00 Under delegation, the supervisor answered the AUTH login ask `ctx_1db4e4509029`: Desktop A + Mobile A
  (split layout, flat form; mobile in the same flat family), reason recorded in the receipt note. The AUTH kernel
  continues with implement a12 → audit a3. WSPV is rewriting the checkout-review ask in Vietnamese with images.
  F3 finished (53/65 replays, 19 real failures) but is held from merging because the draw session has not yet landed the
  ui records in the same files. F3 reported two script bugs: `example-derive.mjs:215` ignores the outcome of evidence (a
  failing record still derives `done`), `check-example-work.mjs:557` lets through a `done` record whose evidence fails.

- 04:10 The new WSPV ask `ctx_8cc8fa06b8bd` is up to standard (Vietnamese, 4 mismatch points, each direction with an image
  and a cost). The supervisor chose A (keep it like a real product): do not display what does not really exist; A does not
  commit to a payment provider. Statistics since 21/9 09:27: AUTH 24 succeeded / 23 failed (13 blocked,
  10 verdict fail); WSPV 39 / 54 (24 blocked, 30 verdict fail). Blocked is where the waste is, worth digging into.

- 04:40 The owner decided: run on `main` by default, worktree only when the prompt asks for it (`3557748a4`). Deleted the accounting
  worktree (already in main); committed the 206-file WIP refactor to its own branch (`bab51287`), not merged.
  The owner asked for two new workflows (3 modules + AgentOS; Collab group chat): the plan printed the wrong chain because
  the full-stack archetype is missing; the fork session adds `feature-build-fullstack` in the archetype lane, goal not yet persisted.
  Lane P (4 waste patches) is running in a worktree because it edits the api.mjs of a running kernel. `check-orca-tree` skips
  terminals of other ledgers (`0c434ed88`).

- 04:45 The owner typed `ok` for the two new goals (nivo-modules-agentos, nivo-collab-group-chat), conditionally: persist +
  start-kernel only when the re-planned plan prints exactly the chain `request.analyze > scope.define > business.decide >
  architecture.decide > interface.draw > work.author > backend.implement > interface.implement >
  interface.audit > e2e.verify > uat.verify > review.verify` (brand.decide only when there is no approved brand yet).
  If it deviates, do not persist, leave it for the morning.

- 05:05 Merged the fork session's archetype lane (`533f76be1`). Re-planned both goals: the original prompt wrongly matched
  spec-foundation (5 legs, no implement) because of the phrase "close the missing SRS/SDS"; the modules prompt wrongly matched
  refactor because of the WIP branch name. Reworded (keeping the meaning, dropping the two confusing phrases) both come out as 13
  full-stack legs, but with `brand.decide` while nivo already has an approved brand (rev 1, 21/9) → against the owner's condition, NOT persisted.
  The fork session fixes both planner bugs (spec-foundation priority, the brand condition) in a new branch.
  The reworded prompt used to persist: drop "missing SRS/SDS" → "finish the remaining business decisions and the
  architecture"; drop the WIP refactor branch sentence from the modules prompt (WIP is reference only, noted here).

- 05:20 Lane Q (difficulty-based routing from the fork session) is green but MERGE is DEFERRED until morning: it changes the route of every op
  for the two running kernels; thinking work would try claude-agent first, but Claude Code on this machine has not finished
  onboarding (the quota probe still says ok, it does not see the onboarding screen) → every think dispatch is
  refused by readiness, rests 5 minutes, and then still goes to codex; a medium implement moves to a different pool between
  audit repair rounds. Morning: the owner finishes Claude Code onboarding → merge lane Q (trial merge only conflicts
  in tests/config.spec.mjs) → the owner decides whether to pin the kernel.

- 05:40 The owner said merge now: lane Q (`6342c1e1d`) and the planner fix (`5ea28d7d2`) into main. Re-planning gives exactly 12 legs,
  brand recorded as assumed → persisted per the owner's ok: `wf-nivo-modules-agentos-mud6zg6y`,
  `wf-nivo-collab-group-chat-mud6zgff`. The Collab kernel is running (devin). Modules kernel: devin died right away twice
  ("prompt was not consumed", terminal exited empty) — suspect the Devin session ceiling because the owner's Devin desktop app still has
  ~24 processes from 20h; codex twice "Timed out waiting for terminal handle" on the Orca side. Not running yet. Lane P finished
  (4 patches, replay changed no job) but collides with lane Q in 6 routing files → the lane P agent is merging main into its branch.

- 06:00 The owner shut down the Devin desktop app (36 → 10 devin processes) → the modules kernel boots right away on devin
  (`term_b33015f6`). Watchdog `--repair` for the two new workflows. Merged lane P (`1aacfc3c5`, combined with lane Q):
  audit and draw route to codex (the agent with a browser/ImageGen in the think group). The fork session reports Orca
  cannot create an interactive Codex terminal since ~21:45 Orca time (every repo) → audit/draw cannot be dispatched
  until Orca is unstuck; told the 4 kernels to keep codex jobs queued, one incident, no retry loop.
  Lane Q2 (kernel by group) conflicts with lane P → the fork session merges main into Q2.

- 06:05 tick: WSPV implement a27 done, 1 implement running, 1 ask waiting for re-enqueue. Modules: scope.define a1
  done, frontier orphaned-frontier (the kernel is about to derive the next leg). Collab: scope.define a1 blocked, a2 done. AUTH: the kernel
  is reading the draw a5 report to re-serve the login ask (unserved > 1h). No patch.

- 06:15 Merged lane Q2 (`6dd4bdd20`): an unpinned kernel self-selects within the group Claude Opus 5.5 → GPT-6 Sol by quota,
  boot automatically switches member when a launch fails without leaving anything behind. config.example ships the group; the owner's config.yaml still
  pins devin/swe-2-max, loads OK. check + 63 specs green.

- 06:30 tick: Modules runs 6 business.decide cuts in parallel; Collab scope.define done (a3). The AUTH login ask is live but the
  form shows 4 radio groups for buying a workspace from WSPV: serve-ask took the newest draws.yaml of the whole tree when the report only listed
  draws.yaml. The supervisor answered Desktop B + Mobile B under delegation (left the 4 off-topic groups blank, reason recorded). Patched
  serve-ask (`c2e4564cb`): images come from the report's draws.yaml, dropped the global fallback, when options exist do not infer picks.
  Merged the fork session's lane P3 (`f68c490be`): the baseline pins the nest/next toolchain versions.

- 06:45 tick: Modules 6 business.decide cuts (3 partial, 1 done); Collab business.decide 2 done 1 partial, 9 jobs ready;
  AUTH interface.draw running on gpt-6-sol (managed worker-start still works, only the interactive Codex terminal
  is broken); WSPV implement a29 partial. 8 times claude was refused at worker-start in 50 minutes (onboarding) → the circuit resets after 2
  minutes → loop. Patched backoff (`7a8281413`): reopening on the same error within 1h rests x5, up to 1h.

- 06:55 tick: AUTH interface.draw a6 done (direction B+B). Collab business.decide 6 done, 1 partial, 1 blocked,
  transition-ready. Modules 3 jobs ready. The watchdog does the right thing: sees active and does not touch it, AUTH reports idle-waiting when the
  frontier is not actionable. No patch.

- 07:00 The fork session reports Orca can create interactive Codex terminals again since ~22:30 Orca time; told the 4 nivo kernels to stop holding
  Codex jobs. The fork session opens lane P4: the Nest/Next baseline passes check-scoped-lint (module layout + architecture
  config, canon has one authority).

- 07:15 AUTH is repeatedly woken by the watchdog: the kernel writes "[owner-gate-pending]" in prose, while status still reports 2 cuts of
  integration.verify as ready. Patched `6b6f0579f`: `starci kernel incident --kind owner-gate --holds` holds the job (queuedBecause
  owner-gate, route/dispatch refuse), `--resolve` closes the incident (also the missing resolve verb). The AUTH kernel has
  moved to a structured gate (inc-4f9f44eb513a), actionable=false. Collab is stuck at a question dialog of the Devin CLI;
  the watchdog typed its wake-up text into the "Other" box because the ❭ cursor looks like a prompt. Patched `134fee6a0`: gate agent-question-dialog
  + kernel-prompt forbids asking the owner via dialog. The supervisor pressed Esc on the dialog, answered 3 Collab decisions under delegation:
  read-scope shared-office-read, safe-mode mandatory-category-gate, quality-targets provisional thresholds 2s/5s/3s p95.
  The contradiction between scope.define (writes work/node@1) and work-layout (forbids new work/node) is assigned to a background lane.

- 07:35 The background lane finished `b3469b05d`: scope.define writes scope onto the feature record (extensions.work3.scope), dropped
  work/node@1; spec scope-define-layout. The supervisor added `034fbe6bb`: business.decide keeps scope intact when rewriting the
  overview. Told the Modules kernel about the stray work/node record at features/project-overview/scope. Collab: 6 business.decide slices
  done with the delegated answers. WSPV audit round 3 blocked because the evidence is out of step with the revision
  (aae8d15 vs 02b3c0d) and the accessibility hash is computed on compacted JSON; op fault (runtime.json is written by the op itself),
  the kernel is handling it. Backlog: workspace.manage still writes the root "setup scope record" (work/node@1) and _common.yaml
  still says the root record carries work/node@1; kinds.yaml still has work/node@1 for workspace.manage and scope.finish.

- 07:45 Merged lane P4 `a26456e6d`: the Nest/Next baseline passes check-scoped-lint, typecheck, test, build and boot.
  Reviewed 4 checker changes: settingMatches only accepts exactly defaultOptions, drop spec from NEST-FEATURE-FILE-SHAPE,
  allow empty transports, and a named export default counts as a subject. After merge: check green, specs 31/31.
  Asked the fork to put the baseline e2e test (~4.5 minutes, installs packages) behind an env flag, run in the release checklist.

- 08:00 Answered the Modules ask (business.decide a8, public Sales route) under delegation: option 1, register the
  versioned Sales operations in Shared, keeping the approved meaning; the kernel was woken. The question shows "Ch?n
  tuy?n" (garbled "Select route"): 7 business.decide reports were written by PowerShell in the old code page, while the yaml records are intact.
  Patched `d3932b804`: starci kernel report rejects prose that lost non-ASCII characters, the packet instructs to write report.json as UTF-8. Merged
  `lane-p4/e2e-flag` (the baseline e2e test only runs when STARCI_E2E_BASELINE=1). The fork reports a stale-input gap (a job that has
  settled is not marked stale when a knowledge input file changes digest); assigned the fork to do lane P5.

- 08:10 Quiet. Collab architecture.decide 8 slices done; WSPV implement a31 done, kernel handling it (transition-ready);
  Modules business.decide a10 partial, waiting for an op; AUTH owner-gate 4 + dependency 3, idle-waiting correctly. No patch.

- 08:25 WSPV transition-ready for 13 minutes while the kernel reports active: the kernel's summary sentence "Running now:" was read as a spinner,
  so both wake-on-report and the watchdog skipped it. Patched `667195c4c` (status word + ":"/"now" is prose) + spec; woke
  WSPV, the kernel is running. Modules has consumed the report, is running 7 ops in parallel and cleaned up the stray scope record. AUTH, Collab wait correctly.

- 08:35 Quiet. Collab moves to interface.draw (worker active). Modules 7 ops running, scope.define a2 done (stray scope cleaned).
  WSPV kernel active, 1 leased job dispatching. AUTH waits on owner-gate. Watchdog: 3 idle-waiting, 1 active. No patch.

- 08:50 The fork reports work-record-schemas red on main: the supervisor's own bug in b3469b05d (an open scope object). Patched `2e6a0630e`: closed
  request/nodes/deps/exclusions/openQuestions to the Collab+Login shape (both validate), scope.define names the fields correctly;
  project-overview (Modules) and public-website still have a self-made shape, not blocked by the gate. Merged lane P5 `5da28577c`
  (stale-input: the rule's input digest is recorded in contracts.context_json, no DDL; old rows are never stale). Check green,
  82/82 specs; status live on the nivo ledger works, staleInput is empty.

- 09:05 Modules architecture.decide: 3 slices done, 3 blocked because SRS decisions are still open (accounting intake/budget/tax-estimation,
  5 chatbot decisions, instance-management shell-api-authentication); the kernel is handling it, may become an ask in the next round
  (tax-estimation may have a legal dimension, will be deferred to the owner). WSPV audit a25 blocked because the tablet image has the wrong viewport (op-defect).
  Collab interface.draw a1 done. Devin kernel context 62-69%, watching. No patch.

- 09:20 Two contract gaps. (1) The Modules provision.ask asked via an Orca orchestration message, waited 10 minutes and then blocked:
  the contract only says "wait". Patched `0171b19af`: the op submits a report with outcome ask (serve-ask serves it), does not wait within the turn; told the
  Modules kernel to re-run the shell-api-authentication ask. (2) Collab work.author ran before backend.implement but demands
  source/tests that already exist (a1, a3 blocked); assigned a background lane to add planned mode, told the Collab kernel not to loop retries.
  The Modules kernel compacted itself (context 24%).

- 09:30 The planned mode lane finished `57273647a`: work.author on a greenfield feature takes its owner from the design (a todo record), check
  uses a real runner + the test path that the implement op must create, role accounts are an identity resource with blockers
  (no schema change). The validator already matches work-layout, no fix needed. Check green, specs 126/126. Told the Collab kernel.

- 09:45 Modules asked the owner through the new channel (4 asks). Bug: serve-ask supersedes by op id, so the Accounting ask also deleted
  the open Chatbot and Shell asks. Patched `76aaa2164` (supersede only when the same params.subject/question.refs) and `52e9f12d6` (poll shows
  served asks again). The kernel re-served those two asks. Answered under delegation: Accounting 4 proposed options; Chatbot 4 proposed,
  with the operating limit alone choosing a per-installation configuration (no invented numbers); Shell: HttpOnly cookie + Bearer for Core. Left for the owner:
  the Accounting tax estimate (a12) and the WSPV checkout ask A/B/C (VNPAY/SePay; audit a28 pointed out that the supervisor's earlier answer A
  touched the excluded payment-provider group). Merged lane P6 `505fc60d2` (conditional brand.decide for spec-foundation).

- 07:45 (real time) Fixing the time labels: the lines stamped 08:00 through 09:45 above actually ran between 07:05 and 07:30 +07; the supervisor
  wrote the wrong times. This round: Collab work.author a5/a6 blocked because owned_paths only has features/collab/uat, planned mode has no environment/fixture
  slot yet, and a5 again asked via the Orca ask thread. Patched `a9d886062`: _common.yaml one channel to ask the owner for every op; work.author
  gains an environment/fixture slot, the kernel grants the slot directory. Modules waits for "three asks" although two were answered: the wake at submission met an active kernel
  and was dropped, and status awaitingOwner only shows the latest attempt of an op. Patched `9945ae813` (by subject/cut). Woke Modules,
  told Collab the slot directory.

- 07:45 Progress, no patch. Collab work.author a7 done (UAT slice after the slot patch), 7 jobs ready dispatching. Modules received
  the three answers, architecture.decide a7 done, kernel active. WSPV implement repair-round5 is re-capturing images; the payment ask waits for
  the owner. AUTH waits on owner-gate. Modules status shows all 3 provision.ask answered (patch 9945ae813 works correctly on the real ledger).

- 07:55 Collab holds 7 backend.implement jobs behind a composition job "in the kernel's head"; status reports ready so the watchdog wakes
  it every 5 minutes for nothing. Patched `d5218813a`: enqueue --after records the ordering in the ledger, status treats a job with --after or an unfinished cut seam
  as a dependency; kernel-prompt instructs to use it. The 7 current jobs were enqueued before the patch so they are still woken until composition finishes. WSPV
  implement a34 done. The fork reports a gap: settle passes when owned paths are not committed/pushed even though commitPolicy demands main-line; assigned the fork to do P7.

- 08:05 Modules architecture.decide a8 blocked: the revise contract demands extensions.work3.decisionLog but the 16 flat schemas close
  work3 to only integrations; plus the contradiction "edit the deployment record" versus "do not edit legacy records". Assigned a background lane; told the kernel
  Modules to hold the slice. Fixed the fork's P7 scope: nivo ops declare push:false (nivo-backend is 198 commits ahead of origin), so
  the landed-check only demands clean owned paths and a commit present in local HEAD; origin only when push:true.

- 08:20 The lane finished `09c3af799`: decisionLog (closed, rev/at/gap/chosen/why/alternatives?) added to extensions.work3 of the 16
  flat schemas; found that 15/16 schemas never wired extensions into properties (even the integrations that business.decide is writing were
  rejected). Legacy rule: parts that live only in the old work/node are edited in the corresponding flat record (rev 1 = copy over, rev 2 = edit,
  change.reason names the legacy version being replaced). Check green, specs 104/104. Told the Modules kernel to re-run a8.

- 08:15 No patch. WSPV audit a29/a31 failed for real bugs (loading shrinks/jumps in size; 21 states lacking the payment
  cycle and renewal strip), a30 blocked because the matrix route (/purchases/:id vs /provisioning) contradicts itself in the records: op-defect,
  the kernel handles it via the implement repair round. Modules is re-running a8 (leased). Collab waits on composition. AUTH waits on owner-gate.

- 08:25 P7 green but not merged: 23/25 of nivo's recent implement reports lack head, so a passing settle would be rejected en masse.
  Asked the fork: the envelope demands head for ops with commitPolicy (error at report time, while the worker is alive and can fix it) + a transition rule at settle
  (an old report lacking head: skip the ancestor check, still demand clean owned paths). Scaffold/content/workspace commit "when allowed" without
  a commitPolicy: put on the morning list (push authority decision).

- 08:25 No patch. Modules architecture.decide a9 (Shell, re-run after 09c3af799) done: the decisionLog patch works on real work.
  The WSPV kernel is fixing per the audit. Collab composition still active (the worker still has output). AUTH waits on owner-gate. P7 waits on the fork to add to it.

- 08:35 Modules only has S1 Accounting waiting on the owner's tax ask, but status reports orphaned-frontier (ask a12 lost lineage because of a13
  afterwards) so the watchdog wakes every 5 minutes. Patched `0213b58fb`: an unanswered ask is always in awaitingOwner; an open op no longer + a
  waiting ask = frontier awaiting-owner, not actionable. Live: Modules awaiting-owner, lists ctx_596b59ca7bd4.

- 08:50 The Collab composition worker hung for 60 minutes on `... | xargs grep` reading stdin; the spinner made it look active. Patched `45841bcc5`:
  liveness wedged (turn > 30 minutes, shell command still No output yet), frontier worker-wedged + wedgedJobs; live is correct. The Collab kernel
  re-dispatched composition. Merged P7 `71853d655` (an op commit report must have head; a passing settle demands clean owned paths; old reports lacking
  head only check owned paths). Check green, 86/86. Told the WSPV and Collab kernels, reminding the two running workers to write head.

- 09:05 WSPV stuck: the supervisor's head message arrived mid-turn, Devin queued it and the idle prompt waits for Enter; the kernel had consumed the report
  implement a35 (with head) but had not settled, the frontier says engaged so nobody wakes it. The supervisor pressed Enter, the kernel ran again. Patched
  `febe53d87`: frontier settle-ready (report consumed, job still running) actionable + settleReadyJobs; liveness queued-input
  (only when idle), the watchdog and the wake of api/serve-ask press Enter. Live: WSPV settle-ready correctly a35. Collab backend.implement a1
  partial (composition), the kernel is handling it.

- 09:15 WSPV settled a35 and moved on (Enter cleared the jam). Collab composition done (a9), the kernel runs 7 backend.implement slices
  following the dependsOn of the impl record (almost a chain), but status reports ready so the watchdog wakes it for nothing. Patched `3b2767b26`:
  status reads dependsOn of the Work record in owned_paths; when the owner has succeeded it is released. Live: 6 slices dependency, not
  actionable.

- 09:20 The fork reports 3 bugs. (1) the supervisor's: workspace.manage prepare still writes the root scope record .starciwork/<scope>/index.yaml which the
  layout forbids, so a new project (Mia Mia) cannot start spec-foundation; assigned a background lane (valid target, closed schema, the spec mandates writing the
  root). (2) the cut's retry lineage is wrong and (3) the kernel reports active for 3.7 hours because of an old spinner line: the fork does lane P8. Nivo is not affected by (3).

- 09:40 The lane finished `3edefde1b`: workspace.manage prepare/import/stacks write setup to the root catalog .starciwork/index.yaml at
  extensions.work3.setup.<workflow>.<mode> (closed schema, reusing the fields of scope); evidence at .starciwork/evidence/<wf>.<mode>/;
  the spec rejects any manifest writing a root record outside the layout. Check green, 46/46 (lane: 155 pass). Sent the fork the steps for the Mia
  Mia kernel. Still open: the node fields of scope.finish still list state/blocker/completion.

- 09:40 No patch. WSPV audit a32 done, a33 failed, the kernel is handling it (transition-ready). Collab 6 slices dependency per
  dependsOn, watchdog idle-waiting (patch 3b2767b26 works correctly). Modules awaiting-owner (tax). AUTH owner-gate. Delegation ends 10:00;
  the two remaining open asks (WSPV payment, Modules tax) both belong to the group left for the owner to decide.

- 09:50 A WSPV yield under the heading " Running (codex):" was read as a spinner, 2 audit reports waited 20 minutes. Patched `36be1bf2c` (a line with a
  status word ending in ":" is prose); woke WSPV. Found: the WSPV kernel edited owned_paths in the job payload (wrote straight into the
  ledger, self-declared in inc-f3f8d80df3dc) because P7's landed-check looks for frontend paths in nivo-backend; assigned the fork P7b (resolve
  by target repo). The kernel also committed 94MB of evidence into nivo-backend with ALLOW_SECRET_SCAN=1: put on the morning list.

- 09:55 No patch. WSPV handled a32/a33 after being woken (patch 36be1bf2c correct), one audit worker is running. Collab 6 slices
  dependency, membership running. Modules awaiting-owner (tax). AUTH owner-gate. Delegation ends 10:00: from here the supervisor no longer answers asks
  in the owner's place. Waiting on the fork: P7b (landed-check by target repo) and P8 (cut retry lineage, old spinner).

- 10:03 Delegation has ended, no asks answered. Collab membership done (a10 done after a2 partial), 5 slices dependency remain. WSPV one
  audit worker running. Modules awaiting-owner. AUTH owner-gate. No patch.

- 10:13 Quiet, no patch. WSPV audit worker active (has output), Collab slice conversation running, 5 dependency. Modules and
  AUTH wait for the owner.

- 10:23 Quiet. The WSPV worker interface.implement (ab51c9eaa9) has been thinking for 35 minutes but the command has finished and text is coming out: not hung.
  The next Collab slice runs. Modules, AUTH wait for the owner. No patch.

- 10:33 Quiet. Collab backend.implement a3 (conversation) done, 4 slices dependency remain. The WSPV implement worker is still active.
  Modules, AUTH wait for the owner. No patch.

- 10:45 The Collab kernel was reported active although it had yielded: the interrupt line begins with lowercase "running." which matched a case-insensitive
  regex. Patched `ddda061f1`: status words are case-sensitive. Live: all 4 kernels correctly turn-idle. Collab 3/8
  backend.implement slices pass, routing running.

- 10:58 Root cause found: the watchdog is a long-lived process that loads terminal-liveness once at startup (03:37-05:18), so every
  classifier patch overnight never reached the watchdog (Collab was reported active). Patched `9270d970e`: the loop runs every beat as a fresh child
  process with --once. Stopped and restarted the 4 nivo watchdogs (log appended), all 4 correctly report idle-waiting. Told the fork to restart the 4 watchdogs
  of starci-next and mia-mia.

- 11:03 Quiet. The 4 new watchdogs run correctly (idle-waiting, no errors). Collab backend.implement a4 (routing) done, 4/8 pass, tasks
  running, 3 dependency remain. The WSPV implement worker is active. Modules, AUTH wait for the owner. No patch.

- 11:13 Quiet. WSPV interface.implement a37 done, kernel active and settling (settle-ready correct). Collab tasks running (4/8
  pass). Modules, AUTH wait for the owner. No patch.

- 11:25 The Modules tax ask form expired its 4-hour ttl (dead) while the kernel is awaiting-owner: the owner would click a dead link and nobody
  re-serves it. Patched `b2c0ce8ab`: a waiting ask with no live form = askReserveDispatches, frontier ask-reserve actionable. Told the
  Modules kernel to re-serve ctx_596b59ca7bd4. The WSPV payment form is still alive (served ~07:26, expires ~11:26); the patch will catch it when it expires.

- 11:35 ask-reserve works correctly: Modules re-served the tax ask (http://127.0.0.1:6970/a-2e190e5a4ba7e57e62, new 4-hour ttl),
  back to awaiting-owner. The WSPV payment form expired exactly as predicted, the frontier lists ctx_b77ce6a3b9a7, and the watchdog woke
  the WSPV kernel. WSPV audit a34 failed (kernel handles it). Noise: the Modules watchdog saw a momentary kernel-failed-screen once, the screen displayed
  did not match the failure pattern, no restart.

- 11:45 The WSPV kernel was woken twice because the payment form expired yet it still handed out a dead link: the text-form status prints neither reason nor
  askReserveDispatches. Patched `e4faf58ff`: text prints the reason and an ask-reserve line with the serve-ask command; driver-loop says a dead link is work, not
  waiting on the owner. Told WSPV to re-serve. Collab tasks done (a5), approval and notification running in parallel, gateway remains.

- 11:53 WSPV re-served the payment ask: http://127.0.0.1:6969/a-a5b6a272f6c5354503 (patch e4faf58ff took effect). Two asks live,
  no reserve left. Collab approval and notification run in parallel, gateway remains. No patch.

- 12:03 Quiet. WSPV interface.implement a38 done and settled (rail height), 1 job ready and the kernel is dispatching. Collab approval
  and notification running, gateway remains. Modules, AUTH wait for the owner; two asks live. No patch.

- 12:13 Collab approval (a6) done, 6/8 pass; gateway ready (dependsOn does not include notification), the watchdog woke the kernel to
  dispatch in parallel with notification: record-deps (3b2767b26) shows the parallelism is right. WSPV audit re-run is running. No patch.

- 12:23 Collab notification (a7) done, 7/8 pass, gateway running. WSPV audit a35 failed but converging: F10, F12, F11 closed
  through a33-a35, only F3 remains ("Provisioning order" shows the purchase code instead of the separate provisioning order code, perhaps the backend does not have this code yet).
  The kernel handles it. No patch.

- 12:33 Quiet. Collab gateway running (7/8). The WSPV worker fixing F3 is running. Modules, AUTH wait for the owner; two asks live. No patch.

- 12:43 Quiet. Collab gateway and the WSPV F3 worker are still active with output. Modules, AUTH wait for the owner. No patch.

- 12:53 Quiet. Collab gateway and the WSPV F3 worker have run about 40 minutes, still have output, not wedged. Modules, AUTH wait for the owner. No patch.

- 12:55 Fork: handed step 3edefde1b to the Mia Mia kernel; the owner chose offset-pop first for Mia Mia base-repos; the 4 watchdogs
  of starci-next and mia-mia restarted on main (re-exec every beat). P8 green but merging main (keeping last night's liveness
  behaviors), adds starci kernel reconcile --retry-lineage for queued jobs not yet dispatched. P7b in progress (landed-check by target repo).

- 13:30 The owner woke up, saw the nivo sidebar in chaos (ops lost their names, workers sitting outside, 58 agents) and chose "delete everything and restart", kernel
  default Opus 5.5. Done: snapshot of the 4 goals; stopped 4 watchdogs; settled 12 open jobs as blocked; starci kernel finish for 4 workflows; closed every
  nivo terminal; closed 160 Orca tasks (run-use a temporary terminal into each old run, task-update completed); releasing 341 workers
  (abandon + release) in progress. Root causes found and patched: settle/finish closed the Task with "done" while Orca only accepts completed so it
  never closed (`8f2623030`); the CLI overwrites the terminal name, the watchdog resets [Kernel]/[Op] (`705cda9ef`); the supervisor adds formal
  checks TITLE_DRIFT, STRAY_TERMINAL and a form step every round (`36ee7fe11`). config.yaml kernel = claude/opus-5-5.
  Merged P8 `fab36d654`, P7b `d1cb38455`, R `12a1ddb74`.

- 13:55 Full tests after merge: 1208 pass, 0 fail, 4 skip. Re-created 4 workflows (chain as approved, AUTH/WSPV skip brand because
  brand is done): wf-nivo-app-auth-mudqjob3, wf-nivo-workspace-provision-mudqjokb, wf-nivo-modules-agentos-mudqjov6,
  wf-nivo-collab-group-chat-mudqjp5g. The Claude Opus 5.5 kernel could not start (Orca timed out waiting for the handle) because Claude Code
  has not onboarded (~/.claude.json lacks hasCompletedOnboarding); the owner needs to run claude once. 242 Orca worker records kept
  (identity_unproven) cannot be released via the CLI; only an orchestration reset (global) can delete them.

- 13:44 Waiting for the owner to onboard Claude Code (hasCompletedOnboarding is still missing). 4 new workflows queued, no kernel, no watchdog yet.
  Two old workers submitted reports late (Collab backend.implement a8 done 05:59, WSPV interface.implement a39 done 06:01) into workflows that had finished:
  their code is committed in the repo, the new workflows will survey it again.

- 14:00 The fork reports lane R is broken: terminal create times out waiting for the handle but the terminal is still created and left behind (R2 is fixing: adopt-or-close,
  stuck paste). Nivo is hit identically: 3 orphan claude terminals sitting at the onboarding screen; closed. Holding nivo until R2 is done and the owner onboards.
  TITLE_DRIFT: the name is continuously overwritten by the CLI (OSC every turn), renaming every 5 minutes does not win; proposed CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1
  in the claude card, Codex/Devin rename after attest and at every wake. Lane S (fork) fixes the repository resource record for Mia Mia.

- 13:53 Still waiting: the owner has not onboarded Claude Code, R2 has not returned. 4 nivo workflows queued, no nivo terminals. No patch.

- 14:05 The owner adjusted: the supervisor is a poll in chat, debug mode, with no body in Orca. The supervisor was wrong to create the terminals
  [Supervisor] cleanup/probe; closed them, wrote the rule chat-only-debug-mode into supervise.yaml (`0c9f04b3c`); the fork followed. Reset --tasks
  on the owner's command: Orca back to 0 tasks, 0 workers. Merged lane S `6b9d6d565` (repository in workspace.yaml, not in _resources); the Mia
  Mia kernel re-runs prepare. Still waiting: the owner completing the theme selection step of Claude Code, and lane R2.

- 14:15 The owner completed Claude Code onboarding (hasCompletedOnboarding=true). Starting the Collab kernel still fails at create: Orca timed out
  waiting for the handle, this time without leaving a terminal. Lane R did not change the terminal-creation part, so the fault is on the Orca side with interactive agent TUIs
  (cmd and claude --version can be created; claude --model ... cannot), the same symptom as the Codex incident at 21:45 last night. Sent the facts
  to R2 (fork). 4 nivo workflows wait on R2.

- 14:03 Still waiting on R2 (branch has no new commit). 4 nivo workflows queued, no kernel. No patch.

- 14:13 Still waiting on R2. 4 nivo workflows queued. No patch.

- 14:45 The owner restarted Orca, sweeping up 8 workflows (nivo 4, miamia 2, starci-next 2). Merged R2 `f24853dd4` (Orca pushes the claude/codex command through the
  UI path waiting 10s; adds a launch prefix). Patched Claude startup: readiness looks for ❯ on every line `25f74a785`; attestation by the
  display name "Opus 5.5" `5d110d360`; Claude's ✶ spinner is active `58fc42a60`. 4 nivo kernels up on Opus 5.5 + 4 watchdogs. Took over the
  4 workflows from the fork (the supervisor's watchdog, the fork turned off theirs); closed 6 stray terminals. Patched: workspace.manage cutSetAuthority
  `c3ae4687a` (Mia Mia prepare stuck at CATALOG_DIRTY); owner-gate with no job = awaiting-owner `680d1c0b0`; scaffold cutSetAuthority.
  Waiting on the owner: brand + grammar for StarCi Next FE (inc-d456b748085a); the Mia Mia brand follows mm-work.

- 14:40 Quiet, 8 workflows: the first 4 nivo workers are running; sn-work and mm-work workers re-run after the patch; sn-base waits on the owner (brand,
  grammar); mm-base holds 2 frontend jobs behind an owner-gate waiting for brand. No patch.

- 14:45 Progress: nivo AUTH, WSPV, Modules finished scope.define, the kernels are dispatching the next step; sn-work workspace.manage done (the R2 patch
  took effect), waiting on settle; mm-work prepare passed slice 1 (cutSetAuthority took effect). Closed again the stray background terminal term_6e3ea4dd (orphaned).

- 14:50 The owner decided: StarCi Next FE uses the grammar core, the default brand like the dashboard and subscriptions of StarCi Academy. Relayed
  verbatim to the sn-base kernel with the reference sources starci-academy-fe (dashboard, subscriptions, globals.css, theme-context) to record the
  brand record, resolve inc-d456b748085a and continue interface.scaffold.

### Why jobs fail (dug 2026-09-23 04:20, 79 failed jobs of AUTH + WSPV since 21/9)

| Group | Count | Nature | Patch direction |
|---|---|---|---|
| Audit/e2e/integration real failures | ~20 | the quality loop catching product bugs | keep |
| Died without report | 27 | infrastructure: dispatch reject, worker died, tonight's `--parent` bug | patched `--parent`, rejectDispatch closes the terminal (L) |
| Asks counted as failed | ~16 | outcome `ask` settles as blocked, burns an attempt, inflates the failure rate | an ask is a waiting state: settle `awaiting-owner`, costs no attempt |
| Dispatch when conditions are not met | ~7 | SRS/SDS todo, audit record missing, draw lineage missing | `starci kernel dispatch` checks `route.prerequisites` before spawn |
| `provision.ask` does not say what it asks | 5 | the kernel calls the ask op without giving the question → `QUESTION_UNCLEAR` | enqueue `provision.ask` requires structured question params |
| Wrong tool per provider | 3 | ImageGen/browser assigned to an agent that lacks them | route filters `riskHints host-tool-required` by agent card capability |
| Wrong owned path | 1 | | |

The biggest finding: the owner's delegation does not exist in the runtime, so the AUTH draw op a5 rejected the
supervisor's answer A+A. Patched `dab1859b8`: `config.yaml delegation` (asks, until,
excludes), the packet carries `owner_delegation`, serve-ask records `answeredBy`. The op also warned that Desktop A
risks violating the Grammar anatomy; the supervisor will choose B+B when the new ask comes up so the later audit does not hard-fail.

Open:
- AUTH waits on two gates from the owner: choose the login direction (form `ctx_1db4e4509029` is `dead`, needs the
  kernel to re-serve when the owner wakes) and run assisted OAuth run-04 (Docker is on; needs `npm run
  dev:env`, API :3068, FE :3067, then the skill `run-assisted-uat`).
- ORPHAN_TERMINAL `term_b6fa4c43` (audit a4 failed before lane L) is still open.
- `owner-gate` is not yet a `queuedBecause`: a job waiting on the owner still shows `ready`.
