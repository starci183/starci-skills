# Application stacks on an Ubuntu VPS

This document narrows [application stacks](application-stacks.md) to a provider-neutral Ubuntu deployment using Docker Swarm. A single VPS is a one-manager swarm; additional nodes may improve service capacity or availability, but manager quorum and data placement must then be designed explicitly. Kubernetes remains deferred. Terraform or a cloud API may provision machines or DNS, but neither owns the runtime topology.

## Supported platforms require a verified matrix

The initial candidate matrix is Ubuntu Server 22.04 LTS amd64, 24.04 LTS amd64, and 24.04 LTS arm64. Each remains a candidate until its cold-host suite passes with every application image. Docker and Ubuntu support do not prove application support.

The manifest encodes `platform.ubuntu` and `platform.architectures`; its VPS environment declares `runtime: docker-swarm`. The application's `prepare` and `doctor` runbooks declare and check Docker version bounds, CPU, RAM, disk, inode, filesystem, ports, time, DNS, backup headroom, Swarm state, manager identity, quorum expectations, and placement requirements.

## Provider-neutral preparation

`prepare` inspects the host before application deployment. It verifies `/etc/os-release`, `uname -m`, CPU capabilities, cgroups, virtualization, capacity, clock, DNS, ports, SSH trust, privilege boundaries, Docker Engine, registry access, and current Swarm membership. Creating a new swarm, joining a node, changing manager membership, or changing autolock are explicit effects with separate custody and recovery requirements.

Production preparation uses Docker's signed Ubuntu apt repository rather than the convenience script. SSH host identity is pinned before transfer. First contact requires an owner-verified fingerprint or provisioning receipt bound to the machine. Changed host keys, passwords in argv, disabled host-key checking, and broad root login are refused.

For multiple managers, the runbook preserves quorum and records node identities and roles. Join tokens are credentials and remain outside Git and logs. A single-manager swarm provides orchestration features but no manager failover: running tasks may continue after manager loss, while management requires recovery of the swarm or creation of a replacement cluster.

## Immutable releases and stack compatibility

A release contains the rendered stack bytes, source digest, immutable image digests for the target architecture, non-secret config digest, versioned external secret names, migration and backup plans, health assertions, and previous accepted release. Images are built and pushed before deployment because `docker stack deploy` does not build them.

`docker stack config` produces the deployment model used for review. The authored stack must use the subset accepted by the deployed Docker Engine and `docker stack deploy`; Compose-local conveniences are not assumed portable to Swarm. The release check rejects missing service images, mutable production references, unsupported fields, and architecture gaps before the effect, even where the current static StarCi checker only records structure.

Files land in `/srv/<app>/releases/<release-digest>/`; a stable pointer changes only after verification. The prior release stays available for bounded rollback. Registry manifest inspection proves each digest supports every selected placement architecture.

## DNS, TLS, networking, and placement

DNS is an external prerequisite with an owner, failure domain, endpoint reference, and receipt. Before HTTP-01, public names resolve to the ingress nodes and inbound 80/443 is reachable.

Ingress obtains and persists its certificate, verifies hostname, chain, expiry, and redirects, then exposes application routes after upstream readiness. Only declared ingress publishes public ports. Databases, caches, queues, identity, object stores, administration, metrics, and debugging remain on private networks or explicitly protected administration paths.

Swarm control-plane traffic uses mutual TLS. Application traffic on overlay networks is not assumed encrypted merely because the control plane is; encryption and its performance cost require an explicit, tested network policy. Stateful services declare placement constraints and durable storage behavior. A replicated task does not make a single-host volume highly available.

## Stack convergence and readiness

The adapter validates the target engine and renders before applying effects. Its application-owned commands use semantics such as:

```text
docker stack config -c <release>/stack.yaml
docker stack deploy --with-registry-auth -c <release>/stack.yaml <stack>
docker stack services <stack>
docker stack ps --no-trunc <stack>
```

These examples do not authorize StarCi to invent or run application commands. `docker stack deploy` returns before application correctness is established. Acceptance polls desired versus running replicas, rejects failed or repeatedly restarting tasks, inspects service update state, and then runs application assertions.

Swarm schedules service tasks and supports rolling updates, but dependency order is not an application-readiness guarantee. Migration and bootstrap jobs must have an application-owned completion protocol and immutable receipt; service-task completion or a healthy port alone does not prove their business effect. Swarm job modes also have different update and rollback semantics from long-running services.

## Updates and rollback

An update binds the accepted release, rendered stack digest, image digests, secret versions, current schema, backup receipt, and rollout policy. `deploy.update_config` and `deploy.rollback_config` define order, parallelism, delay, monitoring, failure action, and failure ratio where supported. The adapter observes actual service update state and tasks instead of treating configuration presence as success.

`docker service update --rollback` or stack redeployment can restore a previous service specification, but cannot undo database effects or recreate a removed secret. Application rollback selects a previous accepted release and verifies schema compatibility. Data restore is a separate, higher-impact action with an explicit loss window and activation authority.

## Secrets, Raft, and rotation

The repository stores only SOPS ciphertext and policy. Each VPS secret maps its stable logical `name` to an immutable versioned `runtimeName` and `version`. The rendered stack retains the logical key with `{external: true, name: <runtimeName>}`; it never embeds a file or secret value. Service grants refer to the logical key and may expose a stable target filename.

Preparation decrypts through trusted custody and creates the exact Swarm secret on a manager, preferably by stdin, without shell tracing or value output. Services receive only declared grants, normally under `/run/secrets/<target>`. Swarm encrypts secrets in transit and in manager Raft logs, and exposes them only to authorized running tasks.

Swarm secrets cannot be updated in place. Rotation creates a new versioned runtime name, updates the service grant, waits for all intended tasks and application checks, then removes the earlier secret only after no service references it. Reusing a name or deleting the earlier version before convergence is refused.

Raft encryption does not remove the need to protect manager access and backups. Autolock is a deliberate owner policy, not an automatic hardening toggle. When enabled, manager restart requires the unlock key. The recovery plan stores that key outside the repository, rehearses unlock after reboot, preserves the previous key briefly during rotation as Docker advises, and binds swarm-state backup to the matching unlock custody.

## Migrations, backup, and restore

Before migration, bind the release, current schema fingerprint, pending migrations, and a verified backup. Acquire the application's exclusion lock. Prefer expand/contract: run backward-compatible expansion, verify new code while the existing schema remains usable, and schedule destructive contraction separately.

Every persistent data class declares a service-appropriate consistent backup. Swarm Raft backup preserves orchestration state and keys; it is not an application database backup. Application backups are encrypted, hashed, versioned, retained by policy, and stored outside the VPS failure domain. Acceptance requires an isolated restore with semantic assertions.

A failed migration stops readiness and does not trigger blind rollback after unknown schema effects. Restore stages into isolation and requires explicit activation authority.

## Status, logs, and doctor

`status` reports every manifest component, stack service, desired/running replicas, failed/rejected tasks, update state, exact image digest, migration state, external dependencies, persistent data, TLS, and last backup. “Services exist” or “tasks are running” does not pass.

`logs` is bounded by service, task, time, and bytes and redacts credential-like shell, environment, URL, and JSON forms. `doctor` is read-only and separates host, Docker, Swarm manager/quorum, registry, DNS/TLS, custody, migration, data, application, and external failures.

## Cold-host matrix

Acceptance for every declared OS/architecture and supported topology requires disposable evidence for:

1. signed Docker installation and idempotent preparation;
2. correct new-swarm or existing-swarm reconciliation without destructive reinitialization;
3. unsupported platform, image, capacity, placement, and quorum rejection;
4. complete image build/publish closure before stack deployment;
5. `docker stack config` rendering and stack deploy compatibility;
6. service/task convergence followed by application health assertions;
7. manager and host restart with stable services, secrets, and data;
8. versioned generated and provider-issued secret rotation without disclosure;
9. successful compatible migration and readiness held closed on failure;
10. update failure, paused rollout, and compatible service rollback handling;
11. encrypted off-host application backup plus isolated semantic restore;
12. Swarm-state backup and, when enabled, autolock recovery;
13. first TLS issuance, renewal, and only declared public ports;
14. interrupted transfer, secret creation, migration, and deployment reconciliation;
15. non-destructive stack removal and application rollback boundaries.

Evidence records the OS image, architecture, Docker version, Swarm identity/topology, release and rendered stack digests, service/task results, and assertion artifacts. A single-manager test does not certify manager failover; an amd64 pass does not certify arm64.

## Static check

The check is `checkApplicationStacks` in `scripts/checks/stacks.mjs` — invoked
with `{repoRoot: <repo>, environment: 'vps', deploymentModelFile: <docker-stack-config.yaml>}`
(the stack render produced by `docker stack config`).

The `starci/application-stacks-check@1` result checks the manifest and caller-supplied rendered model, including `runtime: docker-swarm`, ownership closure, lifecycle declarations, versioned external Swarm secret mappings, and service grants. It does not call Docker or the VPS, authenticate rendering provenance, query a swarm, create or inspect secrets, inspect registry manifests, or prove convergence, migration, backup, restore, autolock recovery, TLS, or rollback behavior.

## Reference pattern

The synthetic `examples/application-stacks/tiny-stateful` kit is a portable shape for the static contract. Its VPS environment is not production-certified; each application supplies its own Swarm cold-host, lifecycle, security, and recovery evidence.

## Primary references

Read 2026-09-15:

- https://docs.docker.com/engine/install/ubuntu/
- https://docs.docker.com/engine/swarm/
- https://docs.docker.com/reference/cli/docker/stack/
- https://docs.docker.com/reference/cli/docker/stack/deploy/
- https://docs.docker.com/engine/swarm/services/
- https://docs.docker.com/engine/swarm/secrets/
- https://docs.docker.com/engine/swarm/swarm_manager_locking/
- https://docs.docker.com/engine/swarm/admin_guide/
- https://docs.docker.com/engine/swarm/networking/
- https://docs.docker.com/reference/compose-file/deploy/
