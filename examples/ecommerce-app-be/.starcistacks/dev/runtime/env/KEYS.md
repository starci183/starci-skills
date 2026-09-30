# Environment keys of ecommerce-app-be

Values live in the process environment of each service (never in code and never tracked); this file lists the keys
only. Every key without a default is required: a missing or malformed key stops the boot and names the key.
`<KEY>_FILE` supplies `<KEY>` from a file, so a secret can be mounted instead of exported.

## identity api (`apps/identity`)

| Key | Meaning | Default |
| --- | --- | --- |
| `IDENTITY_API_PORT` | Port the api listens on | none |
| `IDENTITY_DB_URL` | Postgres URL of the `identity` connection (secret: may embed credentials) | none |
| `CACHE_REDIS_URL` | Redis URL of the session store (secret) | none |
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
| `HTTP_SECURITY_ALLOWED_ORIGINS`, `HTTP_SECURITY_RATE_*` | As above | as above |

## migrate (`apps/migrate`)

`IDENTITY_DB_URL` and `ORDER_DB_URL`, the same keys the apis read.
