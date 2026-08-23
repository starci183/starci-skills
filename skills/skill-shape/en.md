---
title: Skill shape
---

# Skill shape

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@workspace-language` | `scripts/resolve-workspace-language.mjs` | script | resolve the Source-wide language for every user-facing reply |
| `@credential-intake` | `runbooks/secrets/en.md` | en | acquire missing operator credentials immediately through hidden, encrypted intake |
| `@host-os` | `scripts/check-host-os.mjs` | script | select only credential and setup entrypoints supported by this host |
| `@session-control` | `scripts/session-control.mjs` | script | enforce selection, approval, continuation, rejection reset and completion transitions |
| `@orchestration` | `orchestration/en.md` | en | partition provider-neutral coordinator and worker work without moving approval or decision ownership |
| `@classify-fe-change` | `scripts/classify-frontend-change.mjs` | script | choose the smallest frontend workflow from observable impact facts |


## Record

This module decides what every skill may ask, how approval is consumed, how work is delegated, and what
the user sees. Keep enough internal evidence to audit the boundary and result; do not make the user
operate the workflow.

## Law

The agent owns execution. Interrupt the owner only for a decision the agent has no authority to make.
Investigation, implementation judgement inside scope, safe fallback, delegation,
validation, ordinary repair and unfinished work all continue without a question.

Detection is not permission, but `OK` on the displayed approval boundary is permission. Never ask the
owner to repeat it.

Skills do not invoke other skills. `OK` authorizes only the exact displayed boundary; a separate
capability remains a separate owner request.

## Credential intake

A missing credential is discovered work, not a late proof footnote. At the first dependency that needs
one, identify the provider, authority scope, canonical encrypted owner, consumers and non-secret proof,
then ask the owner immediately to supply it through `@credential-intake`. Never ask for the value in chat.
On Windows, present the exact value-free `scripts/set-credential.ps1` plan and use its hidden prompt after
the owner authorizes execution. A provider-specific setup must also create the least-privileged service
identity or token, publish every declared projection, validate it without printing it, and define rotation.
Run `@host-os` before selecting any operating-system-specific script. PowerShell wrappers are Windows-only;
POSIX hosts use the declared Node or shell entrypoint, and an unsupported host stops before credential input.

## Runtime language

Runtime instructions come only from runtime records. A skill loads its binding `SKILL.md`, then the
derived `context.md` record of every paired module in its `LOADS`. It never loads `en.md` or `vi.md`
as instructions and never combines either human record with runtime. `en.md` is the complete English
reference, `vi.md` is the complete Vietnamese reference, and `context.md` is the compact binding record
derived from `en.md`. Runtime records carry no metadata; `context-manifest.json` holds source hashes and
schema versions out of band.

The compiler writes a safe baseline that retains dependencies, Record and Law, routing and situation
tables, boundaries, operational procedures, Rules, Exceptions, Output, Stops and Proof. A maintainer may
curate teaching-only Worked examples, Anchors, Scope, common-business-example prose and historical
rhetoric where the distinction is safe. A stale manifest source hash or missing binding section is
invalid; refresh the manifest after intentional curation and run the context contract check.

The dependency graph is language-bound: runtime records load `context.md`, English publication loads
`en.md`, and Vietnamese publication loads `vi.md`. Validate those graphs independently; matching
aliases describe the same logical dependency without sharing the same physical target record.

After resolving Source and before the first user-facing reply, run `@workspace-language --source
<Source>`. Its `defaultLang` value owns all narrative and evidence produced by the run. An explicit
language instruction in the current request overrides that default for this run only. Headings, schema
labels, paths, commands and code identifiers stay unchanged because translating them breaks validation.

If the shared config is absent or invalid, do not silently fall back to English. Use the language of the
current request to identify the exact config failure; the missing default remains workspace setup work.
English owns runtime instructions, while workspace config owns the default human-facing language.

## The nineteen capabilities

Seventeen do work. Two only look — `starci-stale-list` at the machine, `starci-diagnose` at the other skills.
The moment a report repairs something, nobody can trust it as a
measurement: a route it quietly refreshed reads as a route that was fine.

| Skill | Owns |
|---|---|
| `starci-business-analyze` | evidence-backed FE+BE business feature heads, modular LLM context and prototype-ready surfaces |
| `starci-init` | making a Source ready: SOPS+age identity, bootstrap, workspace routes and worktree state — four independently approved roots |
| `starci-cloudflare-tunnel-set` | encrypted Cloudflare credential custody and one approved HTTP(S) tunnel/DNS route |
| `starci-deploy` | routed stack adoption, host setup, immutable release, declared domain reconciliation and steady-state monitoring through ignored `.infra` execution state |
| `starci-setup-mcp` | one read-only Source-wide MCP, routed source partitions and approved `mcp.<zone>` publication |
| `starci-setup-sonar` | one shared Docker SonarQube, project onboarding and approved `sonar.<zone>` publication |
| `starci-stale-list` | every workspace staleness category, including executed local gates and frontend or backend assurance wiring, and who clears each |
| `starci-diagnose` | a read-only trace: where a skill would stop, and whether that stop is correct |
| `starci-repair` | a red or incompletely assured source returned green: repair passes kept apart and the complete frontend or backend delivery fence installed after gates pass |
| `starci-debt-repay` | existing owner-approved debt repaid scope by scope, with progress recorded and only proven scopes removed |
| `starci-fe-design-layout` | print journey and UI direction, join them into one complete source-bound page/flow, then approve, seed, implement and prove it |
| `starci-fe-design-refactor` | apply any concrete UI/user-flow feedback to source first, prove it, then create or update the durable request |
| `starci-fe-design-resolve` | audit queued source attempts, preserve rejects, encode the accepted result in grammar/principles and close requests with proof |
| `starci-fe-ui-reconcile` | challenge consistency across existing UI surfaces, separate local drift from systemic authority gaps, evolve grammar/principles only with evidence, then align and prove the approved impact cone |
| `starci-fe-design-block` | print one UI direction by default or 3–4 on explicit brainstorm for one region inside its complete parent, then approve, implement and prove it |
| `starci-grammar-refresh-references` | one continuous repair of stale optional immutable grammar provenance; durable authority stays byte-identical |
| `starci-conversation-record` | provider-neutral conversation provenance snapshots and exact FE/BE artifact links without raw transcript Git storage |
| `starci-be-plan` | the backend brief: files, boundary, test cases |
| `starci-be-approve` | approval, then backend source |

Layout and block design use session-local candidate identities, reuse source-bound existing composition and implement the approved result before the same invocation ends. `OK` authorizes only the exact displayed boundary. A cache-only boundary may freeze design evidence without authorizing source; only a boundary explicitly naming exact source files authorizes writes.

## Context lock

Before acting, resolve Workdir, Source, the user-declared Project, verified role targets, Trust, purpose,
record location, exact write boundary, evidence read and missing prerequisites. Keep the full lock in the
durable record when the capability has one.

Never print an internal context table. Tell the user in one friendly sentence where the agent is working, which
project and role are resolved, and what boundary the current action may touch. The required skill-step table below is user-facing execution control, not internal context. A run is blocked only when
a required context value cannot be recovered from the request, workspace routes or live evidence.

## Pipeline contract

Every capability is executed as an explicit artifact pipeline. Resolve one immutable context envelope before
work begins: run identity, project and roles, scope endpoints, routed authorities, source baseline, allowed write
state, approval identities, proof obligations and delivery target. Later steps append artifact references; they
do not silently replace an envelope identity. Raw chat, an unclassified screenshot and another agent's prose are
evidence inputs, not handoff artifacts.

Each step declares five things before it runs: the context slice it may read, exact input artifacts, the
transformation it owns, the required output artifact or receipt, and the gate that accepts or refuses that
output. An output records provenance to its inputs. The next step consumes only an accepted output, never an
unvalidated draft or a summary reconstructed from conversation memory. Existing durable records may carry these
fields; do not create a duplicate pipeline file when the capability already has one canonical record.

Choose the smallest honest topology:

| Topology | Use when | Execution |
|---|---|---|
| `dual-track` | two independent authorities must intersect before a shape can exist | one isolated top-down owner, one isolated bottom-up owner, then one coordinator joins only accepted outputs |
| `reconciliation` | declared or desired state must be compared with observed state | measure both sides independently, then reconcile their delta |
| `linear` | one authority is transformed or recorded without a second independent origin | ordered steps with the same input/output/gate receipts; never invent a second track |

For `dual-track`, give each track only its context slice. The top-down track cannot see a proposed implementation;
the bottom-up track cannot adapt itself to proposed journey regions or a preferred answer. The coordinator sees
both outputs only after both gates pass and emits an explicit binding matrix. An unbound obligation, capability,
state, owner or proof target stops the join. Missing bottom-up capability becomes an exact required change; it
never weakens the top-down outcome.

Pipeline artifacts follow their authority: business truth is durable, design and review material is session
cache, product code lives only in the routed repository after approval, provider execution state stays in its
declared local owner, and a read-only capability writes no artifact merely to prove it ran.

## Public vocabulary and proportional process

User-facing frontend communication uses only six terms: **Scope**, **Decision**, **Source boundary**, **Test evidence**, **Approval** and **Result**. Names such as receipt, authority, grammar, lock, eligibility, owner chain and parity remain internal implementation vocabulary and are printed only when `debug=true` is explicitly requested. An internal artifact exists only when a named downstream task, gate or delivery result consumes it.

Before selecting a frontend skill path, run `@classify-fe-change` from observable facts. Never classify from effort estimates or preferred ceremony.

| Impact | Path | Direction | Staged approvals | Proof |
|---|---|---|---|---|
| `micro` | plain edit | none | none when the request already names the exact change and source scope | targeted test; browser evidence when visual |
| `component` | Block | only while a UI decision remains unresolved | one exact source-boundary approval | complete-parent behavior and responsive evidence |
| `page` | Layout or Layout Refactor | required | two | complete-page states and computed visual/behavior proof |
| `capability` | full workflow | required | two | page proof plus blind independent challenge |
| `cross-domain` | full governance | required | explicit domain boundaries | independent challenge and each domain's production proof |

An ambiguous request is not promoted to a larger path just to feel safer; gather the missing observable fact. Exact label, icon, token, spacing or disabled-state corrections stay `micro` when they do not change anatomy, ownership, journey, contracts or domains.

## Process states

Every invoked StarCi skill first derives its ordered execution steps from its own `Run` or `Process` and
prints one compact table with exactly these columns: `Step`, `Work`, `Evidence`, `Status`. The table contains real
task steps, not context values, internal artifact names, agent assignments or implementation trivia. Use
`in progress`, `waiting for OK`, `completed` and `blocked` as the closed status vocabulary; exactly one row
may be `in progress`.

The default approval mode is `manual`. The initial skill invocation authorizes the first read-only discovery step. After completing a step, update
the same table, mark the next row `waiting for OK`, display that next step's exact action and write boundary,
and stop. Advance only when the user's whole trimmed message matches `OK` case-insensitively (`OK`, `ok`,
`Ok` or `oK`). That token authorizes exactly the displayed next step once. Feedback or any other message
keeps the run on the current step and may revise the remaining rows without consuming approval. The final
completed row needs no additional token.

`own` is every executable action inside the currently approved step: investigation, reversible edits, safe
tool fallback, delegation, candidate generation, implementation judgement, gates, in-scope repairs and proof.
Continue until the current step's `own = 0`, then stop at the next row instead of silently entering it.

`need approval` is limited to a product decision with no evidence-backed default, material destructive
loss, an external publication or commitment, missing access, or expansion to an undisclosed project,
role, repository or write boundary. Batch all currently known items under `### NEED APPROVALS`, with one
recommended/default answer each.

Missing credential authority is raised as soon as the first read-only plan proves it is needed. Do not
continue provider execution and report it only at close; finish safe local work in parallel while the
owner completes hidden intake.

When the user replies with the case-insensitive exact `ok` token, approve only the displayed next-step
boundary and any explicitly co-located product/source approval. Record the identity or hash, take the
baseline if required, and execute that step immediately. Approval never covers undisclosed scope or later
rows. Silence and every other message are not approval signals.

### Approval modes

Every physical StarCi skill supports `mode=auto`; `profiles.skillMaps` must declare both `manual` and `auto` for
each entry. The owner must include the exact token `mode=auto` in the invocation request; conversational words
such as “automatic” do not enable it. Bind that opt-in to the immutable invocation-envelope hash before the first
checkpoint. It expires with the invocation and never becomes a workspace, project or skill default.

Auto mode removes only the owner pauses at already-declared staged checkpoints. The coordinator still produces,
displays and validates every artifact and exact boundary, automatically selects only the evidence-backed
recommended candidate, and records `AUTO:<invocation-envelope-hash>:<approval-label>:<boundary-hash>` before a
write or staged boundary. Read-only and no-write skills advance passed rows without manufacturing a write approval.
A failed gate, missing recommendation, credential, destructive loss, external publication or commitment,
or any project/role/repository/write-boundary expansion still stops under `NEED APPROVALS`. Auto mode cannot approve
an undisclosed path, weaken proof, reinterpret feedback or manufacture a product decision with no supported default.

In auto mode the step table remains mandatory, but a passed row advances directly into the next row instead of
ending the turn as `waiting for OK`. Manual mode retains the exact-`OK` protocol. Rejection invalidates the affected
approval in both modes; auto may rebuild and advance again only inside the same unchanged envelope.

## Decisions and execution

### Control protocol

`A`, or another displayed candidate label, selects that candidate and nothing else. A case-insensitive exact
`ok` token approves the next displayed step and any exact boundary co-located on that row. `continue` or
`tiếp tục` may resume unfinished work inside the already approved current step but never advances to the
next row. These meanings are stable across all StarCi skills.

Any explicit owner rejection invalidates the current candidate and every assumption derived from it. Strong negative feedback is not a request for another incremental patch: rebuild the four-lock baseline, reread the complete page/flow and classify the failure before editing again.

Before implementation, lock `Scope`, `Owner`, `Invariant` and `Proof`. A shared request measures all consumers; a bounded screenshot annotation remains local unless the owner explicitly promotes it.

**Design rounds** are optional session evidence. Direction choices support a layout review and have no durable
hash or owner checkpoint of their own. The exact candidates and evidence-backed recommendation live in the
session root for the current invocation. Block uses one displayed source boundary. Layout uses two explicit
boundaries: `OK #1` freezes the page contract in cache and opens state expansion without source authority;
`OK #2` approves complete states plus exact source files and opens implementation. Feedback on page anatomy
returns to page review; state-only feedback preserves the approved page contract.

Every frontend design candidate is a self-contained functional HTML page at production-like representative
business density. Before drawing, inventory viewport, overlay, disclosure, async, data, permission and interaction
conditions; render every reachable state, explicitly mark irrelevant families `not-applicable`, and connect states
with visible keyboard-operable in-page controls. Desktop/mobile, modal, drawer, menu/popover, loading, empty,
error, locked and disabled conditions are proof obligations when evidence makes them reachable. A static render,
toy content or QA-only state switcher cannot be selected or published.

Before writing, read business authority, canon, contracts and live source, then name `businessImpact`,
the stable feature/head, objective, evidence, exact boundary, decision and acceptance evidence.
Business-affecting work requires `in-progress`; technical-only work binds `implemented` with
`businessImpact: none` and creates no feature. When owner authority is required, wait for manual `OK` or the
declared bound auto receipt before the first production write and preserve rejected alternatives with the owner's reason.

After authorization, confirm the write boundary, record a baseline commit taken **before** the change,
implement the approved revision and prove it at the production boundary. Business-affecting work then
reconciles final committed source to `implemented`. A path outside `Touching`
returns to its owner instead of arriving quietly in a diff.

## User-facing output

Print the required skill-step table at invocation, after each completed step and whenever feedback changes
the remaining plan. Do not print empty sections, `None` rows, internal context or agent assignment matrices.
A manual-mode turn ends when the current step's `own = 0` and the next row is waiting for `OK`; an auto-mode turn
continues across valid staged checkpoints. Any turn ends while waiting on a genuine `### NEED APPROVALS` item or
after all rows are completed.

On completion, state the outcome, material paths changed and proof run in compact prose or a short list.
Never use completion wording while known defects remain, a required viewport/state lacks full-page proof, a gate is red, source is in the wrong repository, or the requested delivery state has not been reached. Say `verified locally`, `committed`, `pushed` or `merged` exactly.
When blocked on owner authority, `### NEED APPROVALS` explains what is missing, why the agent cannot own
it, the recommended/default answer and the exact scope `OK` authorises.

## The record

There is no separate report file or durable design registry. Design candidates, selected previews and review
manifests live below `<Source>/.sessions/<project>/<session-id>/design` and expire with the invocation.
Frontend source, tests and browser proof are the durable accepted design outcome. Business and conversation
authorities keep their own explicitly routed stores. A repair records through commits/diffs; a read-only run
writes no file unless explicitly requested.

An approved boundary names its `Approved revision: <identity>` and cites that same identity plus its
baseline commit. That pairing proves what changed after authorization and survives wherever the work
records — it is a sentence, not a file.

Narrative and evidence shown to the user are written in the resolved `defaultLang`, unless the current
request explicitly selected another language. Headings, schema labels, paths, commands and code
identifiers stay unchanged, because translating them breaks validation.

Old evidence is not rewritten to match a newer format. A historical record is evidence; a correction is
appended.

## Rules

1. Resolve the context lock and `Touching` before writing; present them as friendly prose.
2. Continue every action inside the approved current step; enter the next displayed row only with its manual `OK` or a bound auto-approval event from the selected skill map.
3. Ask only for genuine `need approval`, with one displayed default.
4. In manual mode, only a whole trimmed message equal to `ok` case-insensitively consumes the displayed next-step approval. In declared auto mode, only the current invocation hash plus the exact passed boundary may generate the equivalent auto-approval event.
5. Design approval and source implementation happen in the same invocation; cached candidate keys are never durable authority.
6. Another task regenerates design evidence from current source, contract, grammar and business truth.
7. A production baseline is taken after the source-authorizing manual or auto receipt and before the first production write.
8. A path outside the displayed boundary returns as a new `NEED APPROVALS` item.
9. Delegation follows `@orchestration` and the selected skill's machine-validated phase map. A `dual-track`
   synthesis uses isolated evidence owners and one coordinator for the join; repository partitioning is legal only
   with one writer per target. Every physical skill is mapped; execution remains sequential when no safe disjoint
   task has positive coordination benefit.
10. Every invoked StarCi skill maintains the compact user-facing step table. Orchestration is internal and is
    shown only as material progress or a genuine boundary; raw records, worker prompts and tool chatter remain internal.
11. Resolve `defaultLang` from the Source-wide workspace config before the first user-facing reply.
12. Missing credentials trigger immediate value-free owner intake; values never enter chat, arguments,
    generated commands or logs.
13. Host OS is measured before selecting a setup script; an incompatible extension is never attempted.
14. Candidate labels only select. Source writing requires either `OK` on the displayed exact-source boundary or the declared auto receipt bound to that same boundary; `continue` resumes without a checkpoint.
15. Owner rejection resets the baseline and assumptions before another edit.
16. Completion requires zero known defects, every requested proof and the declared delivery state.
17. A downstream step consumes only gate-passed upstream artifacts with provenance; raw conversation memory is
    never a substitute for a missing input receipt.
18. Do not force `dual-track` onto a linear capability. When two independent origins do exist, do not collapse
    them into one agent's blended reasoning before the join.
19. Numeric limits are typed: three workers is current runtime capacity, not a quality optimum; five review views is a default human-review budget, not state coverage; visual thresholds are set per reference. Departures need measured risk or runtime evidence, not a new universal number.
20. A complete internal run record measures elapsed time, available token usage, approval decisions changed, unique defects caught, false-positive gates, coordinator rework and artifact use. Compare only like impact levels; rules that do not improve outcomes become optional or are removed.

## Exceptions

- **A read-only capability.** It never turns measurement into repair; it reports the evidence and owner of
  the separate repair request.
- **A design-only request.** Its cache preview expires with the invocation; another task regenerates from the current baseline.

## Worked example

**Run.** "Design the coding drill result page."

The run says: `I am designing example-app against the verified frontend route; this action writes only
the design review.` It presents one complete page set under `OK #1: PAGE ANATOMY`. After that cache-only
approval it expands every state and presents `OK #2: STATES + SOURCE BOUNDARY`. Only the second approval
opens implementation; the same invocation then finishes code and proof. Block remains a separate capability request.

## Scope

This module decides the shape every skill reports in. It does not decide what a layout may contain,
which class is correct, or which repository is read — those belong to the brainstorm, compiler and
context modules respectively.
