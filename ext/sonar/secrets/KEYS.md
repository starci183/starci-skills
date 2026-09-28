# ext/sonar custody

SOPS/age ciphertext twins of the host-level SonarQube secrets, moved read-only from the legacy
`<source>/.stacks/dev/runtime/files/` members. All are encrypted to the source stack's age recipient
`age1myd77xz5lhsluc4ejzztsck32pfq3vfpzrva8cegzydk2guhxqesgm3z4j`; the decryption identity
(`~/.starci/master.identity`) stays outside Git and is backed up by the owner machine.

| Member | Decrypts to (untracked) | Consumed by |
|---|---|---|
| `sonarqube-db-password.txt.enc` | `secrets/sonarqube-db-password.txt` | `.env` (`SONARQUBE_DB_PASSWORD`) — the sonarqube-postgres role password |
| `sonarqube-admin-password.txt.enc` | `secrets/sonarqube-admin-password.txt` | `compose.yaml` `sonarqube-bootstrap` mount (replaces the default admin password once) |
| `sonarqube-admin-token.key.enc` | `secrets/sonarqube-admin-token.key` | `scripts/checks/sonar-local.mjs` — creates projects and mints per-project analysis tokens |
| `sonarqube-analysis-token.txt.enc` | `secrets/sonarqube-analysis-token.txt` | `sonar-local.mjs` — the server-wide fallback analysis token |
| `cloudflare-starci-local-services-tunnel-token.key.enc` | `secrets/cloudflare-starci-local-services-tunnel-token.key` | `cloudflared.yaml` mount (profile `public`) — publishes the server as the public host URL |

Per-project Sonar analysis tokens are NOT here: each project's `sonarqube-<key>-token.key.enc` twin
lives in that project's own `.starcistacks/dev/runtime/files/` custody (its declaration's
`services.sonar.credentials` points there).

Decrypt one member: `sops -d secrets/<name>.enc > secrets/<name>` — the plaintext twin is gitignored
and must never be committed. If a twin listed above is missing, the owner re-mints the secret
(`scripts/checks/sonar-local.mjs` / the legacy `secret:gen` flow), encrypts it to the same recipient
(`sops -e --age age1myd77xz5lhsluc4ejzztsck32pfq3vfpzrva8cegzydk2guhxqesgm3z4j`), commits only the
`.enc`, and applies the new value to the live server where the consumer reads it.
