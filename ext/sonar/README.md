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

## Who uses it

Every product repository scans here (local ops through `scripts/checks/sonar-local.mjs`, GitHub CI
through the public host): starci-academy-backend, starci-academy-fe, nivo-backend, nivo-fe,
starci-next, starci-next-fe, mia-mia-backend, miamia-fe, tedo-landing — the set is each repository's
`services.sonar.projects` entry, listed in the host declaration
(`examples/starcistacks-services/starci-academy-backend.application-stacks.yaml`). A product's own
per-project analysis token stays in **its** custody
(`.starcistacks/dev/runtime/files/sonarqube-<key>-token.key.enc`), never in this extension.
