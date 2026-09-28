# Harness data contract

What the status API behind `harness.starci.org` serves, field by field, so the harness UI can be built against data
rather than against guesses. Three files hold it and a spec keeps them in step:

| File | Role |
| --- | --- |
| `ui/src/contract.ts` | The TypeScript types of every response (`CONTRACT_VERSION` names this revision). Import from here. |
| `ui/contract-shapes.mjs` | The same shapes, checkable at runtime (`validateEndpoint(name, body)`). Strict: a field the contract does not document is a finding. |
| `ui/fixtures/*.json` | One real response per endpoint, captured read-only from the live API and redacted (`{endpoint, capturedAt, source, status, contentType, body}`; a stream holds `events[]`). |
| `tests/harness-contract.spec.mjs` | Fails when `contract.ts` and the shapes disagree on any field or optional flag, when a vocabulary drifts from the runtime's, when a fixture does not fit, or when `ui/server.mjs` started on a fixture ledger (never the live port) answers outside the contract. |

Recapture fixtures after a server change: `node ui/contract-capture.mjs --base http://127.0.0.1:4546 [--base2 <newer server> --prefer2 <names>]`
(GET only; `--check` validates the live API without writing). A server started with `STARCI_STATUS_OFFLINE=1
STARCI_STATUS_LOG_SYNC=0 STARCI_STATUS_PORT=<port>` writes nothing (no supervisor CLIs, no log sync);
`STARCI_STATUS_PROJECTS='[{"id","name","repo"}]'` points it at other ledgers.

## Conventions

- Times are epoch **milliseconds** unless a field says ISO (`InboxMessage.at`, `capturedAt`). Durations are `durationMs`. Sizes are **bytes** (`bytes`, `size`, `ramBytes`); `cpuPercent`/`percent` are % of the whole machine; `ageMin` is minutes.
- `null` means known-absent; an optional field (`?`) may be missing from an older server. Unknown keys never appear (the spec refuses them).
- Every string passed the server's secret redaction and is clipped (status text 300 chars, reasons 600). Paths are repo-relative and `/`-separated unless named `repo`.
- Ids: workflow `wf-...`, job `op-<op>-<hash>`, terminal `term_...`, project `nivo | starci-next | mia-mia` (`GET /api/contract` lists them).
- Errors are `{"error": "<Vietnamese text>"}` with 404 (unknown project/workflow/job/file), 400 (bad query), 500, or 502 (a proof verb could not run).

## Endpoints

| Endpoint | Type | Notes |
| --- | --- | --- |
| `GET /api/contract` | `ContractInfo` | Contract version and the runtime's vocabularies (artifact kinds/subkinds, log kinds/actors/levels). Check first. |
| `GET /api/snapshot` | `Snapshot` | Whole board; cached 30 s. Per workflow: kernel signal, verdict counts, running/queued jobs, incidents, legs with colours and units, work graph, frontier, next actions, asks, holds, workers, `grammarProposals`, `drawReviews` (the owner's image review board: rounds, notes, golden per shape, images by evidence id), `logTypedMissing`. Top level `opHealth` (per-op success rate, queue wait, run/settle time, top failure class over the telemetry window, `scripts/supervisor/op-metrics.mjs`) and `stuck[]` (every wait `api status` aged, with severity against the stuck SLA and the owner of the next action). `sources` names every source that failed. Names: a workflow's `name` is its display name (`workflows.display_name`, set by `api rename` / define-goal; else the goal slug) and `id` stays the key; running/queued jobs, verdicts, units and next actions carry `displayName` `<op label> · <what> · <workflow name>`; `opLabels` is the shared op label map (modules/ops/labels.yaml). |
| `GET /api/agents` | `AgentSnapshot` | Live agent terminals joined to the ledger, machine stats; cached 10 s. |
| `GET /api/agents/<terminal>/log` | `AgentLog` | The terminal's current screen (at most 80 lines). Never proof of a verdict. |
| `GET /api/agents/<op job>/changes` | `AgentChanges` | A running op's uncommitted and recent diffs and images in its owned paths. `/images/<id>` serves image bytes. |
| `GET /api/evidence[?project&kind&q&offset]` | `EvidencePage` | Evidence gallery, 48 items per page from `offset`; `/api/evidence/<id>` streams the file (byte ranges). |
| `GET /api/history?project` | `History` | Recent code commits (BE/FE). `/api/history/<project>/<BE\|FE>/<sha>` → `CommitPatch`. |
| `GET /api/proofs?project&workflow&op[&jobs=a,b]` | `OpProofs` | One op's recent jobs (max 16): report, heads, files (max 160) each served at `url` with byte ranges. |
| `GET /api/artifacts?project&workflow[&job][&kind][&subkind]` | `Artifacts` | Every indexed job artifact with `kind` and `subkind`, grouped by job, `byKind` / `bySubkind` counts. |
| `GET /api/artifacts/file?project&job&sha256` | bytes | Streams a file indexed for that job, with byte ranges for video. The SHA is the indexed file's identifier; the server resolves its stored path and checks it remains inside the project repo. 404 when absent. |
| `GET /api/workflow-events?project&workflow[&after]` | `WorkflowEvents` | Whitelisted ledger transitions (newest 80, or after a seq). `/stream`: SSE, one `WorkflowEvent` per message, `id` = seq, heartbeat every 5 s, resume with `Last-Event-ID`. |
| `GET /api/logs?project&workflow[&job=a,b][&kinds=][&after][&limit]` | `LogPage` | Typed log rows (below). `/stream`: SSE of `LogRow`, `id` = seq, polled every 3 s. |
| `GET /api/supervisor/logs[?kinds=][&levels=][&ref=][&after][&limit]` | `SupervisorLogPage` | The Supervisor's machine log: every observation, decision, action, message and experiment as a `LogRow` of the supervisor ledger (`~/.starci/supervisor/.starciwork/runtime.sqlite`, workflow `wf-supervisor`, actor `runtime`; `scripts/supervisor/sup-log.mjs`). Kinds used: `supervisor.action`, `decision`, `narration`, `cmd.run`, `check.result`, `warning`, `error`, `gc.collect` (one thing the garbage collection closed, removed, archived or refused; `scripts/supervisor/gc.mjs`), `gc.summary` (one per GC run), `reconciler.would` (a call a shadow reconciler controller would have made; `scripts/reconciler/ctx.mjs`), `reconciler.act` (a call an active controller made), `reconciler.error`, `reconciler.event` (any other reconciler row, `data.kind` names it), `invariant.violated` / `invariant.cleared` (the SLA layer, `scripts/reconciler/sla.mjs`). `refs` name the product `workflow:` / `job:` / `repo:` / `commit:` / `item:` / `experiment:` / `signature:` / `proposal:` a row concerns; `ref=` filters by one. Read-only: no supervisor ledger yet is an empty page. `/stream`: SSE of `LogRow`, `id` = seq, polled every 3 s, resume with `Last-Event-ID`. |
| `GET /api/home` | `HomeView` (`ui/src/reconciler.tsx`) | The Tình hình page: per live workflow `progress` (units that passed their gates, never attempts; units/hour, ETA, running vs allowed; `scripts/kernel/progress-rca.mjs workflowView`), `pill` (`ok`, `slow`, `stuck`, `done`), `topReason` when slow or stuck, `onIt` (`owner`, `supervisor` or `kernel`, next action, source); `owner` (owner-only items: asks, owner-decider Decision Items, images awaiting review, plan revisions, the handover credential checklist as one line); `health` (RAM, services healthy/managed, open SLA violations, GC leftovers, controller modes, land gate, `ok`). Built once per tick (`STARCI_STATUS_TICK_MS`, default 20 s); `api status` runs in its own background loop. |
| `GET /api/workflow?id[&project]` | `WorkflowPageData` | One workflow: `snapshot` (a `Snapshot` holding just that workflow, for the tracker), `fleet` (progress, pill, onIt, RCA clusters and ranked actions, the Kernel's decision log), `board` (units by job phase `queued`, `running`, `reported`, `settled`, `released`, DESIGN §9.1), `decisions` (its Decision Items, live plus recent), `worktrees` (git worktrees naming the workflow or one of its jobs). 404 for an unknown workflow. |
| `GET /api/system` | `SystemView` | The Hệ thống page: `reconciler` (engine leader/epoch/heartbeat/rev, per controller mode, last pass, would/act/error rows over 24 h and queue depth; services, seats and ledgers from the Host controller's store; open SLA violations; newest GC summary), `decisions` (the Supervisor's queue and recent decisions, the workflows' live DIs), `opHealth`, `stuck`, `land`, `sources`. |
| `GET /api/nav` | `NavView` | `{updatedAt, owner, live, stuck}`: the counts the navigation shows. |
| `GET /api/reconciler/state` | `SystemView['reconciler']` | The engine and its controllers as above (lane rc-fleet-ui). |
| `GET /api/reconciler/decisions[?workflow]` | `{updatedAt, decisions: DecisionView[]}` | Decision Items across the product ledgers and the supervisor ledger (`scripts/reconciler/decisions.mjs listDecisions`), live plus the newest closed; `workflow=` keeps one workflow's. |
| `GET /api/supervisor/state` | `SupervisorState` | The Supervisor's seat (mode, enabled, terminal, recorded agent/model), newest tick (including the recorded RAM guard cap when available), per-workflow frontier state / ready ops / holds, owed actions (class, action, age, SLA breach, lessons), recent acts and notices, channel `main` inbox and replies, self-learning (open hypotheses, experiments, lessons with owner weight, owner proposals with evidence and options), newest owner digest (`scripts/supervisor/state.mjs readSupervisorState`). |
| `GET /api/diff?project&job` | `JobDiff` | The job's patch pre-structured: files, hunks, line numbers, image sides. 404 when the job has no patch. |
| `GET /api/diff/asset?project&job&blob[&path]` | image bytes | One image side of a diff file (`before.blob` / `after.blob`). |
| `GET /api/coverage?project&workflow` | `Coverage` | `api coverage`: FRs, shapes and proof cases with their evidence (proven / stale / missing). Cached 60 s; 502 when the verb cannot run. |
| `GET /api/verify-proofs?project&workflow` | `VerifyProofs` | `api verify-proofs`: every indexed file re-hashed, the events digest chain walked. Cached 60 s. |

Not served (so not in the contract): asset slots owed have no endpoint. Grammar proposals and draw reviews ride on
`Snapshot.projects[].workflows[]`. The cross-workflow dependency view rides on `Snapshot.projects[].dependencies`
(`scripts/kernel/dependency-graph.mjs`): hard waits between live workflows, the Supervisor's findings with the action it
takes (`bridge | transfer | revise | designate`, `clearCut`), and its bridging records (`provisional` under autopilot).

## Artifacts: `kind` and `subkind`

`kind` is the file type, from its name: `diff | patch | image | video | report | log | trace | file`.

`subkind` is what produced it, derived at index time from facts only (the job's op id, the runtime's own path
conventions, and the ui record manifests `index.yaml` / `draws.yaml` / `manifest.yaml` with `generation.tool` or
`provenance.tool`); `null` when no rule proves it — never a guess (`scripts/kernel/artifact-subkind.mjs`).

| subkind | kind | Produced by |
| --- | --- | --- |
| `draw-render` | image, file | interface.draw token render: a manifest says `tool: draw-render`, a draw-loop round (`draw-loop/<shape>/round-<n>/`), a `starci/draw-render@1` record beside the PNG, or a `token-*` directory |
| `asset-gen` | image, file | an image model: a manifest says `tool: image_gen.*` (the image and its prompt file), or an `interface.asset` job's image |
| `app-capture` | image | screenshots of the running app: `features/<f>/(impl\|operations)/…/(E\|evidence\|screens\|captures\|live\|observed\|renders\|calibration\|tools)/`, or such a directory of an implement/audit/scaffold job |
| `e2e-capture` / `uat-capture` | image | screenshots of an `e2e.verify` / `uat.*` job, or under a `features/<f>/e2e|uat/` record |
| `e2e-video` / `uat-video` | video | the same runs' browser video |
| `playwright-trace` | trace | a Playwright `trace.zip` (open with `npx playwright show-trace <file>`) |
| `patch` | patch | the job's `git format-patch` (`<job>.patch`) |
| `patch-json` | file | its pre-structured diff (`<job>.patch.json`, what `/api/diff` serves) |
| `diff` | diff | a `.diff` file an op wrote |
| `report` | report | a report envelope (`report-<id>.json`) or report file |
| `log` | log | text/log output, the typed-log sidecar `log.jsonl` |
| `critique` | file | `critique*.json` — the draw loop's independent critic verdict |
| `metrics` | file | `metrics.json`, `*.score.json` — draw-loop machine metrics |
| `grammar-proposal` | file | `grammar-proposal*.{md,yaml,json}` |
| `asset-request` | file | `asset-request*.{md,yaml,json}` |

`bySubkind` counts a `null` subkind as `unknown`. `label` is the shape a file shows (`XBase#state@viewport`, a
viewport, `draw-loop <shape> round-<n> <viewport>`, or a patch state `landed | unlanded`); `origin` is where a file
copied in from outside `.starciwork` came from (e.g. a Playwright recording folder).

Browser runs: every Playwright test the runtime launches (`scripts/uat/uat-slots.mjs run`, assisted UAT, e2e.verify)
records video, trace and screenshots; without `--record-dir` an op's run lands in its own recording folder, which settle
indexes as that job's proof (`e2e-video`, `playwright-trace`, `e2e-capture`). `draw-render --trace` adds a trace per
viewport (off by default: Work's byte budget).

## Typed logs

Rows live in the `logs` table of the project's ledger (`<repo>/.starciwork/runtime.sqlite`; before 2026-09-27 a
separate `logs.sqlite`). The server's only write is the sync a read runs (derived and sidecar rows, through the
buffered log writer, limited to `logs`/`log_cursors`); every other handle is read-only. `LogPage.synced.deferred`
is `legacy-logs-pending` while the old file is not yet migrated (the sync waits).

A `LogRow` is `{seq, at, workflowId, jobId, actor, nodeId, level, kind, msg, data, refs}`. `msg` is one short
owner-language line; the facts are in `data`, typed per `kind` (`LogData` in contract.ts); `refs` point at repo files,
artifacts or `commit:<sha>`.

- **actor**: `op` (the agent logged it: `api log` or its `log.jsonl` sidecar), `kernel`, `runtime` (derived from ledger
  events), `check` (a recorded check), `land`.
- **level**: `info | warn | error`, defaulted from the data (a failed check is `error`, a non-zero `cmd.run` `warn`).
- **kinds**: `step.start`, `step.end`, `cmd.run`, `file.edit`, `check.result`, `test.result`, `render`, `video`,
  `trace`, `warning`, `decision`, `narration`, `ask`, `error`, and the derived `dispatch`, `report`, `settle`, `land`,
  `incident`, `job.drop`, `log.truncated`.

Every job has a timeline even when its agent logged nothing: the runtime derives `dispatch`, `report`,
`check.result` **and a `cmd.run` per recorded check** (command, exit, duration when recorded, evidence file), `settle`,
`land`, and from the job's artifact index **a `file.edit` per changed file** (`+added -removed`, `status`,
`diffRef` = `<patch>.json#<path>` into `/api/diff`) and **a `render` / `video` / `trace` per indexed image / video /
trace** with its `subkind`. An op job that settles without its own `step.start`, `step.end` and a `cmd.run` per
reported check gets a runtime `warning` row `LOG_TYPED_MISSING` (WARN, never a refusal), listed in
`Snapshot…workflows[].logTypedMissing`.

## Diff

`JobDiff.files[]`: `status A|M|D|R`, `added`/`removed` line counts, `language` for highlighting, `hunks[].lines[]` as
`{t: ' '|'+'|'-', o: old line, n: new line, s: text}`, `truncated` when a cap cut it (`caps`), `binary`/`image`
flags and image sides `before/after.blob` for `/api/diff/asset`. `unlanded` true means the commits never reached the
branch; `landedLater` names the sha it landed as after the patch was cut.
