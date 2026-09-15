# Tiny stateful application stack

This is a runnable synthetic reference for StarCi application stacks. It is not a Nivo acceptance artifact and does not claim production readiness. The app exposes a persisted counter behind nginx. It demonstrates two separately prepared environments, encrypted-at-rest configuration, a dev runtime file and an immutable Swarm secret, restart/recreate persistence and exact cleanup boundaries.

## Prerequisites

Dev requires Docker Engine or Docker Desktop with Compose v2. Key and secret preparation runs pinned tool containers, so host Node, SOPS and age installations are unnecessary. `prepare.ps1` requires PowerShell 7; `prepare.sh` targets a Linux shell with GNU core utilities. VPS uses Docker Swarm on one Ubuntu manager; it has not been proven on an independent Ubuntu VM and is not a high-availability design.

The images and formats follow the official [SOPS age documentation](https://github.com/getsops/sops#encrypting-using-age), [age project](https://github.com/FiloSottile/age), [Docker Compose secrets guidance](https://docs.docker.com/compose/how-tos/use-secrets/), and [Compose production guidance](https://docs.docker.com/compose/how-tos/production/).

## Prepare and run

Choose a caller-owned age identity path and back it up outside Git. Dev and VPS need separate keys and produce separate ciphertext.

```powershell
./scripts/prepare.ps1 dev -KeyFile "$HOME/.config/starci/application-stacks/tiny-stateful/dev.agekey" -Initialize
docker compose -p tiny-stateful-dev -f .stacks/dev/compose.yaml up -d --build
docker compose -p tiny-stateful-dev -f .stacks/dev/compose.yaml ps
```

```sh
./scripts/swarm-secret.sh create vps "$HOME/.config/starci/application-stacks/tiny-stateful/vps.agekey" --initialize
./scripts/swarm-doctor.sh
docker stack deploy -c .stacks/vps/stack.yaml tiny-stateful
./scripts/swarm-wait.sh tiny-stateful
```

Dev preparation is repeatable. When ciphertext exists, the exact key must exist and decrypt it. Missing or wrong keys fail; the scripts never regenerate or replace them. Dev retains plaintext at its declared ignored materialization path for container recreation. Swarm decrypts into an owned temporary file, creates an immutable versioned Docker secret, and removes that temporary file. Rotation declares a new `runtimeName`; it never overwrites an existing secret.

The token is passed through a read-only file mount with Compose mode `0400`. Docker Compose on bind-file implementations such as Docker Desktop may ignore requested uid/gid/mode while still enforcing a read-only mount; the host file ACL remains the boundary there. Scripts never put its value in argv or stdout, and the app never logs it. Docker and the host administrator can still read mounted secret material; production custody needs host hardening, access control, backup and rotation appropriate to the threat model.

## Verification and cleanup

`verify.ps1 dev` or `verify.sh dev` creates a unique Compose project, chooses an isolated test port, cold-starts the stack, changes the counter, removes/recreates containers without deleting the volume, confirms the counter persisted, then removes only that project and its named volume. It never addresses unrelated containers, networks, volumes or ports.

Normal stop preserves data:

```sh
docker compose -p tiny-stateful-dev -f .stacks/dev/compose.yaml down
```

Explicit destructive cleanup of this sample's data:

```sh
docker compose -p tiny-stateful-dev -f .stacks/dev/compose.yaml down --volumes --remove-orphans
./scripts/cleanup-runtime.sh dev
```

## Production checklist

Before deploying the Swarm file, build and publish `starci/tiny-stateful:1.0.0` as a reviewed immutable release artifact and replace the tag with its digest. Configure TLS and a real hostname; restrict firewall ingress; test backup/restore; monitor health and disk; define update/rollback windows; rotate and escrow age identities; isolate the Docker daemon; set resource limits; and independently test the exact Ubuntu version and architecture. This single-manager sample pins stateful services to that manager and provides no host failover, remote deployment or remote secret custody.
