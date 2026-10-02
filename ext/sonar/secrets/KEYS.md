# ext/sonar custody

SOPS/age ciphertext twins of the host-level SonarQube secrets, moved read-only from the legacy
`<source>/.stacks/dev/runtime/files/` members. All are encrypted to the source stack's age recipient
`age1myd77xz5lhsluc4ejzztsck32pfq3vfpzrva8cegzydk2guhxqesgm3z4j`; the decryption identity
(`~/.starci/master.identity`) stays outside Git and is backed up by the owner machine.

| Member | Decrypts to (untracked) | Consumed by |
|---|---|---|
| `sonarqube-db-password.txt.enc` | `secrets/sonarqube-db-password.txt` | `.env` (`SONARQUBE_DB_PASSWORD`) — the sonarqube-postgres role password |
| `sonarqube-admin-password.txt.enc` | `secrets/sonarqube-admin-password.txt` | `compose.yaml` `sonarqube-bootstrap` mount (replaces the default admin password once) |
| `sonarqube-admin-token.key.enc` | `secrets/sonarqube-admin-token.key` | `scripts/gates/sonar-local.mjs` — creates projects and mints per-project analysis tokens |
| `sonarqube-analysis-token.txt.enc` | `secrets/sonarqube-analysis-token.txt` | `sonar-local.mjs` — the server-wide fallback analysis token |
| `sonarqube-starci-ecommerce-app-token.key.enc` | `secrets/sonarqube-starci-ecommerce-app-token.key` | `sonar-local.mjs` — the PROJECT_ANALYSIS_TOKEN of the example app `examples/ecommerce-app` (its declaration's analysis credential) |
| `cloudflare-starci-local-services-tunnel-token.key.enc` | `secrets/cloudflare-starci-local-services-tunnel-token.key` | `cloudflared.yaml` mount (profile `public`) — publishes the server as the public host URL |

Per-project Sonar analysis tokens of a product repository are NOT here: each project's
`sonarqube-<key>-token.key.enc` twin lives in that project's own `.starcistacks/dev/runtime/files/` custody (its
declaration's `services.sonar.credentials` points there). The example apps under `examples/` are part of this runtime
repository and have no stack-secret tool or recipient of their own, so their analysis tokens are sealed here, to the same recipient. `sonar-local.mjs` mints and seals these members itself (`ensure-project --with-token`, or a re-mint when the server rejects the stored token): `sops --encrypt` to the recipient shared by the sealed members of this directory, `.enc` only, the value passed through a 0600 temp file and never argv.

Decrypt one member: `sops -d secrets/<name>.enc > secrets/<name>` — the plaintext twin is gitignored
and must never be committed. If a twin listed above is missing, the owner re-mints the secret
(`scripts/gates/sonar-local.mjs` / the legacy `secret:gen` flow), encrypts it to the same recipient
(`sops -e --age age1myd77xz5lhsluc4ejzztsck32pfq3vfpzrva8cegzydk2guhxqesgm3z4j`), commits only the
`.enc`, and applies the new value to the live server where the consumer reads it.
