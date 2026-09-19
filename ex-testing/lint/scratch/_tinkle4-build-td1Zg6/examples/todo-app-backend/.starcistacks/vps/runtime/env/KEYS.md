# Runtime secret keys

DEMO-ONLY: `runtime/env/app.env.enc` is encrypted to the DEMO-ONLY age identity committed at
`../../dev/runtime/env/demo.agekey` (shared across dev and vps for this example only), so a reader can
`sops -d` it and get a placeholder value. Never reuse that identity, or this pattern, outside the example.

| Key | Encrypted owner | Purpose |
|---|---|---|
| `DATABASE_URL` | `runtime/env/app.env.enc` | Postgres connection for the api |
| `REDIS_URL` | `runtime/env/app.env.enc` | Cache and session store |
| `KEYCLOAK_ADMIN_PASSWORD_FILE` | Swarm secret `keycloak-admin-password` | Bootstrap password for the realm admin |
| `MINIO_ROOT_PASSWORD_FILE` | Swarm secret `minio-root-password` | Object store root credential |

