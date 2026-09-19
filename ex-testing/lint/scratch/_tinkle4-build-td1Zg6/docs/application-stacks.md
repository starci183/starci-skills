# Application stacks

An application stack is the complete deployment description for one application: frontend, APIs, workers, jobs, datastores, ingress, and every required external dependency. A directory or service count does not prove that the application can run. See [Application runtime configuration and health](application-runtime-config-and-health.md) for the source-to-startup contract shared by host, container and remote placements.

The canonical manifest is `.starcistacks/application-stacks.yaml`, schema `starci/application-stacks`. `schemas/stacks-layout.yaml` governs the TREE this manifest lives inside (which directories exist, which files are required, which are refused); `schemas/application-stacks.schema.yaml` is the machine form of the manifest's own CONTENT, and is a strict subset: every field it requires is a field the layout's authored kit actually uses, and nothing the layout does not name is required. A manifest that still carries the legacy `starci/application-stacks@1` id is accepted and named rather than silently passed or rejected (`STACKS_SCHEMA_LEGACY_ID`); drop the suffix. Development uses Docker Compose. An Ubuntu VPS uses Docker Swarm and `docker stack`. Whole-package Kubernetes deployment is explicitly `deferred` or `supported` with a reason, and its posture must match whether `.starcistacks/k8s/` actually exists.

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

`runbook` names a file; the checker resolves and reads it. That file's Markdown table must document exactly the same seven commands `schemas/stacks-layout.yaml` promises - `prepare`, `doctor`, `up`, `status`, `logs`, `down`, `verification` - as one row each (`runbook-command-missing` names whichever row is absent). This holds for every environment, VPS included: there is no separate VPS-only command set. The commands are declared and legible; the checker does not execute them.

## Secret custody

A secret is `{name, where, recipientPolicy, keyCustody}`. `where` is one relative path inside the environment directory; the checker requires `<where>.enc` to exist as a regular, non-symlink, recognizable SOPS envelope (either the YAML/JSON `sops:` object or the flattened dotenv envelope SOPS emits for a `.env` member), and requires the plaintext member `<where>` - if it exists at all - to sit below the environment directory with no symlink ancestor. `recipientPolicy` and `keyCustody` are required prose, not machine-checked custody, but their absence is still refused.

`.starcistacks/**/*.key`, `*.pem`, `*.p12`, `*.pfx`, and `id_rsa` are refused as tracked files (`STACKS_PLAINTEXT_SECRET`); only `<name>.enc` may be committed. The checker asks `git ls-files` to tell tracked apart from merely-present-on-this-machine; when it cannot reach a repository (a disposable fixture, a relocated payload with no `.git`) it skips this one check rather than assuming either answer.

## Directory shape

These are read-only structural findings shared with `schemas/stacks-layout.yaml`, independent of manifest content:

- `STACKS_LEGACY_DIRECTORY` - a `.stacks` directory exists and `.starcistacks` does not.
- `STACKS_UNDECLARED_ENVIRONMENT` - a directory under `.starcistacks` (other than `k8s`) is not one of the declaration's environment names.
- `environment-directory-missing` - a declared environment has no directory.
- `STACKS_SCRATCH_IN_CANONICAL` - `.starcistacks/tmp` exists; scratch belongs in the OS temp directory.
- `k8s-directory-missing` / `k8s-directory-unexpected` - `.starcistacks/k8s` and `k8s.status` disagree.
- `STACKS_UNDECLARED_COMPOSE` - a Compose-shaped YAML file (one with a `services` or `include` key) sits under an environment's `infra/` tree without being declared in `composeFiles` or reachable through an `include:` chain from a declared file. A non-Compose YAML file in the same tree, such as a Prometheus scrape config, is not a compose file and is not flagged merely for its extension.

## Checker coverage and acceptance evidence

The static checker validates manifest shape against the machine schema, the tree shape above, environment-relative Compose path safety, component-id/service-name correspondence, runbook file existence and command completeness, secret custody (SOPS envelope, plaintext-path safety, tracked-plaintext refusal, required policy prose), unresolved rendered-Compose interpolation, plaintext sensitive environment values in the rendered model, and - for a Swarm environment - a nonempty rendered image with no leftover `build` section on every managed service.

It does not invoke Docker or host processes, execute a runbook, authenticate the rendered model's provenance, decrypt SOPS, or independently discover component-to-service placement. A rendered Compose or Swarm model is supplied by the caller and checked for consistency with the declaration, not proven live. Tracked-plaintext detection is a best-effort `git ls-files` query, not a cryptographic or content-based leak scan.

## Reference pattern

The `examples/todo-app-backend/.starcistacks` kit demonstrates the manifest, distinct dev and VPS runtimes, secret custody, and static checker input without making production-readiness claims. Application-specific audit evidence belongs in that application's reports.

## Primary references

Read 2026-09-15:

- https://docs.docker.com/compose/
- https://docs.docker.com/reference/cli/docker/stack/
- https://docs.docker.com/reference/cli/docker/stack/deploy/
- https://docs.docker.com/engine/swarm/secrets/
- https://docs.docker.com/engine/swarm/swarm_manager_locking/
- https://docs.docker.com/engine/swarm/services/
