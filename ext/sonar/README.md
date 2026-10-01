# ext/sonar — the shared local SonarQube (host extension)

One SonarQube Community Build (with a dedicated PostgreSQL) serves **every** StarCi product on this
host. It is a host extension, not part of any product's `.starcistacks`: product repositories only
*declare* it, via their `services.sonar.stack` block pointing at `owner: host` /
`root: .claude/ext/sonar` (see `modules/schemas/application-stacks.schema.yaml` and
`docs/application-stacks.md`).

Files: `compose.yaml` (SonarQube + its Postgres + the one-shot admin-password bootstrap),
`cloudflared.yaml` (the Cloudflare tunnel that publishes it publicly, profile `public`), `secrets/`
(SOPS `*.enc` custody — ciphertext only, see `secrets/KEYS.md`).

Identity preserved from the legacy `<source>/.stacks` stack, so the already-running container keeps
working: Compose project `starci`, containers `starci-sonarqube`, `starci-sonarqube-postgres`,
`starci-sonarqube-bootstrap`, `starci-cloudflared-sonarqube`, named volumes `starci-sonarqube-*`,
published port `${STARCI_PORT_SONARQUBE}` → container `9000` (this host: `9010`, serving
`http://localhost:9010`, published as `https://sonar.starci.org`).

## One-time materialization (owner, per host)

The stack needs two untracked files beside `compose.yaml`; both are gitignored:

1. Decrypt the custody twins the stack consumes:

   ```
   sops -d secrets/sonarqube-db-password.txt.enc  > secrets/sonarqube-db-password.txt
   sops -d secrets/sonarqube-admin-password.txt.enc > secrets/sonarqube-admin-password.txt
   sops -d secrets/cloudflare-starci-local-services-tunnel-token.key.enc \
        > secrets/cloudflare-starci-local-services-tunnel-token.key   # only for the public profile
   ```

   They decrypt with the source stack identity (`~/.starci/master.identity`, age recipient
   `age1myd77xz5lhsluc4ejzztsck32pfq3vfpzrva8cegzydk2guhxqesgm3z4j`). If a `.enc` twin is missing on a
   fresh host, see `secrets/KEYS.md` — the owner re-mints and re-encrypts it.

2. Create `.env` next to `compose.yaml`:

   ```
   STARCI_PORT_SONARQUBE=9010          # this host's published SonarQube port (metadata.json port map)
   SONARQUBE_DB_PASSWORD=<contents of secrets/sonarqube-db-password.txt>
   # STARCI_CONTAINER_PREFIX=starci-   # optional; must stay starci- in steady state
   ```

## Start / stop

```
cd .claude/ext/sonar
docker compose -f compose.yaml up -d                                  # local SonarQube
docker compose -f compose.yaml -f cloudflared.yaml --profile public up -d   # + public tunnel
docker compose -f compose.yaml -f cloudflared.yaml --profile public down    # stop (data kept)
```

Never `down -v`: the named volumes hold the server data and projects. Do not call Docker before the
two files above exist — `sonarqube-bootstrap` and the tunnel mount them read-only.

## The quality gate

The server gate every project is selected onto is `starci-new-code`; its conditions (new-code coverage, duplication, blocker/critical issues, reviewed hotspots, and on the whole code the coverage, the open-issue count, the reviewed hotspots and duplicated-lines density, which hold every imported HFS, ESLint and stylelint finding at zero; coverage is the services' alone, every other file in `sonar.coverage.exclusions`, over the be unit run's lcov) are written once, in `knowledge/sonar-gate.yaml`, and `sonar-local.mjs scan` makes the server match that file on every run (a hand edit is put back). A product repository only names the gate in its `.starcistacks` declaration. Code-writing ops are judged on the lines they changed against the same numbers (and every service they touched at 100 coverage, measured by a unit run over those services before the scan) and cannot settle done while the gate is red; `sonar-local.mjs dashboard --cwd <app>` prints a project's dashboard numbers (bugs, code smells, vulnerabilities, hotspots reviewed, coverage and the coverage of every service) and fails unless all are at the gate; when this server is down the op records the `sonar-unavailable` why and the Supervisor gets a runtime incident - bring the stack up (`docker compose ... up -d`, above) and the op is re-run.

## Who uses it

Every product repository scans here (local ops through `scripts/checks/sonar-local.mjs`, GitHub CI
through the public host): starci-academy-backend, starci-academy-fe, nivo-backend, nivo-fe,
starci-next, starci-next-fe, mia-mia-backend, miamia-fe, tedo-landing — the set is each repository's
`services.sonar.projects` entry, listed in the host declaration
(`examples/starcistacks-services/starci-academy-backend.application-stacks.yaml`). A product's own
per-project analysis token stays in **its** custody
(`.starcistacks/dev/runtime/files/sonarqube-<key>-token.key.enc`, written through that repository's stack-secret tool), never in this extension. The example apps under `examples/` are the exception: they belong to this runtime repository, so the tokens they declare (`services.sonar.credentials`, custody path `.claude/ext/sonar/secrets/sonarqube-<key>-token.key`) are sealed in `secrets/`. `sonar-local.mjs ensure-project --with-token` (and a scan whose member the server rejects) mints the token with the admin token and seals it there itself, with `sops --encrypt` to the one recipient the directory's sealed members share, through a 0600 temp file (never argv), writing only the `.enc`; a directory with no such recipient is refused and the minted value revoked.
