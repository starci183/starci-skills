# Application stacks

An application stack is the complete deployment description for one application: frontend, APIs, workers, jobs, datastores, ingress, and every required external dependency. A directory or service count does not prove that the application can run. See [Application runtime configuration and health](application-runtime-config-and-health.md) for the source-to-startup contract shared by host, container and remote placements.

The canonical manifest is `.starcistacks/application-stacks.yaml`, schema `starci/application-stacks@1`. `modules/schemas/stacks-layout.yaml` governs the TREE this manifest lives inside (which directories exist, which files are required, which are refused); `modules/schemas/application-stacks.schema.yaml` is the machine form of the manifest's own CONTENT, and is a strict subset: every field it requires is a field the layout's authored kit actually uses, and nothing the layout does not name is required. Development uses Docker Compose. An Ubuntu VPS uses Docker Swarm and `docker stack`. Whole-package Kubernetes deployment is explicitly `deferred` or `supported` with a reason, and its posture must match whether `.starcistacks/k8s/` actually exists.

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

A secret is `{name, where, recipientPolicy, keyCustody}`. `where` is one relative path inside the environment directory; the checker requires `<where>.enc` to exist as a regular, non-symlink, recognizable SOPS envelope (either the YAML/JSON `sops:` object or the flattened dotenv envelope SOPS emits for a `.env` member), and requires the plaintext member `<where>` - if it exists at all - to sit below the environment directory with no symlink ancestor. There is ONE shared master age identity (`~/.starci/master.identity`): every project's SOPS envelopes are encrypted to the one shared master recipient and that identity decrypts every project's custody, so `recipientPolicy` states that recipient and never a per-project or per-stack one, and `keyCustody` states that the identity stays outside Git and is backed up by the owner machine. `recipientPolicy` and `keyCustody` are required prose, not machine-checked custody, but their absence is still refused.

`.starcistacks/**/*.key`, `*.pem`, `*.p12`, `*.pfx`, and `id_rsa` are refused as tracked files (`STACKS_PLAINTEXT_SECRET`); only `<name>.enc` may be committed. The checker asks `git ls-files` to tell tracked apart from merely-present-on-this-machine; when it cannot reach a repository (a disposable fixture, a relocated payload with no `.git`) it skips this one check rather than assuming either answer.

A sealed identity or resource secret is one file, `be/.starcistacks/<env>/secrets/<identity-or-resource-slug>.enc` (sops age); the Work tree keeps only the identity/resource record whose `custody.sealed` names that path app-relative, never a sealed file or a plaintext value (`SEALED_CUSTODY_LOCATION`, `SEALED_FILE_IN_WORK`). Other custody members are named `<name>.<fmt>.enc` (fmt inside, `.enc` last), for example `app.env.enc`, `admin.key.enc`; a name such as `secrets.enc.yaml` is refused (`STACKS_PLAINTEXT_TRACKED`, with a rename hint). sops takes the format of a `.enc` name to be binary, so every read states the input type (`sops decrypt --input-type yaml|json|dotenv`), and `sops exec-env` cannot read such a file because it has no `--input-type` flag. Use the runtime helper `node <Source>/.claude/scripts/lib/sops-exec-env.mjs <file>.<fmt>.enc '<command>'` (or `--get NAME`, `--keys` for names only): it decrypts in memory with the stated format, runs the command with the keys in its environment and writes no plaintext. A `<slug>.enc` states its format: `--input-type yaml`.

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
| `qualityGate` | sonar only: `starci-new-code`, the one gate whose thresholds live in `knowledge/sonar-gate.yaml` (any other value is `STACKS_QUALITY_GATE_DRIFT`); `sonar-local` makes the server gate of that name carry them and `api settle` holds `backend.implement`, `interface.implement` and `code.refactor` to it |
| `credentials` | `[{id, env or key, custody: {repository, path}}]` - custody references, never values; `<path>.enc` must exist |
| `ci` | `wiring` required / optional-follow-up / not-used, `secrets [{name, credential}]`, `vars [{name, value}]`, `permissions`, `provisioning` |
| `ownerAction` | `none` unless the owner alone can give something (`{needed, reason}`); `none` is mandatory while custody holds every credential |

`scripts/checks/check-starcistacks.mjs <repo> [--new] [--admitted-at <t>]` (op check `starci-starcistacks-check`, contract change `starcistacks-services`) refuses an unknown or ambiguous entry, missing custody, a redundant owner action, CI calling a disabled or undeclared service, and project-key drift; a missing declaration or services block in an existing repository is a suspect with a planned follow-up (`workspace.manage` mode `stacks`, fixtures in `examples/starcistacks-services/`). `starci validate` reports the same findings as suspects. `api report` refuses an ask for a credential or CI setting a declaration marks `ownerAction: none` with its custody present (`ask-declared-in-stack`). `resolveStackService(repo, id)` is the reader tools such as `scripts/checks/sonar-local.mjs` use; a repository without its own entry falls back to the source host's entry when that lists it among its projects.

`.starcistacks` is the only stack root *a repository owns*. A service shared by every routed project instead declares `stack.owner: host` and `stack.root: .claude/ext/<service>` — the extension ships inside the installed runtime tree, so no repository is named and the checker resolves `<root>/<compose>` under the runtime root itself (`environment` stays a required slot label, not a path segment). The shared local SonarQube is the first such extension (`.claude/ext/sonar`, Compose project `starci`, container `starci-sonarqube`; see `ext/sonar/README.md`); a product never copies its Compose files into its own `.starcistacks`. A service credential may likewise cite custody inside the extension (`{repository: <source host>, path: .claude/ext/<service>/secrets/...}`), while each project's own analysis token stays in that project's `.starcistacks` custody. Custody layout otherwise follows `modules/schemas/stacks-layout.yaml` `custody` (runtime/files members with tracked `.enc` twins, KEYS.md rosters, a `<root>/**` deny-all ignore rule with re-includes).

## Checker coverage and acceptance evidence

The static checker validates manifest shape against the machine schema, the tree shape above, environment-relative Compose path safety, component-id/service-name correspondence, runbook file existence and command completeness, secret custody (SOPS envelope, plaintext-path safety, tracked-plaintext refusal, required policy prose), unresolved rendered-Compose interpolation, plaintext sensitive environment values in the rendered model, and - for a Swarm environment - a nonempty rendered image with no leftover `build` section on every managed service.

It does not invoke Docker or host processes, execute a runbook, authenticate the rendered model's provenance, decrypt SOPS, or independently discover component-to-service placement. A rendered Compose or Swarm model is supplied by the caller and checked for consistency with the declaration, not proven live. Tracked-plaintext detection is a best-effort `git ls-files` query, not a cryptographic or content-based leak scan.

## Reference pattern

The `examples/todo-app/be/.starcistacks` kit demonstrates the manifest, distinct dev and VPS runtimes, secret custody, and static checker input without making production-readiness claims. Application-specific audit evidence belongs in that application's reports.

## Primary references

Read 2026-09-15:

- https://docs.docker.com/compose/
- https://docs.docker.com/reference/cli/docker/stack/
- https://docs.docker.com/reference/cli/docker/stack/deploy/
- https://docs.docker.com/engine/swarm/secrets/
- https://docs.docker.com/engine/swarm/swarm_manager_locking/
- https://docs.docker.com/engine/swarm/services/
