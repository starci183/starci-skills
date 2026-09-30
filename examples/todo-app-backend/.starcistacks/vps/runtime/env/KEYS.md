# Runtime secret keys

DEMO-ONLY: `runtime/env/app.env.enc` is encrypted to the untracked age identity expected at
`../../dev/runtime/env/demo.agekey` (shared across dev and vps for this example only). Provision it
before running `sops -d`. Never reuse that identity or this pattern outside the example.

| Key | Encrypted owner | Purpose |
|---|---|---|
| `PRIMARY_DB_URL` | `runtime/env/app.env.enc` | Postgres connection of the `primary` database, read by the api, the worker and apps/migrate |
| `KEYCLOAK_ADMIN_PASSWORD_FILE` | Swarm secret `keycloak-admin-password` | Bootstrap password for the realm admin |
| `MINIO_ROOT_PASSWORD_FILE` | Swarm secret `minio-root-password` | Object store root credential |
