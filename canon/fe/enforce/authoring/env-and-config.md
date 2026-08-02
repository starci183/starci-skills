# Env and config — public, server-only, and failing fast

Scope: how a front-end app reads configuration — which values may reach the browser, where
`process.env` is allowed to appear, how a value is typed and coerced, and what happens at boot when a
required variable is missing. Grounded in named public sources: the 12-Factor App (Adam Wiggins,
2011) factors III (config in the environment) and X (dev/prod parity), the Next.js docs on
environment variables and the `server-only` boundary, the Google TypeScript Style Guide on honest
types, OWASP ASVS on configuration and secret management, and Michael Nygard's *Release It!* for Fail
Fast.

The framework prefix in the examples is `NEXT_PUBLIC_`; substitute `VITE_` or `PUBLIC_` and every
rule below holds unchanged, because the mechanism — a prefix is the opt-in that inlines a value into
the client bundle — is the same in all of them.

---

## 1. One typed config module owns every read of `process.env`

A single module reads the environment and exports a typed accessor. Nothing else in the app touches
`process.env`, because scattered reads lose their type (`string | undefined` everywhere), lose their
default, cannot be found in one grep when a key is renamed, and cannot be validated in one place.

Export an **accessor function**, not a frozen constant, so the module can be imported by code that
runs in more than one environment without evaluating server-only reads at import time.

```ts
// src/resources/env/public.ts — the ONLY module that reads NEXT_PUBLIC_* values
/** Values inlined into the client bundle at build time. Never put a credential here. */
export const publicEnv = () => ({
    api: {
        /** Absolute base URL of the HTTP API, e.g. https://api.example.com */
        httpUrl: process.env.NEXT_PUBLIC_API_HTTP_URL || "http://localhost:3001",
        /** Request timeout in milliseconds; coerced here so consumers get a number */
        timeoutMs: Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 15_000),
    },
    /** Debug logging is ON unless explicitly disabled, so a missing var never hides errors */
    debug: process.env.NEXT_PUBLIC_DEBUG !== "false",
})
```

```ts
// Wrong: a component reading env itself — untyped, undefaulted, and invisible to any audit
const timeout = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS)
```

The Google TypeScript Style Guide's most portable rule applies squarely here: make the type honest.
The consumer of `publicEnv().api.timeoutMs` gets a `number`, not a `string | undefined` it has to
re-check at every call site.

**Machine-checkable.** ESLint `no-restricted-properties` (or `no-restricted-syntax` on
`MemberExpression[object.name="process"]`) with an override for the config folder turns "only this
module reads env" from a convention into a gate.

---

## 2. Public and server-only are two modules, and the prefix is what decides

12-Factor III says configuration lives in the environment. It says nothing about who may read it,
and on the front end that is the whole question, because half the code runs on a machine the user
controls.

Split the config module in two along that line, and let the file name carry the boundary:

- **`public.ts`** — reads only prefixed variables. Importable from anywhere, including client
  components.
- **`server.ts`** — reads unprefixed variables. Importable only from server components, route
  handlers, server actions, and build scripts.

```ts
// src/resources/env/server.ts
import "server-only" // build-time error if this module is ever pulled into a client bundle

export const serverEnv = () => ({
    /** Signing secret for session cookies. Never crosses to the browser. */
    sessionSecret: process.env.SESSION_SECRET,
    /** Set by the hosting platform; used to pick production behaviour, not to branch business logic */
    isProduction: process.env.VERCEL_ENV === "production",
})
```

```ts
// Wrong: one module exporting both halves. The moment a client component imports it for the API URL,
// the bundler follows the module and the server reads come along for the ride.
export const env = () => ({ apiUrl: process.env.NEXT_PUBLIC_API_URL, secret: process.env.SESSION_SECRET })
```

**Machine-checkable.** The `server-only` package (documented in the Next.js docs) fails the build on
the offending import rather than at runtime in production. Where that package is not available,
ESLint `no-restricted-imports` with a `zones` entry pointed at the server config module does the same
job for the paths you list.

---

## 3. A public value is baked into the bundle at build time — and it is public forever

The prefix does not merely permit the value to reach the browser; it causes the bundler to
**substitute the literal text at build time**. Two consequences follow, and both surprise people:

- **Changing it needs a rebuild.** Setting the variable on the running host does nothing, because
  there is no `process.env` left in the shipped code to read — only the string that was there when
  the bundle was built. Anything that must change without a deploy has to arrive at runtime, from a
  server-rendered prop or an endpoint.
- **It is in view-source, permanently.** Not merely readable in the deployed bundle: cached by CDNs,
  archived by crawlers, kept in every user's browser cache. There is no un-shipping it, and rotation
  is the only remedy.

```tsx
// Right: a value that must be changeable at runtime is passed down from the server, not inlined.
export default async function Layout({ children }: LayoutProps) {
    const banner = await getMaintenanceBanner() // read server-side, per request
    return <BannerProvider value={banner}>{children}</BannerProvider>
}
```

---

## 4. A secret never reaches the client — the operation moves to the server instead

OWASP ASVS treats a credential embedded in client code as a finding regardless of how it got there,
and the reasoning is section 3: once shipped, it is disclosed. The prefix makes this a one-character
mistake, which is exactly why it needs a rule rather than care.

What is a secret: an API secret key, a signing or webhook secret, a database URL with credentials, a
private token of any kind, an admin key. What is not: a publishable or client key that the vendor
designed for the browser and that is scoped to public operations, a public base URL, a site key for a
CAPTCHA, a feature flag.

```ts
// Wrong, and the whole class in one line: prefixing a secret to "make it work in the component".
// It now sits in the JavaScript every visitor downloads.
const stripe = new Stripe(process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY!)
```

```ts
// Right: the browser calls an endpoint; the credential stays where it was issued to.
// src/app/api/checkout/route.ts
import { serverEnv } from "@/resources/env/server"

export const POST = async (request: Request) => {
    const stripe = new Stripe(serverEnv().stripeSecretKey)
    const session = await stripe.checkout.sessions.create(await request.json())
    return Response.json({ url: session.url })
}
```

The rule that generalises: **when a browser operation needs a credential, the operation moves to the
server, not the credential to the browser.** A client-side integration that offers no publishable key
is telling you it was not designed to run in a browser.

**Partly machine-checkable.** A secret scanner in CI or at push time (gitleaks, or the platform's own
push protection) catches committed values; nothing catches a legitimately-configured secret that was
merely given the wrong prefix, so the naming split in section 2 is what has to hold.

---

## 5. Coerce, default, and shape at the boundary — never in the consumer

Everything in the environment is a string or missing. The config module is where that stops being
true, so that every consumer downstream receives a value of the right type, already trimmed, split,
or parsed.

```ts
// src/resources/env/public.ts — every leaf leaves this module with its final type
export const publicEnv = () => ({
    /** Boolean: compare explicitly, because every non-empty string is truthy */
    analyticsEnabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true",
    /** Number with a default that is correct in production too, not merely convenient in dev */
    retryCount: Number(process.env.NEXT_PUBLIC_API_RETRY_COUNT || 3),
    /** List: split and cleaned here, so no consumer ever calls .split(",") on config again */
    supportedLocales: (process.env.NEXT_PUBLIC_SUPPORTED_LOCALES || "en")
        .split(",")
        .map((locale) => locale.trim())
        .filter((locale) => locale !== ""),
})
```

```ts
// Wrong: "false" is a non-empty string, so this is permanently true.
analyticsEnabled: Boolean(process.env.NEXT_PUBLIC_ANALYTICS_ENABLED)

// Wrong: a typo in the variable yields NaN, which then propagates silently through arithmetic
// instead of failing. Coerce with a default, or validate as in section 6.
retryCount: Number(process.env.NEXT_PUBLIC_API_RETRY_COUNT)

// Wrong: shape leaked to the consumer — now every call site owns the parsing, and they will drift.
const locales = publicEnv().supportedLocales.split(",")
```

A default is legitimate only when the fallback is **also correct in production**: a retry count, a
timeout, a page size, a feature flag that is off. A URL, a tenant id, or anything identifying an
external system must not have one, because a default there means production quietly points at
localhost and nothing complains. Those belong to section 6.

---

## 6. Fail fast at boot on a missing required variable, with one error naming every one

Nygard's Fail Fast in *Release It!* is the principle: a system that cannot do its job should say so
immediately and loudly, rather than accepting work it will fail halfway through. A missing API base
URL discovered by the first user's first request is the same defect discovered in the worst possible
place.

Validate the whole set once, at module evaluation, and report **all** the missing keys together — a
validator that throws on the first one turns a single fix into four deploys.

```ts
// src/resources/env/require-env.ts
/** Throws once, listing every missing key, so a misconfigured deploy is fixed in one pass. */
export const requireEnv = <TKey extends string>(keys: ReadonlyArray<TKey>): Record<TKey, string> => {
    const missing = keys.filter((key) => !process.env[key])
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
    }
    return Object.fromEntries(keys.map((key) => [key, process.env[key]!])) as Record<TKey, string>
}

// src/resources/env/server.ts
const required = requireEnv(["SESSION_SECRET", "DATABASE_URL", "AUTH_ISSUER_URL"] as const)
export const serverEnv = () => ({
    sessionSecret: required.SESSION_SECRET,
    databaseUrl: required.DATABASE_URL,
    authIssuerUrl: required.AUTH_ISSUER_URL,
})
```

```ts
// Wrong: a non-null assertion, which the Google TypeScript Style Guide names as a habit to drop.
// It silences the type system and produces `undefined` at runtime with no message.
sessionSecret: process.env.SESSION_SECRET!

// Wrong: a fake default over a required value. The app boots, points at the wrong system,
// and the failure surfaces somewhere unrelated hours later.
authIssuerUrl: process.env.AUTH_ISSUER_URL || "http://localhost:8080/realms/dev"
```

A schema validator (zod, valibot, envalid) is the same rule with better error messages and free
coercion; the requirement is not the library, it is that the check runs at boot and aggregates.

**Machine-checkable.** `tsc --strict` plus a lint ban on `!` (`@typescript-eslint/no-non-null-assertion`)
removes the first wrong form; the boot-time check itself is the gate for the second, and it should
run in CI against the production variable set, not only on a developer machine.

---

## 7. `.env.example` is the contract; a filled `.env` is never committed

12-Factor III's strict separation of config from code means the values live in the environment and
the **keys** live in the repository. Commit an example file listing every variable the config module
reads, with empty or obviously-fake values and a one-line comment on each. It is the only
documentation of the deployment contract that has any chance of staying current, because a new
required key that is not in it breaks the next person's first boot.

```bash
# .env.example — committed. Every key the config modules read appears here, with no real value.

# Absolute base URL of the HTTP API. Required.
NEXT_PUBLIC_API_HTTP_URL=http://localhost:3001
# Signing secret for session cookies. Required. Generate with: openssl rand -hex 32
SESSION_SECRET=
# OIDC issuer URL. Required — no default, a wrong value here authenticates against the wrong realm.
AUTH_ISSUER_URL=
```

The `.gitignore` entry for `.env` and `.env.*.local` is not optional, and a value that has ever been
committed is compromised: rotate it rather than removing it in a follow-up commit, because the
history keeps it.

**Machine-checkable, and worth the twenty lines.** A CI step that greps the config modules for
`process.env.X` and asserts every key appears in `.env.example` catches the drift that otherwise gets
found by whoever clones next.

---

## 8. Environments differ by configuration value, not by branches in the code

12-Factor X asks for the smallest possible gap between development and production. The failure it
guards against is not the config file; it is the `if (isProduction)` scattered through feature code,
because every one of those is a path that development never runs and therefore never tests.

Compute the environment flag once, in config, and let features read a **capability** rather than an
environment name.

```ts
// Right: the feature reads what it needs to know, and any environment can be configured either way.
export const publicEnv = () => ({
    analyticsEnabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true",
    showDebugPanel: process.env.NEXT_PUBLIC_DEBUG !== "false",
})

if (publicEnv().analyticsEnabled) trackPageView(pathname)

// Wrong: an environment name in feature code. The production path is now untestable locally, and
// the next environment (staging, preview, e2e) needs this line edited rather than configured.
if (process.env.NODE_ENV === "production") trackPageView(pathname)
```

The exception that stays legitimate is infrastructure wiring at the edge — error reporting, log
level, source maps — where the behaviour genuinely belongs to the environment rather than to a
feature. Keep those in the config module or the framework's own configuration file, and out of
components.
