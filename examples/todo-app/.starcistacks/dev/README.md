# dev runbook

| command | what it does |
|---|---|
| prepare | `docker compose -f compose.yaml pull` |
| doctor | `docker compose -f compose.yaml config` |
| up | `docker compose -f compose.yaml up -d` |
| status | `docker compose -f compose.yaml ps` |
| logs | `docker compose -f compose.yaml logs -f` |
| down | `docker compose -f compose.yaml down` |
| verification | `curl -fsS http://localhost:3001/health` |

`secrets/uat` is decrypted locally from `secrets/uat.enc`; the plaintext member is never committed.

