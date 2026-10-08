Owner: knowledge/application-stacks.yaml
# Application stacks

An application stack is the complete deployment description for one application: frontend, APIs, workers, jobs, datastores, ingress, and every required external dependency. A directory or service count does not prove that the application can run.

The canonical manifest is `.starcistacks/application-stacks.yaml`, schema `starci/application-stacks@1`. `modules/schemas/stacks-layout.yaml` governs the TREE this manifest lives inside (which directories exist, which files are required, which are refused); `modules/schemas/application-stacks.schema.yaml` is the machine form of the manifest's own CONTENT, and is a strict subset: every field it requires is a field the layout's authored kit actually uses, and nothing the layout does not name is required. `knowledge/application-stacks.yaml` owns the deployment requirements (STACK-*) the manifest and this document explain. Development uses Docker Compose. An Ubuntu VPS uses Docker Swarm stacks. Whole-package Kubernetes deployment is explicitly `deferred` or `supported` with a reason, and its posture must match whether `.starcistacks/k8s/` actually exists.

## Manifest shape

`components` is a map from component id to `{role, image?, compose?, purpose?, required?}`. `role` is a free-text classification (`stateful`, `service`, `observability`, and so on are all in use); `image` and `compose` are descriptive cross-references to the environment's own Compose fragments, not a rendering instruction. `sources` is an optional list of `{repository}` entries naming the application repositories this stack deploys, with no further binding - the manifest is a static declaration, not a build pipeline.

`environments` is a map from environment name to:

- `status: supported`, `runtime: docker-compose | docker-swarm`;
- `composeFiles`, an array of paths relative to that environment's own directory (`.starcistacks/<env>/...`), never prefixed with `.starcistacks` again;
- `components`, a map from component id to a free-form override object (a Compose `port`, a Swarm `replicas` count, or nothing at all); a component absent from one environment's map is simply not run there - there is no separate `ownership` vocabulary to keep in sync with that absence;
- `runbook`, a path (again environment-relative, typically `README.md`) to the file a human and the checker both read for the environment's lifecycle commands;
- `secrets`, an array of `{name, where, recipientPolicy, keyCustody}`.

Every catalog component id that appears as a rendered Compose or Swarm service name must be a declared id (`compose-service-unclassified` otherwise); the reverse is not required, because a component such as a profile-gated placeholder image can legitimately run as a host process instead and never appear in the rendered model at all.

## The runbook lives in a file, not the manifest

`runbook` names a file; the checker resolves and reads it. That file's Markdown table must document exactly the same seven commands `modules/schemas/stacks-layout.yaml` promises - `prepare`, `doctor`, `up`, `status`, `logs`, `down`, `verification` - as one row each (`runbook-command-missing` names whichever row is absent). This holds for every environment, VPS included: there is no separate VPS-only command set. The commands are declared and legible; the checker does not execute them.

## Secret custody

A secret is `{name, where, recipientPolicy, keyCustody}`. `where` is one relative path inside the environment directory; the checker requires `<where>.enc` to exist as a regular, non-symlink, recognizable SOPS envelope (either the YAML/JSON `sops:` object or the flattened dotenv envelope SOPS emits for a `.env` member), and requires the plaintext member `<where>` - if it exists at all - to sit below the environment directory with no symlink ancestor. The shared age recipient is declared by `recipientPolicy`; host identity custody and its execution prerequisites follow [host credentials](host-secrets.md), so `keyCustody` cites that host custody rather than a per-project identity. `recipientPolicy` and `keyCustody` are required prose, not machine-checked custody, but their absence is still refused.

`.starcistacks/**/*.key`, `*.pem`, `*.p12`, `*.pfx`, and `id_rsa` are refused as tracked files (`STACKS_PLAINTEXT_SECRET`); only `<name>.enc` may be committed. The checker asks `git ls-files` to tell tracked apart from merely-present-on-this-machine; when it cannot reach a repository (a disposable fixture, a relocated payload with no `.git`) it skips this one check rather than assuming either answer.

A sealed identity or resource secret is one file, `.starcistacks/<env>/secrets/<identity-or-resource-slug>.enc` (sops age); the Work tree keeps only the identity/resource record whose `custody.sealed` names that path app-relative, never a sealed file or a plaintext value (`SEALED_CUSTODY_LOCATION`, `SEALED_FILE_IN_WORK`). Other custody members are named `<name>.<fmt>.enc` (fmt inside, `.enc` last), for example `app.env.enc`, `admin.key.enc`; a name such as `secrets.enc.yaml` is refused (`STACKS_PLAINTEXT_TRACKED`, with a rename hint). sops takes the format of a `.enc` name to be binary, so every read states the input type (`sops decrypt --input-type yaml|json|dotenv`), and `sops exec-env` cannot read such a file because it has no `--input-type` flag. Use the runtime helper `node <Source>/.claude/scripts/gates/custody-exec.mjs <file>.<fmt>.enc '<command>'` (or `--get NAME`, `--keys` for names only): it decrypts in memory with the stated format, runs the command with the keys in its environment and writes no plaintext. A `<slug>.enc` states its format: `--input-type yaml`.

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

`.starcistacks` is the only stack root *a repository owns*. A service shared by every routed project instead declares `stack.owner: host` and `stack.root: .claude/ext/<service>` — the extension ships inside the installed runtime tree, so no repository is named and the checker resolves `<root>/<compose>` under the runtime root itself (`environment` stays a required slot label, not a path segment). The shared local SonarQube is the first such extension (`.claude/ext/sonar`, Compose project `starci`, container `starci-sonarqube`; see `ext/sonar/README.md`); a product never copies its Compose files into its own `.starcistacks`. The extension holds no custody and no secret: its secrets are variables of the owner's untracked `secret.env` that `starci gate sonar up` passes to Compose and `sonar-local.mjs` reads by name (`SONARQUBE_ADMIN_TOKEN`), so a declared credential citing a path inside the extension is not read (a product declaration should drop it), while each project's own analysis token stays in that project's `.starcistacks` custody. Custody layout otherwise follows `modules/schemas/stacks-layout.yaml` `custody` (runtime/files members with tracked `.enc` twins, KEYS.md rosters, a `<root>/**` deny-all ignore rule with re-includes).

## Docker Swarm on a VPS

A VPS environment declares `runtime: docker-swarm`. A single VPS is a one-manager swarm: it provides orchestration but no manager failover — running tasks may survive a manager loss, management requires recovery or a replacement cluster. Additional nodes may improve capacity or availability; manager quorum and data placement must then be designed explicitly, and a multi-manager runbook preserves quorum and records node identities and roles. Kubernetes remains deferred. Terraform or a cloud API may provision machines or DNS, but neither owns the runtime topology.

- **Platforms need a verified matrix.** The candidate matrix is Ubuntu Server 22.04 LTS amd64, 24.04 LTS amd64 and 24.04 LTS arm64; each stays a candidate until its cold-host suite passes with every application image. Docker or Ubuntu support never proves application support. The manifest encodes `platform.ubuntu` and `platform.architectures`; the `prepare`/`doctor` runbooks check Docker version bounds, CPU, RAM, disk, inodes, filesystem, ports, time, DNS, backup headroom, Swarm state, manager identity, quorum and placement.
- **Preparation is provider-neutral and non-destructive.** It verifies the OS, architecture, cgroups, capacity, clock, DNS, ports, SSH trust, Docker Engine, registry access and current Swarm membership before any effect; creating a swarm, joining a node or changing autolock is an explicit effect with its own custody and recovery. Production uses Docker's signed Ubuntu apt repository; SSH host identity is pinned, first contact is owner-verified, and changed host keys, passwords in argv, disabled host-key checking and broad root login are refused.
- **Releases are immutable.** A release carries the rendered stack bytes, source digest, immutable image digests per architecture, non-secret config digest, versioned secret names, migration and backup plans, health assertions and the previous accepted release; images are built and proved with `starci release images`, then pushed by the owner-approved release flow before the Swarm deployment step, which never builds. The rendered Swarm configuration is the review model; Compose-local conveniences are not assumed portable to Swarm. Files land in `/srv/<app>/releases/<release-digest>/` behind a stable pointer that moves only after verification; the prior release stays available for bounded rollback.
- **Only declared ingress publishes public ports.** DNS is an external prerequisite with an owner and a receipt; ingress obtains and persists its certificate before exposing routes after upstream readiness. Swarm control-plane traffic is mutually authenticated; application traffic on overlay networks is not assumed encrypted without an explicit, tested policy. Stateful services declare placement constraints — a replicated task does not make a single-host volume highly available.
- **Convergence is observed, not declared.** A Swarm deployment request returns before application correctness; acceptance polls desired versus running replicas, rejects failed or restarting tasks, inspects update state, then runs application assertions. Migration and bootstrap jobs need an application-owned completion protocol and an immutable receipt — a finished task or a healthy port alone does not prove a business effect.
- **Rollback cannot undo data effects.** `docker service update --rollback` or a stack redeploy restores a service specification; it cannot revert a schema change or recreate a removed secret. Application rollback selects a previous accepted release and verifies schema compatibility; a data restore is a separate, higher-impact action with an explicit loss window and activation authority.
- **Secrets are versioned and never embedded.** Each VPS secret maps a stable logical `name` to an immutable versioned `runtimeName`; the rendered stack keeps `{external: true, name: <runtimeName>}` and never a file or value. Rotation creates a new versioned name, updates the grant, waits for convergence, then removes the earlier secret — a name is never reused and an earlier version is never deleted before convergence. Swarm secrets are encrypted in transit and in Raft, which does not remove the need to protect manager access, backups and (when enabled) the autolock unlock key.
- **Migrations and backups bind evidence first.** A migration binds the release, the current schema fingerprint, the pending set and a verified backup under the application's exclusion lock, and prefers expand/contract. Application backups are encrypted, hashed, versioned and stored outside the VPS failure domain; acceptance requires an isolated restore with semantic assertions. Swarm-state backup preserves orchestration state and keys — it is not a database backup.

Acceptance per declared OS/architecture needs disposable cold-host evidence of: signed Docker installation and idempotent preparation; new- or existing-swarm reconciliation without destructive reinitialization; rejection of unsupported platform, image, capacity, placement and quorum; complete image build/publish closure before deploy; rendered Swarm configuration review; convergence plus application health; restart with stable services, secrets and data; secret rotation without disclosure; compatible migration with readiness held closed on failure; update failure and rollback handling; encrypted off-host backup with isolated restore; swarm-state backup and autolock recovery; first TLS issuance and renewal with only declared public ports; interrupted-operation reconciliation; and non-destructive removal with application rollback boundaries. A single-manager test never certifies manager failover, and an amd64 pass never certifies arm64.

## Runtime configuration and health

Configuration and health belong to the component that consumes them. Each runnable component identifies its repository role, immutable revision, package root, entry command or image, and the files that define its configuration and startup — a monorepo path and a split-repository root share the model.

- **One typed configuration boundary per runnable package.** It maps environment keys and file-backed secrets into application values, rejects unknown or malformed critical values, and finishes validation before listeners, migrations, consumers, schedulers or outbound clients begin effects. Defaults exist only for values safe in the declared environment; credentials, tenant identity, public origins, datastore authority and remote endpoints get no production-looking placeholders. Environment templates list names, purpose, format and applicability without values; secret values stay in the declared custody path; startup errors name the field and rule while redacting the value.
- **One observable startup sequence:** load source identity → materialize custody → parse configuration → validate mode and dependencies → migrate/bootstrap under authority → start listeners/workers → expose readiness → verify behavior.
- **Four health signals with different jobs:** startup (initialization in progress or failed), liveness (the process can keep making progress — process-local, so a provider outage never causes restart churn), readiness (this instance may receive its declared work — required dependencies and compatibility), functional verification (a named caller journey works). Components classify dependencies as required, degraded or optional by behavior, not by vendor; probes are bounded and never mutate business data; readiness never replaces migration evidence, authenticated verification or rollout observation.
- **Placement changes addresses, not responsibility.** A host process binds an exact package script, a private generated env file, loopback ports and host-reachable endpoints; a container binds exact source/build inputs or an immutable image, service-DNS connections and a published readiness or container healthcheck; a remote application API binds an external owner and failure domain, an endpoint configuration reference, caller auth and timeout, and caller-bound verification — hosted on Kubernetes or not, it is an application API to its caller, not the cluster ([remote application API](remote-application-api.md)).
- **Static binding proves drift, not life.** Conformance binds source revisions, package/config files, images, endpoint names, custody names and verification entry points and reports missing or drifting inputs before effects; it never authenticates history, reads secret values or proves a rollout. Live evidence records the selected profile, source and image identities, the rendered configuration digest (secrets excluded), migration/bootstrap results, health observations and named functional checks; a source or config change invalidates only the affected component's proof.

## Checker coverage and acceptance evidence

The static checker validates manifest shape against the machine schema, the tree shape above, environment-relative Compose path safety, component-id/service-name correspondence, runbook file existence and command completeness, secret custody (SOPS envelope, plaintext-path safety, tracked-plaintext refusal, required policy prose), unresolved rendered-Compose interpolation, plaintext sensitive environment values in the rendered model, and - for a Swarm environment - a nonempty rendered image with no leftover `build` section on every managed service. For a Swarm environment the caller supplies the rendered Swarm configuration: `checkApplicationStacks({repoRoot, environment: 'vps', deploymentModelFile})` in `scripts/gates/stacks-gate.mjs`.

It does not invoke Docker or host processes, execute a runbook, authenticate the rendered model's provenance, decrypt SOPS, inspect registry manifests, or independently discover component-to-service placement. A rendered Compose or Swarm model is checked for consistency with the declaration, not proven live — convergence, migration, backup, restore, autolock recovery, TLS and rollback behavior are the application's own evidence. Tracked-plaintext detection is a best-effort `git ls-files` query, not a cryptographic or content-based leak scan.

## Reference pattern

The `examples/ecommerce-app/.starcistacks` kit demonstrates the manifest, distinct dev and VPS runtimes, secret custody, and static checker input without making production-readiness claims. Application-specific audit evidence belongs in that application's reports.

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
