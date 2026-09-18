# Runtime secret keys

Every row is one secret. The `.enc` member is the tracked record; the decrypted member is produced by
`npm run sync` and is never committed.

DEMO-ONLY: every `.enc` file in this example is encrypted to the age identity committed at
`runtime/env/demo.agekey`, so that a reader can `sops -d` them and see a genuine, round-tripping SOPS
document. Every decrypted value is a placeholder string, never a real credential. That identity, and every
`.enc` file encrypted to it, exists purely to teach the shape of the layout; none of it may be reused for a
real deployment, and no real secret may ever be encrypted to this public key.

| Key | Encrypted owner | Purpose |
|---|---|---|
| `DATABASE_URL` | `runtime/env/app.env.enc` | Postgres connection for the api |
| `REDIS_URL` | `runtime/env/app.env.enc` | Cache and session store |
| `KEYCLOAK_ADMIN_PASSWORD_FILE` | `runtime/files/keycloak-admin-password.key.enc` | Bootstrap password for the realm admin |
| `MINIO_ROOT_PASSWORD_FILE` | `runtime/files/minio-root-password.key.enc` | Object store root credential |
| `TODO_SESSION_SECRET_FILE` | `runtime/files/todo-session-secret.key.enc` | Signs the api session cookie |
| `SMTP_API_KEY_FILE` | `runtime/files/smtp-api-key.key.enc` | Outbound mail for task reminders |
| `SEPAY_API_KEY_FILE` | `runtime/files/sepay-api-key.key.enc` | Calls SePay to create and query a payment intent (integration.plan.sepay) |
| `SEPAY_WEBHOOK_SECRET_FILE` | `runtime/files/sepay-webhook-secret.key.enc` | Verifies the signature on a SePay webhook before it can confirm a payment |

A key that the declaration names and this table does not is an undocumented secret: the check reports it
rather than assuming somebody knows what it unlocks.

