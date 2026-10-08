# ext/sonar — the shared local SonarQube (host extension)

One SonarQube Community Build (with a dedicated PostgreSQL) serves every StarCi PRODUCT repository on this
host; everything that lives in the runtime repository (the runtime itself and the example apps under `examples/`) is analysed on SonarCloud with the one `SONAR_TOKEN` of `secret.env` (docs/releasing.md, docs/application-stacks.md). It is a host extension, not part of any product's `.starcistacks`: product repositories only
*declare* it, via their `services.sonar.stack` block pointing at `owner: host` /
`root: .claude/ext/sonar` (see `modules/schemas/application-stacks.schema.yaml` and
`docs/application-stacks.md`).

Files: `compose.yaml` (SonarQube + its Postgres + the one-shot admin-password bootstrap) and
`cloudflared.yaml` (the Cloudflare tunnel that publishes it publicly, profile `public`). The directory holds **no secret and no
custody**: the public runtime repository tracks none (`RT_SECRET_TRACKED`, empty allowance), and the Compose files read their secrets
from the environment of the process that runs them.

Fixed identity, so the running container keeps
working: Compose project `starci`, containers `starci-sonarqube`, `starci-sonarqube-postgres`,
`starci-sonarqube-bootstrap`, `starci-cloudflared-sonarqube`, named volumes `starci-sonarqube-*`,
published port `${STARCI_PORT_SONARQUBE}` → container `9000` (this host's published port is the one
`scripts/gates/sonar-local.mjs` states once as `DEFAULT_HOST`, served locally at that host and published as
`https://sonar.starci.org`; the verb below derives the variable from it).

## Secrets: the owner's `secret.env`

The stack's secrets are variables of the one untracked `.claude/secret.env` (`secret.env.example` lists each with what it is for),
read only through `engine/secrets.mjs`:

| Variable | Used by |
| --- | --- |
| `SONARQUBE_DB_PASSWORD` | the Postgres of the stack and the SonarQube JDBC login (`compose.yaml`) |
| `SONARQUBE_ADMIN_PASSWORD` | the one-shot bootstrap that replaces SonarQube's default admin password (`compose.yaml`) |
| `CLOUDFLARE_TUNNEL_TOKEN` | the public tunnel (`cloudflared.yaml`, only with `--public`) |
| `SONARQUBE_ADMIN_TOKEN` | `scripts/gates/sonar-local.mjs`: `status`, `ensure-project` and `scan --isolate` provision product projects with it |

The per-PRODUCT analysis tokens that `ensure-project --with-token` mints stay sealed in the product's own custody, and there is no
server-wide analysis token of the extension. A missing variable is a typed refusal that names it (`sonar-host-secret-missing`); the verb
below never starts a container without the ones it needs.

## Start / stop

```
starci gate sonar up              # local SonarQube (compose.yaml)
starci gate sonar up --public     # + the public tunnel (cloudflared.yaml, profile public)
starci gate sonar stop [--public] # stop the containers; the data is kept
```

`up` builds the child environment from `secret.env` (plus `STARCI_PORT_SONARQUBE` from the declared host), hands it to
`docker compose up -d` and prints a report with the file names and the outcome only: a value is never on argv, in a file or in the
report. A container's environment is readable by whoever can `docker inspect` it on this host. Never `down -v`: the named volumes hold
the server data and projects.

## Moving off the old sealed members

The previous layout tracked five sealed members in `secrets/`. They are deleted from the tree; their ciphertext stays in git history,
encrypted to the owner's age key, so rotate the stack's admin password, admin token and tunnel token after the move. Once per member:
`starci runtime import-held-secret --member <old path>` decrypts it with the owner's own identity from git history and appends
`NAME=value` to `secret.env` without printing it, refusing to overwrite an existing name (docs/host-secrets.md has the table).

## The quality gate

The server gate every project is selected onto is `starci-quality`; its conditions (new-code coverage, duplication, blocker/critical issues, reviewed hotspots, and on the whole code the coverage, the open-issue count, the reviewed hotspots and duplicated-lines density, which hold every imported HFS, ESLint and stylelint finding at zero; coverage is the services' alone, every other file in `sonar.coverage.exclusions`, over the be unit run's lcov) are written once, in `knowledge/sonar-gate.yaml`, and `sonar-local.mjs scan` makes the server match that file on every run (a hand edit is put back). A product repository only names the gate in its `.starcistacks` declaration. Code-writing ops are judged on the lines they changed against the same numbers (and every service they touched at 100 coverage, measured by a unit run over those services before the scan) and cannot settle done while the gate is red; `sonar-local.mjs dashboard --cwd <app>` prints a project's dashboard numbers (bugs, code smells, vulnerabilities, hotspots reviewed, coverage and the coverage of every service) and fails unless all are at the gate; when this server is down the op records the `sonar-unavailable` why and the Supervisor gets a runtime incident - bring the stack up (`docker compose ... up -d`, above) and the op is re-run.

## Who uses it

Every product repository scans here (local ops through `scripts/gates/sonar-local.mjs`, GitHub CI
through the public host): starci-academy-backend, starci-academy-fe, nivo-backend, nivo-fe,
starci-next, starci-next-fe, mia-mia-backend, miamia-fe, tedo-landing — the set is each repository's
`services.sonar.projects` entry, listed in the host declaration
(`tests/fixtures/starcistacks-services/starci-academy-backend.application-stacks.yaml`). A product's own
per-project analysis token stays in **its** custody
(`.starcistacks/dev/runtime/files/sonarqube-<key>-token.key.enc`, written through that repository's stack-secret tool), never in this extension. The example apps under `examples/` do not use this server and have no member here.

## Before merge: the local rule check, not this server

This server is the heavy path (Docker, a scanner run, an analysis token). The rules SonarCloud flagged on this runtime are also
enforced without any server, in seconds, by the `sonar-rules` self-check (`starci runtime check --only sonar-rules`; rule table in
`scripts/gates/sonar-rules-table.mjs`, scope read from `sonar-project.properties`), which `npm run check`, the Supervisor's land
gate and the pre-commit hook run. SonarCloud stays the final measurement; `tests/gates/sonar-local.spec.mjs` is hermetic (in-process
fake servers, no Docker) and never needs this server.
