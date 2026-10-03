# StarCi Operations Center

This is the public, read-only StarCi control-plane UI. It shows how an approved Goal becomes a Workflow, how a long-lived Kernel seat dispatches short-lived Op agents, what those agents reported, which checks ran, what the settler decided, and whether code landed. It also shows decisions owed to the owner or Supervisor and the reconciler's health.

The interface uses React, Vite, local shadcn/ui components backed by Radix, cmdk search, Geist typography, Lucide icons and Vietnamese labels. Neutral chrome and the original operations layout share one light/dark token system. It is one web app with its API on the same origin. The server reads the host machine database and registered project ledgers through the read-only engine readers. It has no write API, login, answer form, CLI-backed request or live worktree diff.

The visual language and component anatomy are documented in [DESIGN.md](DESIGN.md).

## Local preview

From the lane's `ui` directory, install its own dependencies under the host lock described in [source management](../docs/source-process.md). Generate the i18n catalog from that lane's runtime source; `prebuild` runs the generator automatically.

```powershell
npm ci
npm run build
$env:STARCI_MACHINE_DB = '<lanes root>/ui/ui/fixtures/seed/machine.sqlite'
$env:STARCI_ARTIFACT_ROOT = '<tmp>/ui-seed-artifacts'
$env:STARCI_STATUS_PORT = '<separate free preview port>'
node --input-type=module -e 'import { startHarnessServer } from "./server.mjs"; const runtime = startHarnessServer(); for (const signal of ["SIGINT","SIGTERM"]) process.once(signal, () => { void runtime.close(); });'
```

To prepare the fixture first, run `node ui/fixtures/seed.mjs` from the runtime root. The fixture uses the engine's database writers and stores its content-addressed blobs outside the Git worktree. Set `STARCI_MACHINE_DB` and `STARCI_ARTIFACT_ROOT` to the paths printed by that command. Use a separate preview port; the live harness service is outside this workflow.

Without `STARCI_MACHINE_DB`, `engine/db/machine.mjs` resolves the host's real `machine.sqlite` (normally `%LOCALAPPDATA%/StarCi/machine.sqlite`). Each project `runtime.sqlite` is found through `machine.ledgers`. The UI never creates or repairs either database.

The built preview above calls the exported server in its own process; `server.mjs` has no standalone entry. For source development, `npm run dev:harness` runs the canonical `starci harness start` lifecycle with the API in its verb process and Vite as its child. Vite's proxy reads the API port from `ports.mjs`; its development port is declared there as well. `npm run build` runs lint, TypeScript and Vite build. The public server defaults to `127.0.0.1:<port>` with `<port>` from `statusApp.port` of `modules/models/runtimes.yaml`, unless `STARCI_STATUS_PORT` is set.

## Pages

| Route | Purpose |
| --- | --- |
| `#/` | Overview: attention, workflow progress, project selector and system health |
| `#/w/:project/:workflow` | Workflow: goal, progress, blockers, grouped Work DAG, units and evidence |
| `#/a/:project/:attempt` | Attempt: route, timeline, transcript, report, checks, verdict, diff and workflow integration |
| `#/decisions` | Owner, Supervisor and Kernel Decision Items, asks and incidents |
| `#/system` | Engine, SLA, Resources, Services, Cleanup, Runtime integration, Supervisor and Learning |
| `#/logs` | Filtered machine and project logs with live follow mode |
| `#/analytics` | Outcomes per op, first-try pass rate per model, durations, throughput and usage |
| `#/_kit` | UI component and state vocabulary preview |

Workflow has seven visible tabs: Units, Attempts, Decisions, Why, Timeline, Evidence and Infrastructure. Units contains a List/Graph toggle; existing `tab=graph` links open its Graph view. Equal-op units with the same predecessor set may appear as one graph card with ×N; selecting it reveals each real unit and its edges. A graph card never changes the ledger's unit identity or dependency semantics.

The Attempt page keeps the Op's reported outcome distinct from the final verdict. Its transcript is stored redacted scrollback or a live snapshot, not a terminal-screen guess. Diff and media come from indexed blob evidence; a finished job is never reconstructed from the current checkout.

An unknown hash route opens the not-found page.

## API contract

The current endpoint and concept-to-source mapping is [CONTRACT.md](CONTRACT.md). JSON uses `{data, meta}` envelopes, ETag/304 and opaque cursors. `/api/live` sends invalidation events so the client refetches only affected queries; hidden tabs pause their polling. Public API routes support GET and HEAD only. Text is redacted again at read time and credential questions are withheld; host paths, PIDs and command lines are shown (owner ruling 2026-09-29) and open in VS Code/Cursor from the host.

This README describes the source preview. Deployment and live service lifecycle are handled by the host controller, not by the UI.
