Owner: knowledge/application-stacks.yaml
# Application stacks

An application stack is the complete deployment description for one application: frontend, APIs, workers, jobs, datastores, ingress, and every required external dependency. A directory or service count does not prove that the application can run.

The canonical manifest is `.starcistacks/application-stacks.yaml`, schema `starci/application-stacks@1`. `modules/schemas/stacks-layout.yaml` governs the TREE this manifest lives inside (which directories exist, which files are required, which are refused); `modules/schemas/application-stacks.schema.yaml` is the machine form of the manifest's own CONTENT. `knowledge/application-stacks.yaml` owns the deployment requirements (STACK-*) the manifest and this document explain. Full development uses Docker Compose; lite development uses the local Supabase CLI stack. Under the 2026-10-14 ruling, lite production declares `runtime: docker-swarm` and tracks its rendered stack under `.starcistacks/production/infra/swarm/`. An Ubuntu VPS uses Docker Swarm stacks in either edition; Docker Compose and host crontab are forbidden there. Whole-package Kubernetes deployment is explicitly `deferred` or `supported` with a reason, and its posture must match whether `.starcistacks/k8s/` actually exists; lite keeps it deferred.

## Manifest shape

`components` is a map from component id to `{role, image?, compose?, purpose?, required?, mode?, scheduler?, schedule?}`. `role` is a free-text classification, including `stateful`, `service`, `observability`, `ingress`, `scheduler` and `job`; existing classifications remain valid. `mode` is `service` by default or `replicated-job`. A scheduled replicated job names its declared scheduler component id in `scheduler` and its cron expression in `schedule`. `image` and `compose` are descriptive cross-references to the environment's own stack fragments, not a rendering instruction. `sources` is an optional list of `{repository}` entries naming the application repositories this stack deploys, with no further binding - the manifest is a static declaration, not a build pipeline.

`backing` is an optional map of managed dependencies that the stack does not run, such as `supabase: {provider: supabase, managed: true}`. It is separate from the runnable `components` and the delivery/quality `services` catalog. The new component fields and `backing` are optional so older declarations remain loadable. The existing required `k8s: {status: deferred | supported, reason: ...}` posture remains required, including for lite.

`environments` is a map from environment name to:

- `status: supported`, `runtime: docker-compose | docker-swarm`;
- `composeFiles`, an array of paths relative to that environment's own directory (`.starcistacks/<env>/...`), never prefixed with `.starcistacks` again;
- `components`, a map from component id to a free-form override object (a Compose `port`, a Swarm `replicas` count, or nothing at all); a component absent from one environment's map is simply not run there - there is no separate `ownership` vocabulary to keep in sync with that absence;
- `runbook`, a path (again environment-relative, typically `README.md`) to the file a human and the checker both read for the environment's lifecycle commands;
- `secrets`, an array of `{name, where, recipientPolicy, keyCustody}`.

Every catalog component id that appears as a rendered Compose or Swarm service name must be a declared id (`compose-service-unclassified` otherwise); the reverse is not required, because a component such as a profile-gated placeholder image can legitimately run as a host process instead and never appear in the rendered model at all.

## The runbook lives in a file, not the manifest

`runbook` names a file; the checker resolves and reads it. That file's Markdown table must document exactly the same seven commands `modules/schemas/stacks-layout.yaml` promises - `prepare`, `doctor`, `up`, `status`, `logs`, `down`, `verification` - as one row each (`runbook-command-missing` names whichever row is absent). This holds for every environment, VPS included: there is no separate VPS-only command set. The commands are declared and legible; the checker does not execute them.

## secrets custody

Run these commands at the application root. Install `sops` and `age` (`age-keygen` on `PATH`) before setup; a missing tool stops the command with an actionable error. In both editions, application custody is only `.starcistacks/<env>/secrets/<slug>.enc`, encrypted with SOPS to the age recipient declared in the root `.sops.yaml`. Root `.env*` or `secrets.env` holding secret values, `.secrets/`, private-key files and decrypted repository files are forbidden, including ignored files; plaintext in `deploy/` or a workflow is forbidden too. Existing plaintext custody must be migrated and removed. The age identity has its separate owner-only custody described below; the frontend receives public configuration only.

A manifest secret is `{name, where, recipientPolicy, keyCustody}`. `where` names the member relative to its environment directory, such as `secrets/app-be-db`; `<where>.enc` must be a regular, non-symlink SOPS envelope. `recipientPolicy` describes the actual `.sops.yaml` recipients, and `keyCustody` describes the owner's external private-key storage and backup. Both statements are required. An identity or resource record names its sealed member app-relative through `custody.sealed`; `.starciwork` never holds the value or envelope (`SEALED_CUSTODY_LOCATION`, `SEALED_FILE_IN_WORK`). The checker also refuses tracked private-key material (`STACKS_PLAINTEXT_SECRET`) and obtains tracked status through `git ls-files`.

### Initialize and seal

```sh
starci app secret init
starci app secret set production app-be API_SECRET --generate 32
starci app secret list production
```

`init` creates a local age identity when none exists and records only its public recipient in `.sops.yaml`, using this creation rule:

```yaml
creation_rules:
  - path_regex: '\.starcistacks[/\\][^/\\]+[/\\]secrets[/\\][^/\\]+\.enc$'
    age: <public-age-recipient>
```

The 2026-10-14 custody ruling places the private age identity only in the owner's untracked `.claude/secret.env` as `SOPS_AGE_KEY`; application tooling must not fall back to an OS `keys.txt` file. The owner migrates an existing matching identity locally without displaying it or changing its recipient. Re-running `init` preserves an existing matching recipient rule; it does not rotate recipients or re-encrypt existing envelopes. A retained recipient still requires its matching private identity for decryption. Key rotation is owner-run, and sharing an identity across projects does not provide key isolation between them.

`set <env> <slug> <KEY>` reads the value from stdin or creates it with `--generate <bytes>`. Feed stdin directly from an owner-controlled local secret source; do not put a value in argv, shell history, chat or an `echo` command. The command never prints the value. One trailing stdin line ending is removed; other supported value bytes are preserved. Multiline LF values are supported; carriage returns and a literal backslash followed by `n` are rejected without printing the value because SOPS dotenv cannot represent them losslessly. Each member is a SOPS dotenv document, and updating one key retains the other keys. `list <env>` prints key names only. New envelopes use dotenv; existing JSON/YAML envelopes can be read during migration.

### Materialize for a process

```sh
starci app secret materialize production
starci app secret get production app-be API_SECRET --to-file
starci app secret get production app-be --to-file
```

`materialize <env>` decrypts all custody members into one file per KEY. `get <env> <slug> [KEY] --to-file` does the same for one member, or one key when KEY is given. Both report paths rather than values: `get --to-file` writes `KEY_FILE=...` metadata to stderr and leaves stdout empty unless `--reveal` is given; `materialize` writes its path metadata to stdout. Plaintext lives only in memory or below `%LOCALAPPDATA%/StarCi/secrets/<project>/<env>/`; `<project>` is the name in `hfs.json`. The macOS base is `~/Library/Application Support`; the Linux base is `$XDG_DATA_HOME` (default `~/.local/share`). `--reveal` explicitly allows stdout disclosure and belongs only to an owner's private terminal; automation uses file output.

Export `<NAME>_FILE` with the returned absolute path and start the backend in that same execution context. Its canonical configuration boundary reads the file when `<NAME>_FILE` is set, otherwise it reads `<NAME>`; a bad file pointer fails rather than falling back silently. Keep file pointers and public configuration in the launcher. Every backend app reads its environment through `<app>.env.ts`, which declares an interface and `read<App>Env(env: EnvSource)` with typed, fail-fast parsing; `main.ts` supplies the source to that reader, while `<app>.options.ts` holds env-derived values and port bindings with no parsing. Materialized files are temporary process inputs outside the repository, not a second custody store; do not copy them into the repository, build context or frontend, and remove them after the process no longer needs them.

### CI

Application secret values remain in the sealed members, never dotenv blobs or individual application credentials in the CI secret store. The owner provisions only the matching age key and declared deployment transport credentials there. The workflow injects `SOPS_AGE_KEY` only into the protected job that needs custody, without creating a `keys.txt` file or using `SOPS_AGE_KEY_FILE`; it never runs `init` to generate a replacement CI identity. For example, on a runner with the app CLI and SOPS tools already available:

```yaml
- name: Materialize production custody
  env:
    SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}
  run: starci app secret materialize production
```

Use protected CI environments for production access, declare permissions and concurrency, pin actions by full commit SHA, and pin tool installs by digest or checksum. App workflows run on release tags or manual dispatch. Set the required `*_FILE` pointers for the consuming step, and remove the materialized directory when the job completes. Secret keys and decrypted files are excluded from logs, caches, artifacts and images; do not enable shell tracing or run `--reveal`. A job that only builds or checks source needs no production key.

### Production

Keep the matching age identity in the owner's untracked `.claude/secret.env` as `SOPS_AGE_KEY`. Materialize the selected environment outside the checkout, grant only the consuming service account access, and pass `*_FILE` pointers. Containers mount the required files read-only; plaintext is never baked into an image or rendered stack environment. For Swarm, provision immutable versioned runtime secrets from the materialized files and use the external runtime names described below. Rotation seals the replacement, materializes it, changes the runtime grant, verifies convergence, then retires the old runtime secret and obsolete local files; the owner controls key rotation.

### Migrate nivo-lite

Keep nivo-lite's existing `.sops.yaml` recipient and `.starcistacks/production/secrets/app-be-db.enc`. Use the identity that already decrypts that envelope; `init` is not a recipient-rotation command. Begin with `starci app secret list production`, which reveals names only, and inventory the remaining root `secrets.env` locally without displaying its values.

For each remaining secret, choose its environment, resource slug and KEY. An owner-run local migration helper must parse `secrets.env` as dotenv in memory, pipe only that key's value into `starci app secret set <env> <slug> <KEY>`, check the command's exit status, and emit only key names and success/failure. Do not use shell substitution or interpolate values into a command string. Keep the source file until every selected key is sealed and its file-backed consumer has been verified; do not overwrite an existing sealed key just because the root file contains the same name. Public values belong in canonical public configuration, not encrypted custody.

Run `starci app secret materialize production`, wire the backend's required `*_FILE` pointers, and update the app's own with-secrets helper / `env-sync.mjs` plus their package-script callers to stop loading or regenerating the root file. Verify backend startup and the affected database/auth behavior without value-bearing logs. After verification, remove root `secrets.env`, any root `.env*` / `.secrets/` copies and stale loaders, then run `starci app check` and `starci app hygiene`. If plaintext was ever tracked or otherwise exposed, rotate those credentials; deleting the working-tree file does not remove earlier disclosures. Agents may work with key names, paths and receipts, while the owner performs value-bearing migration locally.

## Directory shape

These are read-only structural findings shared with `modules/schemas/stacks-layout.yaml`, independent of manifest content:

- `STACKS_UNDECLARED_ENVIRONMENT` - a directory under `.starcistacks` (other than `k8s`) is not one of the declaration's environment names.
- `environment-directory-missing` - a declared environment has no directory.
- `STACKS_SCRATCH_IN_CANONICAL` - `.starcistacks/tmp` exists; scratch belongs in the OS temp directory.
- `k8s-directory-missing` / `k8s-directory-unexpected` - `.starcistacks/k8s` and `k8s.status` disagree.
- `STACKS_UNDECLARED_COMPOSE` - a Compose-shaped YAML file (one with a `services` or `include` key) sits under an environment's `infra/` tree without being declared in `composeFiles` or reachable through an `include:` chain from a declared file. A non-Compose YAML file in the same tree, such as a Prometheus scrape config, is not a compose file and is not flagged merely for its extension.

## Services: Sonar and every other delivery service

The declaration's `services` block (schema `$defs.service`) states the delivery, quality and platform services the repository's code and CI use - not Compose services, which are `components`. Ids are closed: `sonar`, `container-registry`, `analytics`, `error-tracking`. Each entry names:

| field | meaning |
|---|---|
| `provider` | closed per id: sonarqube/sonarcloud, ghcr/dockerhub/ecr/gar, posthog/plausible/umami/google-analytics, sentry/glitchtip |
| `mode` | `local` (a stack runs it: `stack` and `host.local` required), `hosted` (`host.public` or `host.fromCredential`), `disabled` (`reason`; CI must not call it) |
| `host` | `local` URL ops use, `public` URL GitHub CI uses, or `fromCredential` when the endpoint travels inside a credential (a Sentry DSN) |
| `stack` | a local service's stack, one of two forms: project-owned `{repository, root: .starcistacks, environment, compose, container?, publishedBy?}` or host-owned `{owner: host, root: .claude/ext/<service>, environment, compose, container?, publishedBy?}` |
| `auth` | `token`, `oidc`, `github-token` (GHCR), `none` |
| `projects` | `[{repository, key}]` - the project key per repository (`sonar.projectKey` must match) |
| `qualityGate` | sonar only: `starci-quality`, the one gate whose thresholds live in `knowledge/sonar-gate.yaml` (any other value is `STACKS_QUALITY_GATE_DRIFT`); `sonar-local` makes the server gate of that name carry them and `starci kernel settle` holds `backend.implement`, `interface.implement` and `code.refactor` to it |
| `credentials` | product form: `[{id, env or key, custody: {repository, path}}]` - custody references in the product's own repository, never values; `<path>.enc` must exist |
| `runtimeSecrets` | example form: `[SONAR_TOKEN]` - the one variable of the runtime's untracked `.claude/secret.env` an app inside the runtime repository reads (CI: the repository secret of the same name); the SonarCloud organization is configuration, `config.yaml` `sonar.organization` (env `SONAR_ORGANIZATION` wins; CI: the repository variable), never a secret; no stack, no `host.local`, no custody. Each form is refused for the other kind: `STACKS_EXAMPLE_FORM` (an example declaring a stack, `host.local` or custody, another provider, or no `runtimeSecrets`), `STACKS_PRODUCT_FORM` (a product declaring `runtimeSecrets`) |
| `ci` | `wiring` required / optional-follow-up / not-used, `secrets [{name, credential}]`, `vars [{name, value}]`, `permissions`, `provisioning` |
| `ownerAction` | `none` unless the owner alone can give something (`{needed, reason}`); `none` is mandatory while custody holds every credential |

`scripts/gates/starcistacks.mjs <repo> [--new] [--admitted-at <t>]` (op check `starci-starcistacks-check`, contract change `starcistacks-services`) refuses an unknown or ambiguous entry, missing custody, a redundant owner action, CI calling a disabled or undeclared service, and project-key drift; a missing declaration or services block in an existing repository is a suspect with a planned follow-up (`workspace.manage` mode `stacks`, fixtures in `examples/starcistacks-services/`). `starci runtime validate` reports the same findings as suspects. `starci kernel report` refuses an ask for a credential or CI setting a declaration marks `ownerAction: none` with its custody present (`ask-declared-in-stack`). `resolveStackService(repo, id)` is the reader tools such as `scripts/gates/sonar-local.mjs` use; a repository without its own entry falls back to the source host's entry when that lists it among its projects.

`.starcistacks` is the only stack root *a repository owns*. A service shared by every routed project instead declares `stack.owner: host` and `stack.root: .claude/ext/<service>` — the extension ships inside the installed runtime tree, so no repository is named and the checker resolves `<root>/<compose>` under the runtime root itself (`environment` stays a required slot label, not a path segment). The shared local SonarQube is the first such extension (`.claude/ext/sonar`, Compose project `starci`, container `starci-sonarqube`; see `ext/sonar/README.md`); a product never copies its Compose files into its own `.starcistacks`. The extension holds no custody and no secret: its secrets are variables of the owner's untracked `secret.env` that `starci gate sonar up` passes to Compose and `sonar-local.mjs` reads by name (`SONARQUBE_ADMIN_TOKEN`), so a declared credential citing a path inside the extension is not read (a product declaration should drop it), while each project's own analysis token stays only in `.starcistacks/<env>/secrets/*.enc`. These host credentials are separate from application custody; application KEYS.md rosters contain names and file pointers, never values.

## Docker Swarm on a VPS

A VPS environment declares `runtime: docker-swarm` in both editions. Lite tracks the production model under `.starcistacks/production/infra/swarm/`, uses Supabase instead of self-hosted Postgres, and permits a database-backed sidecar only with SQLite on a declared persistent volume; a sidecar requiring Postgres, Redis or Mongo is refused. No Docker Compose, host crontab, systemd timer or host scheduling loop runs production work. Schedules belong to the backend scheduler, pgmq with a pg_cron tick, or a declared replicated-job backed by an app CLI command; deploy scripts invoke those owners rather than implementing business logic.

A single VPS is a one-manager swarm: it provides orchestration but no manager failover — running tasks may survive a manager loss, management requires recovery or a replacement cluster. Additional nodes may improve capacity or availability; manager quorum and data placement must then be designed explicitly, and a multi-manager runbook preserves quorum and records node identities and roles. Kubernetes remains deferred for lite. Terraform or a cloud API may provision machines or DNS, but neither owns the runtime topology. DNS changes, provider URIs, `docker swarm init` and key rotation are owner-run steps declared in the runbook; the standard does not automate them.

- **Platforms need a verified matrix.** The candidate matrix is Ubuntu Server 22.04 LTS amd64, 24.04 LTS amd64 and 24.04 LTS arm64; each stays a candidate until its cold-host suite passes with every application image. Docker or Ubuntu support never proves application support. The runbook records the declared OS and architecture matrix and checks Docker version bounds, CPU, RAM, disk, inodes, filesystem, ports, time, DNS, backup headroom, Swarm state, manager identity, quorum and placement during `prepare`/`doctor`.
- **Preparation is provider-neutral and non-destructive.** It verifies the OS, architecture, cgroups, capacity, clock, DNS, ports, SSH trust, Docker Engine, registry access and current Swarm membership before any effect; creating a swarm, joining a node or changing autolock is an explicit effect with its own custody and recovery. Production uses Docker's signed Ubuntu apt repository; SSH host identity is pinned, first contact is owner-verified, and changed host keys, passwords in argv, disabled host-key checking and broad root login are refused.
- **Releases are immutable.** A release carries the rendered stack bytes, source digest, immutable image digests per architecture, non-secret config digest, versioned secret names, migration and backup plans, health assertions and the previous accepted release; images are built and proved with `starci release images`, then pushed by the owner-approved release flow before the Swarm deployment step, which never builds. The rendered Swarm configuration is the review model; Compose-local conveniences are not assumed portable to Swarm. Files land in `/srv/<app>/releases/<release-digest>/` behind a stable pointer that moves only after verification; the prior release stays available for bounded rollback.
- **Only one declared ingress publishes public ports.** Any single declared, digest-pinned ingress is accepted, including Traefik or Caddy; the standard does not select a vendor. DNS is an external prerequisite with an owner and a receipt; ingress obtains and persists its certificate before exposing routes after upstream readiness. Swarm control-plane traffic is mutually authenticated; application traffic on overlay networks is not assumed encrypted without an explicit, tested policy. Stateful services declare placement constraints — a replicated task does not make a single-host volume highly available.
- **Convergence is observed, not declared.** A Swarm deployment request returns before application correctness; acceptance polls desired versus running replicas, rejects failed or restarting tasks, inspects update state, then runs application assertions. Migration and bootstrap jobs need an application-owned completion protocol and an immutable receipt — a finished task or a healthy port alone does not prove a business effect.
- **Rollback cannot undo data effects.** `docker service update --rollback` or a stack redeploy restores a service specification; it cannot revert a schema change or recreate a removed secret. Application rollback selects a previous accepted release and verifies schema compatibility; a data restore is a separate, higher-impact action with an explicit loss window and activation authority.
- **Secrets are versioned and never embedded.** Each VPS secret maps a stable logical `name` to an immutable versioned `runtimeName`; the rendered stack keeps `{external: true, name: <runtimeName>}` and never a file or value. Rotation creates a new versioned name, updates the grant, waits for convergence, then removes the earlier secret — a name is never reused and an earlier version is never deleted before convergence. Swarm secrets are encrypted in transit and in Raft, which does not remove the need to protect manager access, backups and (when enabled) the autolock unlock key.
- **Migrations and backups bind evidence first.** A migration binds the release, the current schema fingerprint, the pending set and a verified backup under the application's exclusion lock, and prefers expand/contract. Application backups are encrypted, hashed, versioned and stored outside the VPS failure domain; acceptance requires an isolated restore with semantic assertions. Swarm-state backup preserves orchestration state and keys — it is not a database backup.

Acceptance per declared OS/architecture needs disposable cold-host evidence of: signed Docker installation and idempotent preparation; new- or existing-swarm reconciliation without destructive reinitialization; rejection of unsupported platform, image, capacity, placement and quorum; complete image build/publish closure before deploy; rendered Swarm configuration review; convergence plus application health; restart with stable services, secrets and data; secret rotation without disclosure; compatible migration with readiness held closed on failure; update failure and rollback handling; encrypted off-host backup with isolated restore; swarm-state backup and autolock recovery; first TLS issuance and renewal with only declared public ports; interrupted-operation reconciliation; and non-destructive removal with application rollback boundaries. A single-manager test never certifies manager failover, and an amd64 pass never certifies arm64.

### Lite production

Lite retains the full application code structure and swaps backing infrastructure for Supabase (owner ruling 2026-10-13). Its api, web, ingress and application sidecars run on the VPS as a `runtime: docker-swarm` environment. `backing.supabase` declares `{provider: supabase, managed: true}`; that managed dependency is not a Swarm service. The `app.starcistacks` lite slot requires the manifest and permits the environment's tracked, value-free `infra/swarm/**` stack, runbook, environment record and sealed secret custody. It refuses Compose, Kubernetes and Terraform infra trees, runtime and seeds trees, and components whose images duplicate a Supabase-provided backing service: postgres, redis, kafka, keycloak, minio, rabbitmq, mysql or mongo.

For every service in a Swarm stack, declare an image pinned by `@sha256:<digest>`, a `healthcheck`, `deploy.update_config` with `order`, `failure_action: rollback` and `monitor`, `deploy.rollback_config`, and `deploy.restart_policy`. Only a component with `role: ingress` publishes ports. Every stack secret is `external: true` with a versioned `name` ending in `-v<N>`; materialize its value from the environment's SOPS custody for each release.

**Ingress is any declared ingress (owner ruling 2026-10-14).** The component with `role: ingress` may run Traefik or Caddy (or another reverse proxy); the checker keys on the role and the published ports, never on the image name. The lite example uses Caddy, and a live app that already holds persisted Traefik certificates keeps Traefik. Declare it as the `ingress` component in `application-stacks.yaml` and in `infra/swarm/stack.yaml`; the ingress alone publishes ports and carries the same digest, healthcheck and update/rollback policy as every other service.

**Sidecar state is SQLite on a declared persistent volume (owner ruling 2026-10-14).** A sidecar such as n8n does not run its own Postgres in lite: that image would duplicate a Supabase-provided service and is refused. The approved pattern is the sidecar's built-in SQLite database on a named volume declared in `infra/swarm/stack.yaml` (for n8n, `DB_TYPE=sqlite` and `N8N_USER_FOLDER` on the volume), with a placement constraint that pins the single replica to the node holding the volume and a backup of that volume in the runbook. The checker does not refuse a named volume; it refuses only the Postgres, Redis, Kafka, Keycloak, MinIO, RabbitMQ, MySQL and Mongo images.

## Scheduled work on Swarm

Swarm has no native CronJob. Recurring work is application-owned: a back-end scheduler dispatches a command, a pgmq job is consumed by its api or worker, or a lite pg_cron tick enqueues work. Do not install a host crontab from a workflow, deployment file, script or stack tree. The checker reports the file and line of crontab installation, including `crontab -`, `crontab -l`, `/etc/cron.d`, `cron.d` and `@reboot`.

A CLI batch on a schedule is either converted to an application scheduler or declared as a `mode: replicated-job` component with a cron `schedule` and a `scheduler` pointing to a declared `role: scheduler` component running swarm-cronjob. Include both components in the target environment. For example, these manifest entries schedule an app-owned report command:

```yaml
components:
  cron:
    role: scheduler
    image: crazymax/swarm-cronjob@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    compose: infra/swarm/stack.yaml
  report:
    role: job
    mode: replicated-job
    scheduler: cron
    schedule: "0 3 * * *"
    image: ghcr.io/example/app-cli@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
    compose: infra/swarm/stack.yaml
```

The corresponding stack service declares `deploy.mode: replicated-job`, starts at zero replicas, has `restart_policy.condition: none`, and repeats the declared schedule in service labels. Both services still carry the common health and rollout policies; this fragment shows the scheduler and job wiring:

```yaml
x-rollout: &rollout
  update_config: {order: stop-first, failure_action: rollback, monitor: 30s}
  rollback_config: {order: stop-first, monitor: 30s}
  restart_policy: {condition: on-failure}
services:
  cron:
    image: crazymax/swarm-cronjob@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    healthcheck: {test: [CMD-SHELL, "kill -0 1"], interval: 30s, timeout: 5s, retries: 3}
    volumes: [/var/run/docker.sock:/var/run/docker.sock]
    deploy:
      <<: *rollout
      replicas: 1
      placement: {constraints: [node.role == manager]}
  report:
    image: ghcr.io/example/app-cli@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
    command: [cli, report, run]
    healthcheck: {test: [CMD-SHELL, "kill -0 1"], interval: 30s, timeout: 5s, retries: 3}
    deploy:
      <<: *rollout
      mode: replicated-job
      replicas: 0
      restart_policy: {condition: none}
      labels:
        swarm.cronjob.enable: "true"
        swarm.cronjob.schedule: "0 3 * * *"
```

The image digests above illustrate the declaration; a release binds the actual registry digests. The CLI command owns completion, retry and overlap handling. A process healthcheck does not prove that its report completed; record application completion evidence and an idempotency or exclusion policy.

## Runtime configuration and health

Configuration and health belong to the component that consumes them. Each runnable component identifies its repository role, immutable revision, package root, entry command or image, and the files that define its configuration and startup — a monorepo path and a split-repository root share the model.

- **One typed configuration boundary per runnable package.** It maps environment keys and file-backed secrets into application values, rejects unknown or malformed critical values, and finishes validation before listeners, migrations, consumers, schedulers or outbound clients begin effects. Defaults exist only for values safe in the declared environment; credentials, tenant identity, public origins, datastore authority and remote endpoints get no production-looking placeholders. Environment templates list names, purpose, format and applicability without values; secret values stay in the declared custody path; startup errors name the field and rule while redacting the value.
- **One observable startup sequence:** load source identity → materialize custody → parse configuration → validate mode and dependencies → migrate/bootstrap under authority → start listeners/workers → expose readiness → verify behavior.
- **Four health signals with different jobs:** startup (initialization in progress or failed), liveness (the process can keep making progress — process-local, so a provider outage never causes restart churn), readiness (this instance may receive its declared work — required dependencies and compatibility), functional verification (a named caller journey works). Components classify dependencies as required, degraded or optional by behavior, not by vendor; probes are bounded and never mutate business data; readiness never replaces migration evidence, authenticated verification or rollout observation.
- **Placement changes addresses, not responsibility.** A host process binds an exact package script, public configuration and temporary `*_FILE` inputs outside the repository, loopback ports and host-reachable endpoints; a container binds exact source/build inputs or an immutable image, service-DNS connections and a published readiness or container healthcheck; a remote application API binds an external owner and failure domain, an endpoint configuration reference, caller auth and timeout, and caller-bound verification — hosted on Kubernetes or not, it is an application API to its caller, not the cluster ([remote application API](remote-application-api.md)).
- **Static binding proves drift, not life.** Conformance binds source revisions, package/config files, images, endpoint names, custody names and verification entry points and reports missing or drifting inputs before effects; it never authenticates history, reads secret values or proves a rollout. Live evidence records the selected profile, source and image identities, the rendered configuration digest (secrets excluded), migration/bootstrap results, health observations and named functional checks; a source or config change invalidates only the affected component's proof.

## Checker coverage and acceptance evidence

The static checker validates manifest shape against the machine schema, the tree shape above, environment-relative Compose path safety, component-id/service-name correspondence, runbook file existence and command completeness, secret custody (SOPS envelope, plaintext-path safety, tracked-plaintext refusal, required policy prose), unresolved rendered-Compose interpolation and plaintext sensitive environment values in the rendered model. Swarm checks require digest-pinned images with no leftover `build`, healthchecks, update and rollback configuration, restart policies, versioned external secrets, ingress-only published ports and the replicated-job scheduler wiring above. Both `starci app check` and `starci gate starcistacks` validate lite stack shape, Swarm policies, host crontab installation and duplicate backing-service components. The gate can also check an explicitly rendered Swarm configuration: `checkApplicationStacks({repoRoot, environment: 'vps', deploymentModelFile})` in `scripts/gates/stacks-gate.mjs`.

It does not invoke Docker or host processes, execute a runbook, authenticate the rendered model's provenance, decrypt SOPS, inspect registry manifests, or independently discover component-to-service placement. A rendered Compose or Swarm model is checked for consistency with the declaration, not proven live — convergence, migration, backup, restore, autolock recovery, TLS and rollback behavior are the application's own evidence. Tracked-plaintext detection is a best-effort `git ls-files` query, not a cryptographic or content-based leak scan.

## Deployment rules (alpha.15)

These requirements apply to lite and full; the rule catalog and its enforcers provide the implementation and proof for each requirement.

- <a id="r250-deploy-scan"></a> R250 `HFS_DEPLOY_SCAN`: refuse host cron, production Compose, host scheduler loops and business logic in deploy scripts (`HFS_HOST_CRON`, `HFS_DEPLOY_NO_LOGIC`, `HFS_DEPLOY_COMPOSE_ON_VPS`, `HFS_DEPLOY_SCHEDULER`).
- <a id="r251-deploy-workflow"></a> R251 `HFS_DEPLOY_WORKFLOW`: require protected deployment environments, permissions, concurrency and allowlisted credentials, full-SHA action pins, pinned tool installs and release-tag/manual app triggers (`HFS_DEPLOY_WORKFLOW`, `HFS_WORKFLOW_PIN`, `HFS_CI_TOOL_INSTALL`, `HFS_APP_WORKFLOW_TRIGGER`).
- <a id="r252-script-hygiene"></a> R252 `HFS_SCRIPT_HYGIENE`: delivery scripts and workflow commands load sealed custody through the app secret CLI rather than reading plaintext secret files (`HFS_SCRIPT_PLAINTEXT_LOAD`), never enable shell xtrace or request revealed values (`HFS_SCRIPT_XTRACE`), and keep service-role references inside the back-end Supabase integration and its configuration (`HFS_SERVICE_ROLE_SCOPE`).
- R266 `STACKS_SWARM_HARDENING`: `STACKS_SECRET_NOT_EXTERNAL` requires external Swarm secrets, `STACKS_SECRET_UNVERSIONED` requires immutable declared versions, and `STACKS_SECRET_ENV_LITERAL` refuses secret environment literals. `STACKS_PORT_PUBLISHED` confines published ports to the ingress and `STACKS_SECOND_INGRESS` refuses a second ingress. `STACKS_DNS_UNDECLARED`, `STACKS_HOST_UNROUTED` and `STACKS_TLS_UNDECLARED` require DNS ownership, host routes and TLS evidence. `STACKS_PLACEMENT_MISSING`, `STACKS_HEALTHCHECK_MISSING` and `STACKS_UPDATE_POLICY_MISSING` require stateful placement, real healthchecks and update, rollback and restart policies. `STACKS_REALTIME_SCALED` confines a lite realtime API to one replica.
- R267 `STACKS_RELEASE_BACKUP`: declare immutable releases and backup ownership, target, retention and restore proof, and supply the rendered model (`STACKS_RELEASE_UNDECLARED`, `BACKUP_UNDECLARED`, `BACKUP_PROOF_MISSING`, `STACKS_MODEL_UNAVAILABLE`).
- R268 `HFS_SCHEDULE_DECLARED`: declare each app scheduler, pg_cron tick or replicated-job schedule with its app-owned command (`HFS_SCHEDULE_UNDECLARED`).
- R269 `HFS_SUPPLY_CHAIN`: require Dependabot, a production dependency audit step and an image SBOM (`HFS_DEPENDABOT_MISSING`, `HFS_AUDIT_STEP_MISSING`, `HFS_SBOM_MISSING`).
- R271 `HFS_RELEASE_PROVENANCE`: bind the release tag to the package version and image tags, and guard database deployment to that release (`HFS_RELEASE_TAG_MISMATCH`, `HFS_DB_DEPLOY_UNGUARDED`).
- R275 `STACKS_INGRESS_DECLARED`: `STACKS_INGRESS_UNDECLARED` requires one declared ingress and its hosts; `STACKS_INGRESS_UNKNOWN` refuses an unknown component, wrong role or unsupported image. Both digest-pinned Traefik and Caddy are accepted.
- R276 `STACKS_LITE_BACKING`: `STACKS_LITE_SELFHOSTED_DB` refuses self-hosted backing databases in lite; `STACKS_SIDECAR_VOLUME_UNDECLARED` requires a declared and mounted persistent volume for a SQLite sidecar; `STACKS_SIDECAR_DB_UNSUPPORTED` refuses a sidecar's non-SQLite database requirement. Full keeps its declared backing topology.

## Reference pattern

The `examples/ecommerce-app/.starcistacks` kit demonstrates the full manifest, distinct dev and VPS runtimes, secret custody, and static checker input. `examples/lite-app` demonstrates a lite production Swarm environment with Supabase as managed backing. Application-specific readiness and audit evidence belongs in that application's reports.

## Primary references

Read 2026-09-15:

- https://docs.docker.com/compose/
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
- [Nest configuration](https://docs.nestjs.com/techniques/configuration) — startup schema validation and explicit unknown/error options
- [Nest health checks](https://docs.nestjs.com/recipes/terminus) — optional readiness/liveness adapters
- [Next environment variables](https://nextjs.org/docs/pages/guides/environment-variables) — server-only vs build-inlined `NEXT_PUBLIC_*` values
- [Next instrumentation](https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation) — `register` as server-instance initialization
- [Kubernetes probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/) — the startup/liveness/readiness distinction applies to every placement

### Where a secret may live

The runtime repository is public and tracks no secret, not even ciphertext (`RT_SECRET_TRACKED`). Every secret the host needs lives in the one untracked `.claude/secret.env`, read only through `engine/secrets.mjs` (`secret.env.example` lists the names). A product repository keeps its own custody in its own repository. Two Sonar servers, no overlap: **SonarCloud** serves everything that lives in the runtime repository (the runtime and the three example apps, one `SONAR_TOKEN`, the organization from `config.yaml` `sonar.organization` or the env `SONAR_ORGANIZATION`, project key `<organization>_<declared key>`); the **self-hosted `ext/sonar`** serves product repositories only, and its secrets are `secret.env` variables that `starci gate sonar up` passes to Compose (`docs/host-secrets.md`). An example declares `provider: sonarcloud`, `mode: hosted`, `host.public: https://sonarcloud.io`, `auth: token` and `runtimeSecrets`; a product declares the host stack and its custody as above.
