# Evidence — five Codex missions on the 1.7.x–1.9.0 tree, and what they say about 2.0

Read from the Codex rollouts (`~/.codex/sessions/2026/09/04/rollout-*-<thread>.jsonl`) and the
session folders they left under `.worktrees/sessions/`. Numbers are counted from the transcripts,
not from the agents' own reports. Times are local (UTC+7) unless a session record says otherwise.

## The five missions

| # | Codex thread | Mission | StarCi session | Wall clock | Steps (branches) | Agents spawned | `wait_agent` calls (timed out) | Interrupts | Compactions | Outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | `01a06929-7807…` | Outer AgentOS workspace UX, then the 15-minute auto-recovery rule | `20260904-042654-nivo-frontend.direction.decide` | 21:25 → 15:23 (18 h) | 37 (48) | 58 | 371 (273) | 11 | 20 | Outer UI committed `046a659` and merged by S3; recovery backend **not delivered** after 12 `backend.source.apply` steps |
| S2 | `01a0692b-d82f…` | Inner module Setup UX | `20260904-042915-nivo-workspace.bind` | 21:28 → 15:21 (18 h) | 35 (+1 stray `step-100`) | 52 | 133 (89) | 6 | 12 | UI committed `d98e367`, served at 3067 by 11:49 next day; UAT seed still blocked at 15:19 |
| S3 | `01a0695d-e3c4…` | VI/EN i18n across both UI missions | `20260904-052331-nivo-workspace.bind` | 22:22 → 03:05 (5 h) | 15 (18) | 18 | 49 (33) | 0 | 5 | Combined head `691ea17`, all local gates green except one Grammar Tabs test; stopped `external` (Sonar approval, UAT auth) |
| S4 | `01a0697d-486e…` | StarCi courses free / Premium, interview to Home, challenge UX; later "interview standalone from course" | `20260904-055820-starci-workspace.bind` | 22:56 → 15:01 (16 h) | 49 (56) | 37 | 121 (100) | 8 | 11 | Delivered twice: first reading wrong (interview stayed inside course), second delivery after the user restated at 09:54; `.gitmounts` restructured |
| S5 | `01a06bd8-6edc…` (fork of S4) | Code problems free for all | reused S4's folder | 09:55 → 10:37 (42 min) | — | 1 (a review) | 0 | 0 | 1 | Delivered and walked (Free account submits, backend grades Accepted) plus a handoff note |

Root-thread token totals reported by Codex: S1 24 M, S2 81 M, S3 1.4 M, S4 80 M, S5 15 M. Every
fresh operator agent re-reads `INDEX.md`, `SKILL.md`, the operator package, the kind contracts and the
validators: 295 (S1), 310 (S2), 66 (S3), 202 (S4) and 6 (S5) reads of `.claude/*` per root thread.

The shortest mission (S5) never dispatched an operator: it read the tree six times, wrote inside an
existing session folder, and delivered in 42 minutes. The two longest missions spent most of their
wall clock inside `wait_agent` timeouts (S1: 309 minutes of requested waiting; 273 of 371 waits timed
out) and re-dispatching the same operator.

## Where the chain stopped, by kind

### A. Blocks that no operator owned (routed to `user` or `external`, cleared only by someone else)

| Wall | Sessions | First seen → cleared | What the tree did |
| --- | --- | --- | --- |
| Keycloak admin credential rejected (`invalid_grant`, then `401`) | S1, S2, S3 | 21:51 → 10:43 next day (~13 h) | `PROVISIONING_UNAVAILABLE` ×3 in S2, once in S1. The rule forbids retrying and forbids asking a person for a credential, so every UAT and authenticated audit in three missions waited on a task none of them owned. A diagnostic sub-agent printed the admin credential file into tool output at 03:40 (S2), after 1.7.8 said a sealed value is never printed. |
| Sonar upload refused by the host's automatic approval review | S1, S3 | 22:52 → never | `quality.verify` can never be fully green; the environment declaration has no field that says an external upload is allowed for this product. |
| Chrome not available to the audit profile | S1 | 19:09 | `frontend.surface.audit` `EVIDENCE_MISSING`; the mission had already served candidates through the in-app browser for 20 hours. |
| Backend route without `gitPolicy`, thirteen untracked `*.tfplan` on `main` | S1, S2 | 21:31 → 00:01 (asked 22:38, answered `ok lam di`) | `CHECKOUT_DIRTY` then `INVALID_INPUT`; the fix (declare the policy, move the plans intact) was mechanical and was prepared at 22:36, then waited 2.5 h for a person. |
| Route named `starci` while the declaration is `starci-academy` | S4 | 06:00, 06:01 | `ROUTE_UNDECLARED` twice; the agent rebound with the right name four minutes later. |
| Port held by a previous backend on 3001 | S4 | 07:49 | `PORT_CONFLICT`; the agent asked the person and was told `ok` 2.5 h later. |

### B. Blocks the tree's own contracts raised against lawful work

| Rule that fired | Sessions | Cost | Note |
| --- | --- | --- | --- |
| `frontend.presentation.resolve` requires at least one app-owned Owner-map row | S3 (3/1, 3/2), S2 (Tabs repair) | two blocked branches; S2 asked the person for an exception, was told `theo starci đi`, and the repair waited for 1.9.0's `library.source.apply` | A copy-only i18n pass and a behaviour-only library fix have no presentation delta; the contract has no way to say so. |
| `GRAMMAR_REQUIRED` for a missing `danger` button variant | S1 (2/1), S4 (6/1) | S1 lost its whole-flow direction to it; S4 stopped UI work for 40 minutes, then added the variant in 10 minutes after the person said `ok` | The stop routes to `user`; the repair is a one-file library change nobody was allowed to make. |
| UAT seed rows must carry a test marker | S2 | 12:05 → 15:19 and still running | Six Nivo tables have no marker column, so the mission built a migration runner with 17 tests to add one. The person's reaction: `.claude bao seed luon ma?` and `sao dung r`. |
| Exact mutable path ceiling for `backend.source.apply` | S1 | `OWNER_CONFLICT` at 23/1, 25/1, 27/1, 29/1, 32/1; ceiling widened 249 → 346 → 352 paths and still hit; each hit cost a fresh `workspace.bind` (16 in the session), a fresh agent and a full re-read | A recovery feature touches provisioning, OpenClaw config, cluster capacity and the control plane; a list frozen before the code is read cannot name them. |
| `LIFECYCLE_TRANSITION_INVALID` (`pending → pending`) | S4 (4/1, 22/1) | two blocked `business.decide` branches for re-publishing an existing promise | Re-affirming a promise at the same state is the common case, not an illegal transition. |
| `OWNER_CONFLICT` on an e2e provider file outside the ceiling | S4 (8/1) | one blocked branch | Constructor injection changes the e2e module by definition. |
| `PROOF_UNAVAILABLE` because the dependency junction had no Jest and the hook lacked `@starci/eslint-canon-be` | S4 (9/1, 10/1, 26/1) | three blocked branches, ~1 h of environment repair | An environment fact discovered inside a source operator, per step. |

### C. Orchestration walls (the protocol versus the runtime)

- **Polling instead of waking.** The root's only way to wait is `wait_agent` with a timeout; S1
  issued 371 of them and 273 timed out. Between waits the root re-read files and rewrote notes, which
  is where its 20 compactions came from.
- **Prose-only exits.** Six S1 branches (18/1, 22/1, 31/1, 34/1, 35/1, 37/1) and eleven S4 branches
  ended with an agent's final message and no `response.json`; S4's step 17 onward has 27 of 33 branches
  with a request and no response. The root answered with 152 `followup_task` calls in S1. Routing reads
  only `response.json`, so a mission can be busy for hours while the ledger says nothing happened.
- **Agent ceiling.** `maxConcurrentAgents` is 3 and the host adds its own thread limit; `agent thread
  limit reached` fired six times (S2 ×3, S4 ×3). S4 asked the person for permission to finish directly
  and got `ok`; from then on its session folder is a shell around direct work. S2 lost a review spawn
  and a migration inspection to the same limit.
- **No orchestrator memory.** `state.json` records steps and hashes, not what the mission knows. Each
  root invented its own: `orchestration-notes.md`, `handoff.md`, `mission.json`,
  `continuation-coordination.md`, `recovery-business-intent.md`. After a compaction the root reads those
  back, which is why S1 has a note saying "do not retry/restart agent from scratch" twice.
- **Cross-mission coordination by chat.** S2 sent 102 `send_message_to_thread` calls, S1 35, S3 38, to
  agree SHAs, leases and file boundaries. The runtime registry holds leases, but nothing wakes a mission
  when a peer's head lands, so peers polled each other in prose.
- **Loops without a cap firing.** S1 ran twelve `backend.source.apply` steps and five
  `architecture.decide` steps on one feature; `NO_PROGRESS` fired once, at 36/1, 21 hours in. The
  progress-fingerprint rule exists in `SKILL.md`; nothing measured it.

### D. Understanding walls (the loop amplified a misreading instead of surfacing it)

- S1 received a one-line rule at 22:25 (`nếu workspace sập mà db có data thì phải 15 phút restart
  helm 1 lần`). `business.decide`, three `architecture.decide` rounds with critiques, fixture images and
  a `backend.source.apply` dispatch followed, all built on a four-store backup/restore reading. At 01:27
  the person stopped it: `tù từ trò hiểu luồng này không? auto recovery tức là sao?` The actual model
  (Core stores are the source; rebuild and resync) took one exchange to settle. Three hours of typed
  receipts had never restated the rule in the person's words.
- S4 read "đổi phần phỏng vấn ra ngoài home" as a Home entry point to the course interview and
  delivered at 04:47 with 64-state audits pending. At 09:54 the person restated: the interview is
  standalone, decoupled from course and enrollment, and the data layout moves. The second delivery
  landed at 13:25. `business.decide` had published a promise head both times; neither promise was shown
  to the person as a sentence.
- The person's mid-mission messages are almost all about legibility or perceived stopping: `la sao?`,
  `nghia la sao`, `tiếp tục đi sao dừng`, `sao dung r`, `quay lai nhiem vu ban dua`. Each time the root
  had either handed work to a peer task and ended its turn, or reported a typed stop in engineering
  terms.

## The 2.0 session gate, run on the same ledgers

`scripts/validate-session.mjs` run against S1's session folder names, from the ledger alone, the five
branches the transcript count above found abandoned (18/1, 22/1, 31/1, 34/1, 35/1) as `RECEIPT_MISSING`,
and refuses both S1's and S3's `state.json` for carrying transitions without a brief or a budget. The
gate reproduces the finding without reading a transcript, which is what makes it a gate.

## What held up

- The typed stops were, with few exceptions, correct diagnoses: `CHECKOUT_DIRTY`, `RUNTIME_NOT_READY`,
  `NO_VIABLE_DIRECTION` on the Grammar Tabs defect, `PROOF_FAILED` on a seed proof that never ran.
- Validators caught a quality receipt whose evidence was narrated summaries (S1 6/2) and forced raw logs.
- S3 is the reference run: one bind, a short chain, three re-entries, all local gates measured at a
  frozen head, a lawful `external` stop with the evidence folder intact.
- The session ledger made this retrospective possible: every branch has its request, response and
  artifacts on disk.

## What this argued for, and what 2.0 shipped

Each item below names the gate 2.0 put behind it; the lineage line of the root index is the release record.

Ordered by the four questions of `UPDATE.md`: first the gates that were missing, then the rules that
were narrower than the truth, then the concepts with two homes.

1. **Readiness is one operator, run once, before the chain.** Route names (with a suggestion when a
   declaration is a near match), git policy, dirty checkouts, a login that actually succeeds for the
   flow's account, the served head, browser availability, ports, Docker, installed dependencies,
   ancestor `node_modules` isolation, and the external-upload allowance for Sonar. One typed report; every
   wall named at minute five, not one per hour. Category A above is entirely this.
2. **Owner repair is a route, not a person.** `GRAMMAR_REQUIRED`, `NO_VIABLE_DIRECTION` over a library
   defect, and a missing variant route to `library.source.apply` → `dependency.update` in a sibling
   session; the consumer branch waits on a typed dependency with a wake condition. 1.9.0 added the
   operators; `routing.json` still sends these domains to `user`.
3. **Declare the delta class.** A direction that declares `presentationDelta: none` (copy-only,
   behaviour-only, binding-only) passes `frontend.presentation.resolve` with zero rows and enters
   `frontend.source.apply` under a twin-exempt boundary. The contract gains one field; two blocked
   branches in S3 and the S2 exception request disappear.
4. **Ownership by boundary, not by list.** `backend.source.apply` takes owner globs and module aliases;
   a write outside them is a recorded fallback (`OWNER_WIDENED`, listed under Fallbacks taken) audited
   from the diff, not a terminate that re-enters through `workspace.bind`. Five of S1's twelve backend
   steps were this.
5. **Seed attribution instead of a schema column.** A seed is attributable when every row is owned by
   the flow's provisioned identity and the cleanup manifest names it; a marker column is one way, not
   the requirement. Three hours of S2 were spent adding the column.
6. **A receipt skeleton is written before the work.** The orchestrator writes `response.json` with
   `status: running` at dispatch; an agent that exits without replacing it produces `RECEIPT_MISSING`
   with one automatic follow-up, then a terminate. Seventeen prose-only exits across S1 and S4 become
   visible in the ledger.
7. **Wake, do not poll.** Dispatch is synchronous when the operator is a checklist the root can run
   inline (S5 and S4's direct phase were the fastest stretches), and event-driven when a fresh agent is
   warranted (independent critique, disjoint write sets). `wait_agent` timeouts are not a step.
8. **The orchestrator has a brief.** `state.json` carries `brief` (what is proven, what is blocked and
   on whom, what is next, which peer owns which head) with a size cap, rewritten by the root after every
   transition. Compaction reads the brief; `orchestration-notes.md` and its four siblings are retired.
9. **Restate before designing.** Any operator that consumes a person's one-line rule (`business.decide`,
   `architecture.decide` when it opens a new boundary) emits a plain-language restatement in the
   person's language, at most five lines, and the chain pauses for one confirmation before the next
   operator. `interaction.json` treats this as a material choice, not routine confirmation. S1 and S4
   each lost three to five hours to a reading the person would have corrected in one reply.
10. **Reports are milestones.** The root ends a turn only with one of three lines in the person's
    language: delivered (what and where), blocked on you (what to decide), or working (what and when
    the next milestone is). A hand-off to a peer mission is `waiting` with a wake condition, never the
    end of a turn.
11. **Dispatch briefs, not the tree.** Generate a ≤2 KB brief per operator (Job, Inputs, Outputs,
    Stops, the kind contracts it writes) and give a fresh agent the brief plus its request; the root
    runs the validators. Cut the 200–300 tree reads per mission to a handful.
12. **Coordination through the registry.** A product's integration owner, the served head, and every
    session's committed head live in the runtime registry with wake-on-change; peer missions read it
    rather than exchanging 100 chat messages.
13. **Budgets fire.** A mission has a step cap and a same-operator cap; hitting one routes to the person
    with a typed choice (narrow, continue, stop) and a one-paragraph brief. S1 needed this at step 25.
14. **Redact at the tool boundary.** A sealed value reached a transcript despite 1.7.8. Redaction has
    to sit on tool output before it reaches any agent, as a gate, not as a rule the agent remembers.
