# Runtime secret keys

Every row is one secret. The `.enc` member is the tracked record; the decrypted member is produced by
`npm run sync` and is never committed.

DEMO-ONLY: every `.enc` file in this example is encrypted to the age identity expected at
`runtime/env/demo.agekey`. The private identity is untracked and must be provisioned before `sops -d`
can open these documents. Every decrypted value is an example value, never a real credential. This
identity and its encrypted documents teach the layout; neither may be reused for a real deployment.

| Key | Encrypted owner | Purpose |
|---|---|---|
| `PRIMARY_DB_URL` | `runtime/env/app.env.enc` | Postgres connection of the `primary` database, read by the api, the worker and apps/migrate |
| `KEYCLOAK_ADMIN_PASSWORD_FILE` | `runtime/files/keycloak-admin-password.key.enc` | Bootstrap password for the realm admin |
| `POSTGRES_PASSWORD_FILE` | `runtime/files/postgres-password.key.enc` | Postgres superuser password, read by the postgres image itself (was a plaintext POSTGRES_PASSWORD literal in postgres.yaml until the stacks checker's plaintext-sensitive-environment finding) |
| `MINIO_ROOT_PASSWORD_FILE` | `runtime/files/minio-root-password.key.enc` | Object store root credential |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | `runtime/env/app.env.enc` | Outbound mail server and sender (no defaults) |
| `SEPAY_API_KEY_FILE` (or `SEPAY_API_KEY`) | `runtime/files/sepay-api-key.key.enc` | Calls SePay to create and query a payment intent (integration.plan.sepay) |
| `SEPAY_WEBHOOK_SECRET_FILE` (or `SEPAY_WEBHOOK_SECRET`) | `runtime/files/sepay-webhook-secret.key.enc` | Verifies the signature on a SePay webhook before it can confirm a payment |
| `UPLOAD_SIGNING_SECRET_FILE` (or `UPLOAD_SIGNING_SECRET`) | `runtime/files/upload-signing-secret.key.enc` | Signs the presigned PUT upload tokens |

A key that the declaration names and this table does not is an undocumented secret: the check reports it
rather than assuming somebody knows what it unlocks.

Other keys the apps read (all through `EnvSource`, see each capability `<c>.config.ts`): `PORT` (api listener), `HTTP_SECURITY_ALLOWED_ORIGINS`
(comma separated origins, also the CORS list), `KEYCLOAK_TOKEN_URL`, `KEYCLOAK_CLIENT_ID`, `SEPAY_BASE_URL`, `UPLOAD_DIR`, and the optional tunables
`SESSION_TTL_DAYS`, `SESSION_ADMIN_SUBJECTS`, `RECUR_TICK_CRON`, `PLAN_PAID_PRICE_MINOR_UNITS`, `PLAN_PAID_CURRENCY`, `UPLOAD_MAX_BYTES`, `UPLOAD_ALLOWED_MIMES`,
`UPLOAD_PRESIGN_TTL_MS`, `KEYCLOAK_TIMEOUT`, `SEPAY_TIMEOUT`, `SMTP_CONNECT_TIMEOUT`, `SMTP_COMMAND_TIMEOUT`, `SCHEDULING_TICK`, `MESSAGING_POLL`,
`MESSAGING_BATCH`, `MESSAGING_VISIBILITY`, `HTTP_SECURITY_RATE_*`. Removed: `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`, `TODO_SESSION_TTL_DAYS`,
`AUDIT_OPERATOR_SUBJECTS`. NOTE: the `runtime/env/app.env.enc` document is encrypted to the demo identity and could not be re-encrypted in this lane:
it still carries `DATABASE_URL`/`REDIS_URL`; it must be re-issued with the keys above.
