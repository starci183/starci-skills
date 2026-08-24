# Platform tunnel

| Field | Value |
| --- | --- |
| Knowledge ID | `platform.tunnel` |
| Operators | `tunnel-plan, tunnel-apply` |
| Search tags | `cloudflare, tunnel, dns, hostname, origin, https` |
| Dependencies | `workspace.routing` |

## Record

Reconcile exactly one declared HTTP(S) ingress. Planning is read-only and binds account, zone, tunnel, hostname, origin, owner, current revisions, and opaque credential custody without zone-wide discovery. Apply requires an approval receipt for the exact plan hash and resource identities. The coordinator alone mutates; a matching state is a proved idempotent no-op.

Proof checks both independent halves: the DNS record targets the declared tunnel and the running tunnel maps the declared hostname to the declared origin with valid public HTTPS. A partial mutation reports every before/after revision and routes to bounded recovery or rollback; it is never hidden by a generic blocker.

Primary references: [Cloudflare Tunnel routing](https://developers.cloudflare.com/tunnel/routing/) and [Cloudflare DNS Records API](https://developers.cloudflare.com/api/resources/dns/subresources/records/).
