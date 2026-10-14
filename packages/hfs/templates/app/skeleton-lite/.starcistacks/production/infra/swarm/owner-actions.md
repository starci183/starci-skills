# Production prerequisite record

Status: pending owner execution. This record states intended configuration and contains no completed operational receipt.

## DNS

The production operator replaces `{{project}}.example.invalid` and `api.{{project}}.example.invalid` with owned public names, updates the manifest, Caddyfile and public configuration together, and publishes address records for the intended Swarm node. Record the provider, zone, actual hosts and dated DNS receipt here.

## TLS

The production operator provisions the external ingress volumes on the declared node and owns Caddy certificate issuance and renewal. After real DNS resolves, record a dated issuance receipt, persistent certificate custody and HTTPS verification for both public hosts here.
