# Skill shape

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@workspace-language` | `scripts/resolve-workspace-language.mjs` | script | resolve the Source-wide language for every user-facing reply |
| `@credential-intake` | `runbooks/secrets/context.md` | context | acquire missing operator credentials immediately through hidden, encrypted intake |
| `@host-os` | `scripts/check-host-os.mjs` | script | select only credential and setup entrypoints supported by this host |
| `@session-control` | `scripts/session-control.mjs` | script | enforce selection, approval, continuation, rejection reset and completion transitions |

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

## The eighteen capabilities

Sixteen do work. Two only look — `starci-stale-list` at the machine, `starci-diagnose` at the other skills.
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
| `starci-fe-design-layout` | challenge, preview, approve and implement one complete source-bound page/page flow in one invocation |
| `starci-fe-design-block` | judge, preview, approve and implement one region inside its current complete page in one invocation |
| `starci-fe-feedback-evolve` | turn proven owner feedback into the smallest durable authority improvement and source correction |
| `starci-grammar-refresh-references` | one continuous repair of stale optional immutable grammar provenance; durable authority stays byte-identical |
| `starci-fe-minor-fix` | one small contract-preserving correction inside one clean existing block, composite or leaf folder, machine-rejected when its scope grows |
| `starci-conversation-record` | provider-neutral conversation provenance snapshots and exact FE/BE artifact links without raw transcript Git storage |
| `starci-be-plan` | the backend brief: files, boundary, test cases |
| `starci-be-approve` | approval, then backend source |

Layout and block design use session-local candidate identities, reuse source-bound existing composition and implement the approved result before the same invocation ends. `OK` authorizes the displayed source boundary only; no skill assumes another capability was requested.

## Context lock

Before acting, resolve Workdir, Source, the user-declared Project, verified role targets, Trust, purpose,
record location, exact write boundary, evidence read and missing prerequisites. Keep the full lock in the
durable record when the capability has one.

Never print a context table. Tell the user in one friendly sentence where the agent is working, which
project and role are resolved, and what boundary the current action may touch. A run is blocked only when
a required context value cannot be recovered from the request, workspace routes or live evidence.

## Process states

`own` is every executable action inside the declared scope: investigation, reversible edits, safe tool
fallback, delegation, candidate generation, implementation judgement, baseline after approval, gates,
in-scope repairs and proof inside the current skill. Continue until `own = 0`.

`need approval` is limited to a product decision with no evidence-backed default, material destructive
loss, an external publication or commitment, missing access, or expansion to an undisclosed project,
role, repository or write boundary. Batch all currently known items under `### NEED APPROVALS`, with one
recommended/default answer each.

Missing credential authority is raised as soon as the first read-only plan proves it is needed. Do not
continue provider execution and report it only at close; finish safe local work in parallel while the
owner completes hidden intake.

When the user replies `OK`, approve every displayed default and exact displayed boundary. Record the
identity or hash, take the baseline if required, and continue immediately. `OK` never covers undisclosed
scope. Silence and every word other than `OK` are not approval signals.

## Decisions and execution

### Control protocol

`A`, or another displayed candidate label, selects that candidate and nothing else. `OK` approves the exact displayed write boundary and resumes execution immediately. `continue` or `tiếp tục` resumes outstanding owned work without recap, re-planning or another checkpoint. These meanings are stable across frontend skills.

Any explicit owner rejection invalidates the current candidate and every assumption derived from it. Strong negative feedback is not a request for another incremental patch: rebuild the four-lock baseline, reread the complete page/flow and classify the failure before editing again.

Before implementation, lock `Scope`, `Owner`, `Invariant` and `Proof`. A shared request measures all consumers; a bounded screenshot annotation remains local unless the owner explicitly promotes it.

**Design rounds** are optional session evidence. Direction choices support a layout review and have no durable
hash or owner checkpoint of their own. The exact candidates and evidence-backed recommendation live in the
project cache for the current invocation. One `OK` selects the recommendation and authorizes its disclosed
source boundary. Feedback opens another cache round; after approval the same invocation implements the result.

Every frontend design candidate is a self-contained functional HTML page at production-like representative
business density. Before drawing, inventory viewport, overlay, disclosure, async, data, permission and interaction
conditions; render every reachable state, explicitly mark irrelevant families `not-applicable`, and connect states
with visible keyboard-operable in-page controls. Desktop/mobile, modal, drawer, menu/popover, loading, empty,
error, locked and disabled conditions are proof obligations when evidence makes them reachable. A static render,
toy content or QA-only state switcher cannot be selected or published.

Before writing, read business authority, canon, contracts and live source, then name `businessImpact`,
the stable feature/head, objective, evidence, exact boundary, decision and acceptance evidence.
Business-affecting work requires `in-progress`; technical-only work binds `implemented` with
`businessImpact: none` and creates no feature. When owner authority is required, wait for `OK` before the
first production write and preserve rejected alternatives with the owner's reason.

After authorization, confirm the write boundary, record a baseline commit taken **before** the change,
implement the approved revision and prove it at the production boundary. Business-affecting work then
reconciles final committed source to `implemented`. A path outside `Touching`
returns to its owner instead of arriving quietly in a diff.

## User-facing output

Do not print status tables, empty sections, `None` rows, internal context or agent assignment matrices.
Before the next meaningful batch, state outstanding work in friendly prose: `Before I continue, I still
owe: ...`, then pay it in the same run. A turn may end only when `own = 0`, or while waiting on a genuine
`### NEED APPROVALS` item.

On completion, state the outcome, material paths changed and proof run in compact prose or a short list.
Never use completion wording while known defects remain, a required viewport/state lacks full-page proof, a gate is red, source is in the wrong repository, or the requested delivery state has not been reached. Say `verified locally`, `committed`, `pushed` or `merged` exactly.
When blocked on owner authority, `### NEED APPROVALS` explains what is missing, why the agent cannot own
it, the recommended/default answer and the exact scope `OK` authorises.

## The record

There is no separate report file or durable design registry. Design candidates, selected previews and review
manifests live below `<Source>/.worktrees/<project>/cache/design/<session-id>` and expire with the invocation.
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
2. Continue every `own` action without asking; a turn cannot end while `own > 0`.
3. Ask only for genuine `need approval`, with one displayed default.
4. Only `OK` consumes displayed approvals and resumes work immediately.
5. Design approval and source implementation happen in the same invocation; cached candidate keys are never durable authority.
6. Another task regenerates design evidence from current source, contract, grammar and business truth.
7. A baseline is taken after `OK` and before the first production write.
8. A path outside the displayed boundary returns as a new `NEED APPROVALS` item.
9. For safely partitionable work, target ten non-overlapping agent assignments; one coordinator owns
   shared-state gates. Fill and backfill every available runtime slot when fewer than ten are concurrent.
10. User-facing output contains no status tables.
11. Resolve `defaultLang` from the Source-wide workspace config before the first user-facing reply.
12. Missing credentials trigger immediate value-free owner intake; values never enter chat, arguments,
    generated commands or logs.
13. Host OS is measured before selecting a setup script; an incompatible extension is never attempted.
14. Candidate labels select; only `OK` authorizes writes; `continue` resumes without a new checkpoint.
15. Owner rejection resets the baseline and assumptions before another edit.
16. Completion requires zero known defects, every requested proof and the declared delivery state.

## Exceptions

- **A read-only capability.** It never turns measurement into repair; it reports the evidence and owner of
  the separate repair request.
- **A design-only request.** Its cache preview expires with the invocation; another task regenerates from the current baseline.
