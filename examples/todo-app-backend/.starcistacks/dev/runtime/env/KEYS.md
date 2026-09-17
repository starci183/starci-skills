# Runtime secret keys

Every row is one secret. The `.enc` member is the tracked record; the decrypted member is produced by
`npm run sync` and is never committed.

| Key | Encrypted owner | Purpose |
|---|---|---|
| `DATABASE_URL` | `runtime/env/app.env.enc` | Postgres connection for the api |
| `REDIS_URL` | `runtime/env/app.env.enc` | Cache and session store |
| `KEYCLOAK_ADMIN_PASSWORD_FILE` | `runtime/files/keycloak-admin-password.key.enc` | Bootstrap password for the realm admin |
| `MINIO_ROOT_PASSWORD_FILE` | `runtime/files/minio-root-password.key.enc` | Object store root credential |
| `TODO_SESSION_SECRET_FILE` | `runtime/files/todo-session-secret.key.enc` | Signs the api session cookie |
| `SMTP_API_KEY_FILE` | `runtime/files/smtp-api-key.key.enc` | Outbound mail for task reminders |

A key that the declaration names and this table does not is an undocumented secret: the check reports it
rather than assuming somebody knows what it unlocks.

