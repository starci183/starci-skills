# Environment keys of ecommerce-app (be side)

Values live in the process environment of each service (never in code and never tracked); this file lists the keys
only. Every key without a default is required: a missing or malformed key stops the boot and names the key.
`<KEY>_FILE` supplies `<KEY>` from a file, so a secret can be mounted instead of exported.

## identity api (`apps/identity`)

| Key | Meaning | Default |
| --- | --- | --- |
| `IDENTITY_API_PORT` | Port the api listens on | none |
| `IDENTITY_DB_URL` | Postgres URL of the `identity` connection (secret: may embed credentials) | none |
| `CACHE_REDIS_URL` | Redis URL of the session store (secret) | none |
| `KEYCLOAK_ADMIN_URL` | Base URL of the Keycloak server the member profiles are read from | none |
| `KEYCLOAK_ADMIN_REALM` | Realm the members live in | none |
| `KEYCLOAK_ADMIN_CLIENT_ID` | Confidential client whose service account reads the realm's users (`identity-admin`) | none |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | Secret of that client (secret, sealed in `secrets/keycloak-env.enc`) | none |
| `KEYCLOAK_ADMIN_TIMEOUT` | Deadline of a call to Keycloak (`250`, `3s`) | `3s` |
| `ORDER_API_URL` | Base URL of the order service | none |
| `ORDER_API_TIMEOUT` | Deadline of a call to the order service (`250`, `3s`) | `3s` |
| `HTTP_SECURITY_ALLOWED_ORIGINS` | Comma-separated origins allowed to send browser state-changing requests | none |
| `HTTP_SECURITY_RATE_WINDOW` | Rate limit window | `1m` |
| `HTTP_SECURITY_RATE_DEFAULT_LIMIT` | Requests per window per caller, default tier | `600` |
| `HTTP_SECURITY_RATE_STRICT_LIMIT` | Requests per window per caller, strict tier (register, signIn, verifySession) | `30` |

The order service verifies every bearer token through identity `verifySession`, which is on the strict tier: raise
`HTTP_SECURITY_RATE_STRICT_LIMIT` on the identity api to the request rate you expect from the order service.

## order api (`apps/order`)

| Key | Meaning | Default |
| --- | --- | --- |
| `ORDER_API_PORT` | Port the api listens on | none |
| `ORDER_DB_URL` | Postgres URL of the `order` connection (secret) | none |
| `IDENTITY_API_URL` | Base URL of the identity service | none |
| `IDENTITY_API_TIMEOUT` | Deadline of a call to the identity service | `3s` |
| `RECEIPTS_S3_ENDPOINT` | MinIO (S3) endpoint the receipts are archived in; buyers' download links point at it | none |
| `RECEIPTS_S3_BUCKET` | Private bucket of the receipts | none |
| `RECEIPTS_S3_ACCESS_KEY_ID` | Access key id (the MinIO root user `ecommerce` in dev) | none |
| `RECEIPTS_S3_SECRET_ACCESS_KEY` | Secret access key (secret, sealed in `secrets/minio-env.enc`) | none |
| `RECEIPTS_S3_REGION` | Region the requests are signed for | `us-east-1` |
| `RECEIPTS_LINK_TTL` | Lifetime of a receipt download link (`5m`) | `5m` |
| `RECEIPTS_S3_TIMEOUT` | Deadline of a call to MinIO | `15s` |
| `HTTP_SECURITY_ALLOWED_ORIGINS`, `HTTP_SECURITY_RATE_*` | As above | as above |

## keycloak (the stack's identity provider)

| Key | Meaning | Sealed in |
| --- | --- | --- |
| `KC_BOOTSTRAP_ADMIN_PASSWORD` | Password of the bootstrap `admin` of the master realm | `secrets/keycloak-env.enc` |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | Secret of the `identity-admin` client; the realm import reads it, the identity api presents it | `secrets/keycloak-env.enc` |

## minio (the stack's object storage)

| Key | Meaning | Sealed in |
| --- | --- | --- |
| `MINIO_ROOT_PASSWORD` | Password of the MinIO root user `ecommerce` | `secrets/minio-env.enc` |
| `RECEIPTS_S3_SECRET_ACCESS_KEY` | The same password, as the order api presents it | `secrets/minio-env.enc` |

DEMO-ONLY: `secrets/keycloak-env.enc` is encrypted to the example identity expected at `runtime/env/demo.agekey`. `sops -d`
writes its decrypted member to `runtime/env/keycloak.env`, which Compose reads and git never tracks; `secrets/minio-env.enc`
likewise decrypts to `runtime/env/minio.env`.

## migrate (`apps/migrate`)

`IDENTITY_DB_URL` and `ORDER_DB_URL`, the same keys the apis read.
