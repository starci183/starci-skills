# Runtime secret keys

| Key | Encrypted owner | Purpose |
|---|---|---|
| `DATABASE_URL` | `runtime/env/app.env.enc` | Postgres connection for the api |
| `REDIS_URL` | `runtime/env/app.env.enc` | Cache and session store |
| `KEYCLOAK_ADMIN_PASSWORD_FILE` | Swarm secret `keycloak-admin-password` | Bootstrap password for the realm admin |
| `MINIO_ROOT_PASSWORD_FILE` | Swarm secret `minio-root-password` | Object store root credential |

