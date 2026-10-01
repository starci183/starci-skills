# StarCi Operations Center

This is the public, read-only StarCi control-plane UI. It shows how an approved Goal becomes a Workflow, how a long-lived Kernel seat dispatches short-lived Op agents, what those agents reported, which checks ran, what the settler decided, and whether code landed. It also shows decisions owed to the owner or Supervisor and the reconciler's health.

The interface uses React, Vite, HeroUI v3 components, Lucide icons and Vietnamese labels. It is one web app with its API on the same origin. The server reads the host machine database and registered project ledgers through the read-only engine readers. It has no write API, login, answer form, CLI-backed request or live worktree diff.

The visual language and component anatomy are documented in [DESIGN.md](DESIGN.md).

## Local preview

From `.claude/ui`:

```powershell
npm ci
npm run build
$env:STARCI_MACHINE_DB = 'D:/starci-lanes/ui/ui/fixtures/seed/machine.sqlite'
$env:STARCI_ARTIFACT_ROOT = 'D:/starci-tmp/ui-seed-artifacts'
$env:STARCI_STATUS_PORT = '4556'
node server.mjs
```

To prepare the fixture first, run `node ui/fixtures/seed.mjs` from the runtime root. The fixture uses the engine's database writers and stores its content-addressed blobs outside the Git worktree. Set `STARCI_MACHINE_DB` and `STARCI_ARTIFACT_ROOT` to the paths printed by that command. Use a separate preview port; the live harness service is outside this workflow.

Without `STARCI_MACHINE_DB`, `engine/db/machine.mjs` resolves the host's real `machine.sqlite` (normally `%LOCALAPPDATA%/StarCi/machine.sqlite`). Each project `runtime.sqlite` is found through `machine.ledgers`. The UI never creates or repairs either database.

For source development, `npm run dev` starts Vite and the API preview; see `package.json` for the current script and ports. `npm run build` runs lint, TypeScript and Vite build. The public server defaults to `127.0.0.1:4547` unless `STARCI_STATUS_PORT` is set.

## Pages

| Route | Purpose |
| --- | --- |
| `#/` | Overview: attention, workflow progress, project selector and system health |
| `#/w/:project/:workflow` | Workflow: goal, progress, blockers, grouped Work DAG, units and evidence |
| `#/a/:project/:attempt` | Attempt: route, timeline, transcript, report, checks, verdict, diff and land |
| `#/decisions` | Owner, Supervisor and Kernel Decision Items, asks and incidents |
| `#/system` | Engine, SLA, Resources, Services, Cleanup, Land, Supervisor and Learning |
| `#/logs` | Filtered machine and project logs with live follow mode |
| `#/analytics` | Outcomes per op, first-try pass rate per model, durations, throughput and usage |
| `#/_kit` | UI component and state vocabulary preview |

Workflow tabs include Units, Graph, Attempts, Decisions, Why, Timeline, Evidence and Infrastructure. Equal-op units with the same predecessor set may appear as one graph card with ×N; selecting it reveals each real unit and its edges. A graph card never changes the ledger's unit identity or dependency semantics.

The Attempt page keeps the Op's reported outcome distinct from the final verdict. Its transcript is stored redacted scrollback or a live snapshot, not a terminal-screen guess. Diff and media come from indexed blob evidence; a finished job is never reconstructed from the current checkout.

Old hash routes such as `#/agents`, `#/changes`, `#/proofs` and `#/supervisor` open Overview. They expose no legacy data surface.

## API contract

The current endpoint and concept-to-source mapping is [CONTRACT.md](CONTRACT.md). JSON uses `{data, meta}` envelopes, ETag/304 and opaque cursors. `/api/live` sends invalidation events so the client refetches only affected queries; hidden tabs pause their polling. Public API routes support GET and HEAD only. Text is redacted again at read time and credential questions are withheld; host paths, PIDs and command lines are shown (owner ruling 2026-09-29) and open in VS Code/Cursor from the host.

This README describes the source preview. Deployment and live service lifecycle are handled by the host controller, not by the UI.
