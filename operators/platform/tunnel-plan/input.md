# `platform/tunnel-plan` input

This closed input plans one value-free Cloudflare HTTP(S) ingress without mutation. It and every resolved value are task-session state purged at each parent-skill terminal.

## JSON architecture

| Section | Owner | Purpose |
| --- | --- | --- |
| Root route | Skill machine | Accept only `platform.tunnel.plan / ready`. |
| `payload.provided` | Previous state | Supply immutable route, hostname, origin, and ownership refs. |
| `payload.loads` | Runtime resolver | Bind those refs plus exact knowledge, source, external resources, and orchestration. |
| `payload.session` | Session runtime | Own ephemeral input, output, scratch, and retention. |

Each provided ref has one exact artifact load. Knowledge is only `platform.operations`; source is exact-file and hash-pinned; Cloudflare bindings name exact resources and opaque credential custody. Validate before loading. Raw secrets, zone-wide discovery, and durable writes are forbidden.
