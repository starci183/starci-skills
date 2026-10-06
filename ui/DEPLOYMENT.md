# Deploying harness.starci.org

## Boundaries

- The interface/API code lives in the source runtime `<Source>/.claude/ui`. The app needs the runtime modules and the StarCi databases on the same machine; it cannot be deployed standalone to Cloudflare Pages.
- `npm run build` produces the static UI; `npm run serve` serves the UI and a read-only API on `127.0.0.1:<port>` where `<port>` is `allocation.supervisorTick.statusApp.port` of `modules/models/runtimes.yaml` (the one home of the port; `STARCI_STATUS_PORT` overrides it). The machine DB defaults to `<runtime root>/.runtime/machine.sqlite`; project ledgers are looked up through the `machine.ledgers` table and opened with the read-only engine reader.
- A dedicated `starci-harness` tunnel (`3c3469d5-8493-4af0-b13f-68f0ae5b9a8c`) connects `harness.starci.org` to loopback. The tunnel credential and `harness.yml` live outside Git at `%USERPROFILE%/.cloudflared/`.
- The origin serves publicly with no password. JSON data and text blobs are sensitivity-filtered before being returned; diffs and images come from indexed evidence blobs. If the machine or tunnel stops, the site is temporarily unavailable on the Internet; DNS still exists.
- Before the route switch, `harness.starci.org` was a CNAME to `starci183.github.io` and served the "StarCi Skills" page. To roll back, restore this CNAME and then stop the two StarCi Harness tasks.

## Host setup

```powershell
cd <Source>/.claude/ui
npm ci
npm run build
npm run serve
```

The tunnel runs with `starci harness start --tunnel` (cloudflared `tunnel --config %USERPROFILE%/.cloudflared/harness.yml run starci-harness`, without the CF token variables); `starci task register harness-tunnel [--apply]` prints or registers its scheduled task. Before use, create the named tunnel and DNS route with the Cloudflare CLI, point `harness.yml` at the same port (`statusApp.port` of `modules/models/runtimes.yaml` — the ingress is checked for `port-drift` against it), and check `cloudflared tunnel --config <file> ingress validate`. On the current machine, Windows Task Scheduler runs the app and the tunnel when the machine owner signs in, restarting automatically when a process fails.

## Verification

1. Without Authorization: `/` returns HTML; `/api/contract`, `/api/workers` and `/api/health` return read-only envelopes.
2. A workflow has its DAG from `/api/workflows/:project/:wf/graph`. An attempt has its transcript, checks, diff and evidence blobs from `/api/attempts/:project/:id` and its subroutes. Do not take diffs from the live working tree.
3. The tunnel has registered edge connections; the DNS of `harness.starci.org` points at the tunnel ID.
4. Over HTTPS: a visitor who is not signed in can view the dashboard; JSON uses ETag/304 and blobs by SHA use immutable caching. A POST to the API returns 405.
5. Restart the two tasks to check recovery. Do not use HTTP Basic over public HTTP; Cloudflare serves the hostname over HTTPS.

## Vendor documentation read

Read on 2026-09-26: [Cloudflare local tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/) describes ingress, the DNS route and the run command; [DNS records for Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/) confirms that the CNAME and a working tunnel are two independent parts; [Windows service guidance](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/as-a-service/windows/) states the long-running lifecycle. There is no callback or webhook for this dashboard.
