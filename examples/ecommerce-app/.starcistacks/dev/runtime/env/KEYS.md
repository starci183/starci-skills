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
| `CACHE_TIMEOUT` | Deadline of one Redis command (`250`, `2s`) | `2s` |
| `KEYCLOAK_TOKEN_URL` | Token endpoint of the realm shoppers sign in to (password grant) | none |
| `KEYCLOAK_CLIENT_ID` | Public client of that grant (`identity-api`) | none |
| `KEYCLOAK_TIMEOUT` | Deadline of a sign-in or sign-out call to Keycloak | `10s` |
| `KEYCLOAK_ADMIN_URL` | Base URL of the Keycloak server shoppers are created on | none |
| `KEYCLOAK_ADMIN_REALM` | Realm the shoppers live in | none |
| `KEYCLOAK_ADMIN_CLIENT_ID` | Confidential client whose service account creates the realm's users (`identity-admin`) | none |
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
| `EVENT_BUS_BROKERS` | Kafka bootstrap addresses, comma separated (`host:port`) | none |
| `EVENT_BUS_GROUP_ID` | Consumer group of the app (the order api consumes `billing.invoice-issued` and `billing.invoice-rejected`) | none |
| `EVENT_BUS_TOPIC_PREFIX` | What every topic name starts with (empty in a deployment) | empty |
| `EVENT_BUS_RELAY_INTERVAL` | Pause between two relay passes over an empty outbox | `200ms` |
| `EVENT_BUS_RELAY_BATCH` | The most outbox rows one relay pass sends | `50` |
| `EVENT_BUS_TIMEOUT` | Deadline of one broker call | `3s` |
| `ORDER_EXPIRY_EVERY` | Pause between two ticks of the order expiry scheduler | `1m` |
| `ORDER_PAYMENT_WINDOW` | How long an order stays pending for its payment before it expires | `1h` |
| `QUEUE_REDIS_HOST` | Redis host BullMQ talks to | none |
| `QUEUE_REDIS_PORT` | Redis port | `6379` |
| `QUEUE_PREFIX` | What every BullMQ key starts with | `queue` |
| `QUEUE_RELAY_INTERVAL` | Pause between two relay passes over an empty queue outbox | `200ms` |
| `QUEUE_RELAY_BATCH` | The most queue outbox rows one relay pass hands to BullMQ | `50` |
| `QUEUE_CONCURRENCY` | Jobs one worker runs at the same time | `5` |
| `JOBS_WORKER_ID` | The name a worker writes into `claimed_by` of a job it claims | `worker` |
| `JOBS_LEASE` | How long a job claim lasts before a stalled job may be claimed again | `1m` |

## billing api (`apps/billing`)

It listens for the signed webhook of the bank transfer notifier (`POST /webhooks/sepay`) and the readiness probe, and it consumes `order.placed` from Kafka to write invoices and their announcements. Its default-deny guard verifies bearer tokens through the identity service like the order api.

| Key | Meaning | Default |
| --- | --- | --- |
| `BILLING_API_PORT` | Port the api listens on | none |
| `BILLING_DB_URL` | Postgres URL of the `billing` connection (secret) | none |
| `IDENTITY_API_URL`, `IDENTITY_API_TIMEOUT` | As on the order api | as above |
| `SEPAY_WEBHOOK_SECRET` | Secret the bank transfer notifier signs its deliveries with: HMAC-SHA256 over `<timestamp>.<raw body>` in `x-sepay-signature`, the timestamp in `x-sepay-timestamp` (secret) | none |
| `SEPAY_WEBHOOK_TOLERANCE` | How far a delivery's signed timestamp may be from now before it is refused as a replay | `5m` |
| `HTTP_SECURITY_ALLOWED_ORIGINS`, `HTTP_SECURITY_RATE_*` | As above | as above |

| `EVENT_BUS_BROKERS`, `EVENT_BUS_GROUP_ID`, `EVENT_BUS_TOPIC_PREFIX`, `EVENT_BUS_RELAY_INTERVAL`, `EVENT_BUS_RELAY_BATCH`, `EVENT_BUS_TIMEOUT` | As on the order api | as above |
| `INVOICE_MAX_TOTAL_MINOR_UNITS` | The largest total one invoice may bill; a larger order is rejected and announced | `50000000` |

## keycloak (the stack's identity provider)

| Key | Meaning | Demo default (compose) |
| --- | --- | --- |
| `KC_BOOTSTRAP_ADMIN_PASSWORD` | Password of the bootstrap `admin` of the master realm | `demo-only-keycloak-admin-password` |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | Secret of the `identity-admin` client; the realm import reads it, the identity api presents it | `demo-only-identity-admin-client-secret` |

## minio (the stack's object storage)

| Key | Meaning | Demo default (compose) |
| --- | --- | --- |
| `MINIO_ROOT_PASSWORD` | Password of the MinIO root user `ecommerce` | `demo-only-minio-root-password` |
| `RECEIPTS_S3_SECRET_ACCESS_KEY` | The same password, as the order api presents it | `demo-only-minio-root-password` |

DEMO-ONLY: these three values belong to a local stack on loopback and are not secrets; the compose files interpolate them with these defaults, so a clean
clone needs no owner secret. Export `KC_BOOTSTRAP_ADMIN_PASSWORD`, `KEYCLOAK_ADMIN_CLIENT_SECRET` and `MINIO_ROOT_PASSWORD` before `up` to use others
(`browser/stack.mjs` generates fresh ones per run and hands them to Compose and to the apis through the environment); give the services the same values.

## cli (`apps/cli`)

`IDENTITY_DB_URL`, `ORDER_DB_URL` and `BILLING_DB_URL`, the same keys the apis and the billing worker read; `cli migrate run` migrates every connection.
