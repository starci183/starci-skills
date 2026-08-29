# `platform/tunnel-plan` input

- `context.authority`: exact account, zone, owner, route revision, opaque credential custody, and evidence.
- `context.observedState`: current tunnel, DNS, and ingress-route metadata plus evidence, bounded to the requested resources.
- `input.requestedIngress`: one tunnel id, hostname, origin, HTTP(S) protocol, and proxied-DNS requirement.

This read-only operator accepts no workflow route, orchestration profile, session lifecycle, raw secret, or broad Cloudflare inventory.
