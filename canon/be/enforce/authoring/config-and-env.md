# Config and env — code style

Scope: how the backend reads configuration and environment variables — who may touch `process.env`,
how a consumer reads config, and where secrets live. Grounded entirely in `src/modules/env/**` and
its real consumers.

---

## 1. `process.env[...]` may be touched ONLY in `src/modules/env/utils/parse-env.ts`

All reading of `process.env` is gathered into the `parseEnv*` helpers. No service, handler, or
provider reads `process.env` directly — scattered reads lose typing, lose defaults, and cannot be
found in one grep.

```ts
// src/modules/env/utils/parse-env.ts — the ONLY place that touches process.env
export const parseEnvInt = ({ key, defaultValue }: ParseEnvIntParams): number => {
    return parseInt(process.env[key] ?? defaultValue.toString(), 10)
}
```

```ts
// Wrong: a consumer picking up env itself — untyped, scattered
const maxDevices = parseInt(process.env.SESSION_MAX_DEVICES ?? "2", 10)
```

There are exactly three LEGITIMATE exceptions, all at system boundaries rather than in business
logic:

- `src/modules/sentry/instrument.ts` — Sentry initialises BEFORE the Nest boot, so no config exists
  yet: `environment: process.env.NODE_ENV`.
- `src/modules/filesystem/mount.service.ts` and `src/features/backup/pg/pg.service.ts` — these pass
  `...process.env` down into a child process via `spawn`; they are not reading a value to use it.

Any other new `process.env` is wrong.

---

## 2. Consumers read config through `envConfig().x.y`, imported from `@modules/env`

Every configuration value is obtained by CALLING `envConfig()` and then walking the nested fields.
Import from the `@modules/env` barrel, never deep into `config.ts`.

```ts
// src/modules/session/session.service.ts and src/modules/csrf/csrf.service.ts
import { envConfig } from "@modules/env"
// ...
const max = envConfig().session.maxDevices
if (envConfig().cookie.domain) { /* ... */ }
```

```ts
// src/modules/ai/balancer/use-api.service.ts — interpolated directly into a template
url: `${envConfig().ai.openrouter.baseUrl}/chat/completions`,
```

```ts
// Wrong: reaching past the barrel into the config file
import { envConfig } from "@modules/env/config"
```

---

## 3. Every config node is one `parseEnv*({ key, defaultValue })` inside `envConfig()`

`envConfig` (`src/modules/env/config.ts`) is an object tree, and every leaf goes through exactly one
helper chosen by its data type, ALWAYS with a `defaultValue`. The helpers are `parseEnvString`,
`parseEnvInt`, `parseEnvFloat`, `parseEnvBoolean`, `parseEnvMs` (a duration in milliseconds),
`parseEnvSecond`, and `parseEnvJson<T>`.

```ts
// src/modules/env/config.ts
maxDevices: parseEnvInt({ key: "SESSION_MAX_DEVICES", defaultValue: 2 }),
ttlMs: parseEnvMs({ key: "SESSION_TTL", defaultValue: "30d" }),
teamSlugsByCourseSlug: parseEnvJson<Record<string, string>>({
    key: "GITHUB_TEAM_SLUGS_BY_COURSE_SLUG",
    defaultValue: JSON.stringify({ "fullstack-mastery": "fullstack-mastery" }),
}),
```

```ts
// Wrong: a hard-coded constant in a service where a config node with a key and a default belongs
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
```

By convention every duration uses `parseEnvMs` with an `ms` string (`"30s"`, `"1m"`, `"1h"`,
`"100years"`) — never a raw millisecond number.

---

## 4. Value shaping happens INSIDE `envConfig()`, not in the consumer

Splitting, filtering, comparing, or building a list is done at the config leaf, so the consumer
receives an already-clean value of the right type.

```ts
// src/modules/env/config.ts
isProduction: parseEnvString({ key: "NODE_ENV", defaultValue: "development" }) === "production",

contactPoints: parseEnvString({ key: "SCYLLADB_CONTACT_POINTS", defaultValue: "localhost" })
    .split(",").map((host) => host.trim()).filter((host) => host !== ""),

// a numbered env list CORS_ORIGIN_1..10, dropping the empty ones
origins: Array.from({ length: 10 }, (_, i) =>
    parseEnvString({ key: `CORS_ORIGIN_${i + 1}`, defaultValue: "http://localhost:3000" }),
).filter((url) => url !== ""),
```

The shape to avoid is returning a raw string and making every consumer `.split(",")` for itself.

---

## 5. A secret is NOT an env var — it is read on demand from a mounted file

Keys and API secrets do not live in `process.env`. `envConfig().mountPath.*` holds only the file
PATH, which may itself be overridden by env; the secret VALUE is read with `readFileSync` in
`src/modules/filesystem/utils/mount-secrets.ts`. The goal is to keep secrets out of logs and APM —
see the note in `src/modules/filesystem/mount.service.ts`: *"Avoid using process.env for sensitive
secrets"*.

```ts
// src/modules/filesystem/utils/mount-secrets.ts
export const getS3SecretAccessKey = (): string =>
    readFileSync(envConfig().mountPath.terraform.s3SecretAccessKey, "utf8")
```

```ts
// src/modules/env/config.ts — config declares the path and says plainly that the secret is not env
stripe: {
    // Secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) are NOT env vars —
    // they live in mount-terraform files read via MountFilesystemService.
    currency: parseEnvString({ key: "STRIPE_CURRENCY", defaultValue: "usd" }),
},
```

```ts
// Wrong: putting the secret in env and reading it directly — it must come from the mounted file
const key = process.env.STRIPE_SECRET_KEY
```
