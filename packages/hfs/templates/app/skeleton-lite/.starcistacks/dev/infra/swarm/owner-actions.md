# Development prerequisite record

Status: pending owner execution. This record states intended configuration and contains no completed operational receipt.

## DNS

The development operator replaces `dev.{{project}}.example.invalid` with a locally owned development name, updates the manifest, Caddyfile and public configuration together, and resolves the name to the Swarm node. Record the actual resolver mapping and dated verification here.

## TLS

The local development route uses HTTP on ingress port 80 with `auto_https off`. The development operator owns this local-only choice and both external ingress volumes. Record any change to locally issued TLS, certificate custody and verification here before exposing the development stack outside the local network.
