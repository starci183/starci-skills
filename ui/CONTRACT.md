# StarCi public status UI contract

The StarCi runtime is a control plane. The owner defines a Goal; one long-lived Kernel seat steers each Workflow; an ephemeral Op agent runs one job and reports; checks and the settler determine the verdict; the reconciler's seven controllers maintain mechanical progress; the Supervisor makes fleet-level decisions. The public UI observes these records and never performs their transitions.

The canonical schema is `starci/runtime@1` for each project ledger and `starci/machine@1` for the host machine. The runtime source is `.claude`; the machine database path is resolved by `engine/machine-db.mjs` (normally `%LOCALAPPDATA%/StarCi/machine.sqlite`). Project ledger paths are resolved only through `machine.ledgers`. The UI opens both through the exported read-only engine readers.

## 0. Concept trace

| Concept | Question answered | UI location | Read API | Source |
| --- | --- | --- | --- | --- |
| C1 Goal | What was approved and which revision? | Workflow goal | `/api/workflows/:p/:wf` | `goals`, `goal_inputs` |
| C2 Workflow | Is it progressing; why; when will it finish? | Overview rows, Workflow header | `/api/fleet`, `/api/workflows*` | `workflows`, `v_workflow_progress`, `lifecycle_changes`, `metrics_snapshots` |
| C3 Seat | Is its Kernel or Supervisor present? | Workflow seat, System Services | `/api/seats` | `v_seats`, `v_deaf_seats`, `seat_turns` |
| C4 Work graph | What is ready and what blocks it? | Workflow graph, units and inspector | `/api/workflows/:p/:wf/graph`, `/units*` | `v_units`, `unit_edges`, `v_blocking` |
| C5 Kernel decision | What did the Kernel decide; did it work? | Workflow Decisions and Why | `/api/decisions/log`, `/rca` | `decisions`, `metrics_snapshots` |
| C6 Dispatch | Who was routed and admitted, and why? | Attempt route step | `/api/attempts/:p/:id` | `op_attempts`, `throttle_decisions` |
| C7 Attempt | What is the Op doing right now? | Attempt timeline and transcript | `/api/attempts*`, `/transcript*` | `v_op_history`, `attempt_transcript_snapshots`, `blobs` |
| C8 Report | What did the Op claim? | Attempt report | `/api/attempts/:p/:id` | `reports`, `report_attachments` |
| C9 Checks | Which checks proved or rejected it? | Attempt checks | `/checks/:id`, `/api/blob/:sha` | `v_checks`, `blobs` |
| C10 Verdict | What did the settler decide? | Attempt verdict and retry | `/api/attempts/:p/:id` | `op_attempts`, `jobs`, `decisions` |
| C11 Land | Has the result integrated? | Attempt land, System Land | `/api/land*`, `/api/lanes`, `/diff` | `product_lands`, `land_queue`, `land_runs`, `pushes` |
| C12 Decision Item | Who must decide; when; has it escalated? | Overview attention, Decisions, Workflow | `/api/decisions*`, `/api/asks`, `/api/incidents` | `v_decision_rows`, `sup_decision_items`, `ask_requests`, `incidents` |
| C13 Reconciler | Which invariant or controller changed state? | Overview health, System Engine/SLA | `/api/health`, `/api/reconciler*`, `/api/sla/*` | `v_engine_health`, `engine_queue`, `v_engine_actions`, `v_sla_open` |
| C14 Resources | Why was work throttled? | System Resources | `/api/resources*`, `/api/terminals` | `throttle_state`, `provider_health`, `quotas`, `host_leases` |
| C15 Cleanup | What is leaking or awaiting GC? | System Cleanup, Workflow Infra | `/api/gc/*`, `/api/leaks`, `/worktrees` | `gc_runs`, `gc_items`, `v_leaks`, `v_ledger_leaks` |
| C16 Learning | Which lesson or ruling changed policy? | System Learning, Attempt related lessons | `/api/supervisor/lessons`, `/rulings`, `/api/metrics/ops` | `sup_learning`, `sup_owner_rulings`, `v_model_scorecard` |
| C17 Observation | What happened in order, with source proof? | Logs, Workflow timeline, Attempt transcript | `/api/logs*`, `/api/timeline`, `/api/live` | `logs`, `machine_logs`, `events`, `v_timeline` |
| Identity | Where is this ID? | Global search | `/api/search` | `v_search_ids`, log FTS |

The Work DAG groups units only when their operation and predecessor set match. A group displays ×N and opens individual units; edges keep their actual kind (`after`, `seam`, `dependsOn`, `peer-wait`). A grouped node is a visual summary, never a replacement for stored unit identity.

## 1. HTTP API and source map

Every JSON success has `{data,meta:{at,etag,sources,stale,next}}`. The public read API has no request-rate limit (owner ruling 2026-09-29). Error responses have `{error:{code,message}}`. List cursors are opaque. All API routes accept GET and HEAD only; other methods return 405. The SPA and API share one server, default port 4547. A single `/api/live` SSE channel invalidates selected queries; `/api/logs/stream` emits filtered log rows. Conditional JSON reads use ETag/304. Static assets do not consume the API rate budget.

| Endpoint | Main source | UI consumer |
| --- | --- | --- |
| `/healthz` | `machine_meta`, `ledgers`, read-only open check | Health probe |
| `/api/contract` | `machine_meta`, `meta`, `ledgers`, `ui_states`, `ui_state_map` | Shell and state vocabulary |
| `/api/search` | machine and ledger `v_search_ids`, log FTS | Global search |
| `/api/blob/:sha` | machine or ledger `blobs`, content-addressed artifact store | Evidence, transcript, images, diff, logs |
| `/api/live` | machine and ledger `v_live_marks` | Shell invalidation |
| `/api/fleet` | `v_workflow_progress`, decisions, seats, SLA, progress snapshots | Overview |
| `/api/projects` | `ledgers`, `repositories`, `workflows` | Overview project selector |
| `/api/workflows` | `v_workflow_progress`, `workflows` | Overview list |
| `/api/workflows/:p/:wf` | `workflows`, `goals`, progress/RCA snapshots, seats, blockers | Workflow header |
| `/api/workflows/:p/:wf/graph` | `v_units`, `unit_edges`, `v_op_history` | Workflow DAG |
| `/api/workflows/:p/:wf/pipeline` | `goals` (opChain legs/edges), `work_units`, `v_op_history`, `work_graph_versions`, `logs`, `events`, `llm_usage` | Workflow pipeline, leg drawer, attempt timeline, Overview mini pipeline |
| `/api/workflows/:p/:wf/units` and `/units/:unit` | `v_units`, `v_op_history`, `unit_edges`, decisions, blockers | Workflow list and inspector |
| `/api/workflows/:p/:wf/rca` | `metrics_snapshots` (RCA) | Workflow Why |
| `/api/workflows/:p/:wf/worktrees` | machine `worktrees` | Workflow Infra |
| `/api/workflows/:p/:wf/coverage` and `/verify` | `metrics_snapshots` (coverage, verify) | Workflow Evidence |
| `/api/attempts` and `/api/attempts/:p/:id` | `v_op_history`, `op_attempts`, jobs, reports, checks, artifacts, decisions, usage; v3.1 adds `files[].dupOf/empty/key/schema`, `manifest` (evidence `manifest.yaml`), `prior` (previous attempt of the unit), `checkPairs` (op vs runtime per check name) | Workflow Attempts and Attempt |
| `/api/attempts/:p/:id/checks/:checkId` | `v_checks`, output blobs | Attempt Checks |
| `/api/attempts/:p/:id/products` | `op_attempts.repo_root`, `reports.report_json` (`head`, `files`, `claims`), read-only `git show/diff/rev-parse` at the commit head (content <= 1 MB, diff <= 512 KB, redacted, paths validated) | Attempt Products (`AttemptProducts`) |
| `/api/attempts/:p/:id/diff` | `job_artifacts` (patch/diff), patch blob | Attempt Diff |
| `/api/attempts/:p/:id/transcript` and `/transcript/snapshots` | `op_attempts.transcript_sha`, `attempt_transcript_snapshots`, `blobs` | Attempt Transcript |
| `/api/media` | `v_media`, `job_artifacts`, `blobs` | Attempt/Workflow Evidence |
| `/api/metrics/ops` | `v_model_scorecard`, `v_op_history` | System Learning |
| `/api/decisions` and `/api/decisions/:id` | `v_decision_rows`, `sup_decision_items`, deliveries/events | Decisions and drawer |
| `/api/decisions/log` | `decisions`, `sup_decisions` | Workflow Kernel decisions |
| `/api/asks`, `/api/incidents` | `ask_requests`, `incidents` | Decisions |
| `/api/health` | engine, service, seat, resource, SLA, leak and land views | Overview health |
| `/api/reconciler`, `/actions`, `/queue` | `v_engine_health`, leader, modes, queue, `v_engine_actions`, schedules | System Engine, Attempt |
| `/api/sla/violations`, `/clocks`, `/catalog` | `invariant_violations`, `v_sla_open`, `sla_episodes`, `modules/reconciler/sla.yaml` | System SLA |
| `/api/services` and `/api/services/:name/probes` | `v_services`, `service_probes`, `service_events` | System Services |
| `/api/seats` and `/api/terminals` | `v_seats`, `v_deaf_seats`, seat snapshots, `terminals` | System Services/Resources |
| `/api/resources` and `/samples` | throttle, provider, pool, quota, lease, budget and `host_samples` | System Resources |
| `/api/host` | Node `os`, `nvidia-smi`, `Get-CimInstance` (cached), machine `host_samples` | Overview host card, System Resources |
| `/api/gc/runs` and `/api/gc/runs/:id` | `gc_runs`, `gc_items` | System Cleanup |
| `/api/leaks` | `v_leaks` and each ledger's `v_ledger_leaks` | System Cleanup |
| `/api/land`, `/api/land/runs`, `/api/lanes` | `land_queue`, `land_runs`, `pushes`, `lanes` | System Land |
| `/api/supervisor`, `/workers`, `/lessons`, `/rulings` | supervisor seat/decisions/jobs/attempts/learning/rulings | System Supervisor/Learning |
| `/api/notifications` | `notifications`, `blobs` | System Supervisor |
| `/api/logs` and `/api/logs/stream` | `machine_logs`, ledger `logs` and their FTS views | Logs, Attempt Log |
| `/api/timeline` | ledger `v_timeline`, machine violations/actions | Workflow/Attempt timeline |

The implementation lives in `ui/api/index.mjs` and `ui/api/routes/*.mjs`. The route table above describes the public read surface, not permission to write to any source.

## 2. Public redaction boundary

Write-time redaction is owned by `scripts/lib/redact.mjs` before text is stored in the blob/log layer. Read-time projection is owned by `ui/api/redact-read.mjs` and `ui/api/routes/blob.mjs`; it reuses the same redaction module for JSON strings and old text blobs lacking a redaction marker. Marked text is checked again for residual secrets (and decoded when stored as UTF-16/BOM): unchanged text keeps its stored-byte ETag, while changed text is served with no-store caching and byte ranges over the safe response. Large text is filtered while streaming. Binary blobs retain bytes, Range and content type. Blob addresses are content SHA references; the attempt API additionally reports each blob's host file location.

Owner ruling 2026-09-29 (option a): responses show host paths (repository roots, worktrees, owned paths, ledger file, blob store and each blob's file location), check command lines and cwd, terminal handles and PIDs, so each record links to its place on the host. Secrets stay filtered: every string still passes the shared redactor, configuration/credential fields (`config_json`, `allow_json`, `form_url`) are omitted and credential-ask text stays suppressed. Text blobs stored as UTF-16 or with a BOM are decoded before redaction and served as UTF-8 (`X-StarCi-Source-Encoding` names the stored encoding). A credential-related ask exposes its state and decision reference, with its question suppressed. API errors contain generic messages. The UI has no auth or mutation controls; its public exposure requires these server-side boundaries even when source records are sensitive.

The seven UI states are `ok`, `running`, `waiting`, `warn`, `bad`, `done` and `unknown`. `ui/api/state.mjs` computes states from the DB vocabulary when a view has not already supplied one. Reasons carry a code and parameters; Vietnamese display text is in `ui/src/i18n/vi.ts`. Raw source text is an explicit disclosure only where supported.

## 3. Removed surface

The old snapshot, home, nav, system, agent, proof, evidence, artifact, history, supervisor-log, workflow-event and CLI-backed APIs have been removed. Historic hash paths route to Overview; they do not restore the old data model. Settled diff comes from an attempt's stored artifact, not a live shared checkout. An Op's report outcome and the Kernel/settler verdict remain separate fields and chips.
