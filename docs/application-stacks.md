# Application stacks

An application stack is the complete deployment description for one application: frontend, APIs, workers, jobs, datastores, ingress, and every required external dependency. A directory or service count does not prove that the application can run.

The canonical manifest is `.stacks/application-stacks.yaml`, schema `starci/application-stacks@1`. Development uses Docker Compose. An Ubuntu VPS uses Docker Swarm and `docker stack`. Kubernetes is explicitly deferred with a reason. Terraform and provider APIs remain optional provisioning choices rather than runtime requirements.

## Ownership and component closure

Top-level components declare `id`, `role`, optional `purpose`, and optional `required`. Each environment maps every component ID to one ownership state:

- `managed` requires a deployment `service` and `failureDomain`;
- `external` requires `owner`, `failureDomain`, and a non-empty `endpointRef`, and cannot name a managed service;
- `excluded` requires a reason and cannot exclude a required component.

Ownership is explicit. It is never inferred from local versus hosted, Compose versus Swarm, or repository boundaries. A provider database or identity service remains part of application closure when its failure prevents the application from meeting its goal.

Each environment accounts for browser apps, APIs, workers, bootstrap and migration jobs, stateful services, ingress, persistent data, configuration, secret consumers, and external dependencies. Its runbook supplies `prepare`, `doctor`, `up`, `status`, `logs`, and `down`; VPS also supplies `update`, `rollback`, `backup`, and `restore`. Verification entries cover cold start, restart, and persistence.

An optional development `profiles` map expresses mutually exclusive ways to run that same closed inventory. A profile classifies every component as `docker-service`, `host-process`, `external`, or `excluded`; required components cannot disappear when the mode changes. The rendered Compose model selects one profile through `x-starci-profile`. Profiles without this declaration retain the original single-mode contract and are not described as dual-mode capable.

Top-level `sources` give each application source a repository role, symbolic host binding (`rootRef`), and immutable revision. The rendered model supplies the resolved roots and revisions in `x-starci-sources`. A resolved root may be outside the deployment repository for a routed split-repository application. This explicit binding avoids an adjacent-clone assumption; the static checker never searches neighboring directories.

## Finite layout

```text
.stacks/
  application-stacks.yaml
  dev/
    compose.yaml
    secrets/*.enc
    runtime/                 # private and ignored
    generated/{deployment-model.json,release.json}
  vps/
    stack.yaml
    secrets/*.enc
    bootstrap/
    generated/{deployment-model.yaml,release.json,migration-plan.json,backup-plan.json}
  keys/README.md             # public recipient and recovery instructions only
```

Generated output stays in a finite declared location. Development plaintext may use a regular file below a private, ignored `.stacks/dev/runtime/` directory and must never be committed. Decryption identities, Swarm unlock keys, join tokens, and recovery custody stay outside the repository.

## Development with Docker Compose and native application processes

A supported development machine needs Docker Engine running Linux containers and Docker Compose v2. The default full-Docker profile does not need host Node.js. An explicitly selected native-app profile additionally requires the application repository's declared host runtime and runs exact `package.json` scripts; PostgreSQL, identity, queues and other declared dependencies remain in Compose. `prepare` verifies the selected profile, sources, revisions, build inputs, runtime, capacity, ports, encryption recipients, and declared inputs. `up` materializes exact credentials, renders and validates Compose, runs infrastructure and migrations in dependency order, starts the selected application processes, and waits for declared readiness.

For a Docker application component, a profile binds `source`, `sourceRoot`, Compose `service`, exact build `context`, `dockerfile`, and relevant package inputs. For a host process it binds `source`, `sourceRoot`, a real package script name, a private file below `.stacks` for generated environment material, loopback readiness, and host ports. Dependency connections record only variable names, hosts, and ports: host applications use loopback plus published ports, while application containers use Compose service DNS plus container ports. Credentials remain in the existing encrypted/materialized secret path and are never placed in these endpoint declarations.

Every stateful Docker component in a profile declares named volumes, custody, and backup references. Dependency images use immutable digest identities. The same host port may appear in two mutually exclusive profiles; it cannot collide within the selected profile. The lifecycle receipt binds the selected profile so a Docker and native copy of the same app cannot be treated as one healthy deployment.

Restart and container recreation reuse the same credential bytes. A generator must not replace a datastore credential while its persistent volume remains. Development `down` retains named data and credential custody by default.

## VPS with Docker Swarm

The VPS runtime is Swarm, including a valid single-manager swarm when that availability tradeoff is accepted. Releases contain registry-published images referenced by immutable digest; `docker stack deploy` does not build application images. The rendered stack model must use features supported by `docker stack deploy`, and application readiness is verified from service tasks and application assertions rather than inferred from deploy command success.

The VPS lifecycle renders with `docker stack config`, deploys or updates with `docker stack deploy`, and observes `docker stack services` plus `docker stack ps`. Service update and rollback policies bound rollout behavior, but a successful scheduler transition is not application, migration, or data-recovery evidence. See [Application stacks on an Ubuntu VPS](application-stacks-vps.md).

## Credential lifecycle

Every secret declares its source, encrypted custody reference, recipient policy, and key custody. Generated values add `generationAlgorithm` and `formatPolicy`; provider-issued values add `sourceOwner`.

Development uses a file-backed declaration:

```yaml
- name: postgres-password
  source: generated
  generationAlgorithm: CSPRNG 32 bytes
  formatPolicy: 64 lowercase hexadecimal characters
  encryptedRef: .stacks/dev/secrets/postgres-password.enc
  materializedPath: .stacks/dev/runtime/secrets/postgres-password
  recipientPolicy: owner-and-recovery
  keyCustody: owner custody outside the repository
```

VPS uses an immutable, versioned external Swarm secret:

```yaml
- name: postgres-password
  source: generated
  generationAlgorithm: CSPRNG 32 bytes
  formatPolicy: 64 lowercase hexadecimal characters
  encryptedRef: .stacks/vps/secrets/postgres-password.enc
  runtimeName: app-postgres-password-v3
  version: v3
  recipientPolicy: owner-and-recovery
  keyCustody: owner custody outside the repository
```

The rendered stack keeps the logical key and maps it to the immutable engine name, for example `postgres-password: {external: true, name: app-postgres-password-v3}`. Service grants use the logical key and may choose a stable mount target. The preparation path decrypts through trusted custody and creates the exact engine secret without placing its value in argv or logs. A secret is not updated in place: create a new versioned name, update services to consume it, verify them, then retire the unreferenced old version. Credential presence remains distinct from provider verification.

Swarm secrets are encrypted in transit and at rest in manager Raft logs and are mounted only into authorized service tasks. Manager access still has high privilege. Autolock is an explicit owner policy with a tested restart and recovery procedure; it is never enabled automatically. If enabled, custody must preserve the unlock key independently and account for rotation and quorum recovery.

For development, ciphertext in Git does not encrypt runtime mounts. The ignored materialization directory should use mode `0700`; files use `0400` or `0600`. `_FILE` is valid only when the exact image or application parser supports that key. No secret value enters argv, image layers, rendered non-secret config, logs, or Work.

## Lifecycle and authority

The durable sequence is:

`inspect -> prepare -> render -> validate -> backup -> pull -> migrate -> converge -> verify -> accept|rollback -> finalize`

Each transition binds an idempotency key and semantic input digest. An interrupted effect is reconciled rather than assumed complete. Success requires named health assertions, completed jobs or migrations, exact image digests, external dependency checks, and application behavior. Application rollback and data restore remain separate actions; schema effects determine whether an old image is safe.

The read-only interface is:

```text
starci stacks check <repo> --environment dev|vps --deployment-model <rendered.yaml|json>
```

Its `starci/application-stacks-check@1` result checks static conformance. For dev, the deployment model comes from Docker Compose rendering. For VPS, it comes from Docker Stack rendering. Model provenance is supplied by the caller rather than independently authenticated.

## Checker coverage and acceptance evidence

The static checker validates the closed manifest shape, environment runtime, complete component classification, ownership fields, bounded rendered model input, selected unresolved interpolation, sensitive environment naming, required runbook entries, declared VPS platform fields, safe custody references, structural SOPS envelopes, exact environment-specific secret declarations and grants, and the presence of Swarm deploy policy, healthcheck, and overlay networking for managed non-bootstrap services. For declared dev profiles it also validates exact selected-profile closure, mutually exclusive group identity, split-repository source and revision bindings, real package scripts and build inputs, rendered build contexts, immutable dependency images, host/container endpoint separation, per-profile port uniqueness, and named state-volume custody.

It does not invoke Docker or host processes, execute a runbook, authenticate the rendered model, inspect native env contents, independently read Git history, decrypt SOPS, discover inventory, or independently prove ownership. A declared profile, readiness URL, source revision, or image digest is checked for consistency rather than proven live. The checker also does not prove dependency order, conflicting processes already running, port exposure, image availability, healthcheck quality, migration behavior, update convergence, rollback safety, backups, resource capacity, Swarm quorum, or actual Ubuntu/image architecture compatibility.

Those properties require disposable and cold-host evidence: deterministic rendering, runtime-native validation, secret allowlisting and redaction, supported image platforms, cold start, restart with stable credentials, migrations before readiness, failed-task rejection, encrypted off-host backup, isolated restore, and non-destructive application rollback. A manifest or successful static check alone does not satisfy them.

## Reference pattern

The synthetic `examples/application-stacks/tiny-stateful` kit demonstrates the manifest, distinct dev and VPS runtimes, secret custody, and static checker input without making production-readiness claims. Application-specific audit evidence belongs in that application's reports.

## Primary references

Read 2026-09-15:

- https://docs.docker.com/compose/
- https://docs.docker.com/reference/cli/docker/stack/
- https://docs.docker.com/reference/cli/docker/stack/deploy/
- https://docs.docker.com/engine/swarm/secrets/
- https://docs.docker.com/engine/swarm/swarm_manager_locking/
- https://docs.docker.com/engine/swarm/services/
