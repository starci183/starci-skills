# Config and env — code style

Scope: how the backend reads configuration and environment variables — who may touch `process.env`,
how a consumer reads config, and where secrets live. Grounded entirely in `src/modules/platform/env/**` and
its real consumers.

---

## 1. `process.env[...]` may be touched ONLY in `src/modules/platform/env/utils/parse-env.ts`

All reading of `process.env` is gathered into the `parseEnv*` helpers. No service, handler, or
provider reads `process.env` directly — scattered reads lose typing, lose defaults, and cannot be
found in one grep.

```ts
// src/modules/platform/env/utils/parse-env.ts — the ONLY place that touches process.env
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

- `src/modules/integrations/sentry/instrument.ts` — Sentry initialises BEFORE the Nest boot, so no config exists
  yet: `environment: process.env.NODE_ENV`.
- `src/modules/filesystem/mount.service.ts` and `src/features/backup/pg/pg.service.ts` — these pass
  `...process.env` down into a child process via `spawn`; they are not reading a value to use it.

Any other new `process.env` is wrong.

---

## 2. Consumers read config through `envConfig().x.y`, imported from `@modules/env`

Every configuration value is obtained by CALLING `envConfig()` and then walking the nested fields.
Import from the `@modules/env` barrel, never deep into `config.ts`.

```ts
// src/modules/platform/session/session.service.ts and src/modules/platform/csrf/csrf.service.ts
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

`envConfig` (`src/modules/platform/env/config.ts`) is an object tree, and every leaf goes through exactly one
helper chosen by its data type, ALWAYS with a `defaultValue`. The helpers are `parseEnvString`,
`parseEnvInt`, `parseEnvFloat`, `parseEnvBoolean`, `parseEnvMs` (a duration in milliseconds),
`parseEnvSecond`, `parseEnvJson<T>`, and — for credentials only — `parseEnvSecret` (§5).

```ts
// src/modules/platform/env/config.ts
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
// src/modules/platform/env/config.ts
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

## 5. A secret goes through `parseEnvSecret` and the `<KEY>_FILE` pointer convention

Every credential — an infra password as much as a third-party API key — is declared under
`envConfig().secrets.*` with `parseEnvSecret`, never `parseEnvString`. The KEY names the VALUE
(`STRIPE_SECRET_KEY`, not a path); the pointer twin `<KEY>_FILE` names a file, and
`parseEnvSecret` opens it while the config tree is being built. The leaf therefore holds the
RESOLVED value, and nothing downstream opens a file for it.

```ts
// src/modules/platform/env/config.ts — the key names the value, not a path
secrets: {
    stripeSecretKey: parseEnvSecret({ key: "STRIPE_SECRET_KEY", defaultValue: "" }),
},
```

```ts
// src/modules/filesystem/utils/mount-secrets.ts — a lookup, not a file read
export const getStripeSecretKey = (): string => envConfig().secrets.stripeSecretKey
```

The three rules `parseEnvSecret` enforces, and why:

- **Pointer unset** → falls through to the ordinary string parser (env var, else default). The
  optional case stays free.
- **Both `<KEY>` and `<KEY>_FILE` set** → `EnvFileConflictException`. Either precedence rule is
  defensible and neither is discoverable, so a silent winner is a stack running on a credential
  nobody chose.
- **Pointer set but the file is missing or empty** → `EnvFileUnreadableException`, at boot. The
  pointer is generated by `scripts/sync.mjs`, not hand-written, so a pointer present means somebody
  put a file behind it; falling back to the default there produces a green deploy quietly running
  without a credential it was given.

Calling `parseEnvSecret` IS the statement that a key is a secret — which is why it is a separate
function rather than a `_FILE` branch inside all the parsers. A shared branch would make every key
file-backable for free, and then nothing in the source would say which keys are credentials.

```ts
// Wrong: a credential read as an ordinary string — no pointer, no conflict check
password: parseEnvString({ key: "POSTGRESQL_PRIMARY_PASSWORD", defaultValue: "postgres" }),
```

```ts
// Wrong: an env key that names a PATH instead of the value it points at
key: "TERRAFORM_STRIPE_SECRET_KEY_MOUNT_PATH",
```

`envConfig().mountPath.*` survives, but only for what it honestly describes: CONTENT and CONFIG
file paths (`DATA_*_MOUNT_PATH`, `CONFIG_*_MOUNT_PATH`) plus the AI key-pool DIRECTORY. Those are
locations, not credentials, and the loaders still open them themselves.
