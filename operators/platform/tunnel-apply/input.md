# `platform/tunnel-apply` input

This closed input applies one approved Cloudflare tunnel and DNS route. It and all loaded values are task-session state purged at every parent-skill terminal.

## JSON architecture

| Section | Owner | Purpose |
| --- | --- | --- |
| Root route | Skill machine | Accept only `platform.tunnel.apply / ready` with `platform-tunnel-plan-ready`. |
| `payload.provided` | Previous state | Supply immutable `tunnelPlanRef`, `credentialReceiptRef`, and exact `approvalRef`. |
| `payload.loads` | Runtime resolver | Bind exact artifacts, knowledge, source, commands, Cloudflare resources, credential handles, and orchestration. |
| `payload.session` | Session runtime | Own ephemeral input, output, scratch, and retention. |

Every provided ref has exactly one session artifact binding. `approvalRef` binds the exact account, tunnel, hostname, origin, DNS record, plan hash, and allowed effect classes; a broad or stale approval is invalid. Knowledge is only `platform.tunnel`; source access is exact-file and hash-pinned; commands and external resources are declared-only. Credential material arrives only as opaque handles. Validate before resolving loads or mutating Cloudflare.
