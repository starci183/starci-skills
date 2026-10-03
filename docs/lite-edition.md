Owner: knowledge/hfs/slots.yaml
# HFS lite edition

Lite is the small-product edition of the same HFS standard. It uses the same manifest, rule catalog, lint canons, grammar,
security model and Docker canon as full. The `edition` field selects a filtered slot and rule view; it does not select a
different engine or relax rules locally.

Use lite for a product that needs one API, one Next app and Supabase, and does not yet need a test world, UAT, background
workers or event-driven infrastructure. Start with full when those capabilities are already requirements.

## Create a lite app

```sh
npx starci app scaffold <name> --edition lite
```

The scaffold creates the minimum live product and generates the `app.supabase.types` artifact from the app's local Supabase
stack. Docker must be available. If type generation fails, the command removes the app it began rather than leaving a partial
scaffold.

## The tree in words

The app is still one monorepo. The `app.sides` slot contains a back-end side and a front-end side. Lite starts with one
`be.app.api` owner and one `fe.app.next` owner; it creates no shared front-end package until the product upgrades and grows.

Supabase is an app-level concern because both sides depend on it. `app.supabase.migrations` is the schema authority and
`app.supabase.types` is the committed generated contract. Front-end access belongs to `fe.modules.db`; back-end administrative
integration belongs to `be.integrations.supabase`. The slot manifest remains the source for every concrete location.
The types file starts with the digest of the migrations it was generated from. The managed codegen step is offline: it
only compares that digest with the migrations and refuses missing or stale types, so lint, typecheck, build and CI need no stack.
Regenerating the types (`starci app emit`) is the one step that starts the local stack.

## Database, authentication and storage

R213 requires ordered, immutable, parseable migrations. R214 requires each exposed table to enable row-level security and to
declare its policies and grants in the same migration; dynamic DDL is forbidden so the checker can see every statement.

The browser uses only the public URL, anon key and the user's access token. R217 keeps Supabase clients behind the front-end
database owner and requires generated `Database` types. R218 requires bounded reads and explicit error handling through
`Outcome`, without result casts or hand-written result generics.

Server-side identity is verified, never inferred from an unverified session. R219 requires claims for ordinary authorization
and a fresh user lookup for sensitive mutations. The back end verifies the access token against the project JWKS and reaches
Postgres through the shared `EntityManager` using a dedicated least-privilege application role.

Anything that must bypass RLS is a guarded back-end use case or a carefully scoped security-definer database function. The
service-role credential never enters the front-end process. R220 keeps all secret material in sealed custody and forbids it
from product source.

Storage buckets are private by default, bounded by size and MIME type, and protected by policies scoped to an ownership prefix.
Browser uploads use a user-scoped client or a signed upload URL; private downloads use signed URLs. Public buckets require an
explicit public name. Supabase Edge Functions are not part of lite.

## Add product capabilities

- `starci app add table <name> [--fe] [--no-types]` adds a migration and the matching back-end capability. `--fe` adds typed
  front-end readers and writers. Types regenerate by default; `--no-types` deliberately skips that step.
- `starci app add cli <group>` creates the optional cli app on first use, including the built-in migration and seed groups, and then
  adds the requested group without test files.
- `starci app add app <name>` refuses in lite because lite has exactly one front-end app. Upgrade before adding another.
- `starci app emit` writes the enabled back-end snapshots and the `app.supabase.types` artifact. The local Supabase stack
  must be running for type generation.

An `add` or `new` command whose target slot is unavailable in lite stops before writing with `<verb> <noun>: full edition only`.
This is a capability boundary, not an allowlist of command names.

## Upgrade to full

First inspect the additions and the remaining full-edition findings:

```sh
starci app upgrade --edition full --plan
npx starci app check --edition full
```

The plan is read-only. The check also writes nothing; add `--db-types` when a local Supabase stack is running and a fresh types
comparison is required.

Apply the plan with:

```sh
starci app upgrade --edition full
```

The upgrade adds the full-only managed configuration, test layers and required cli support. It does not rewrite product source
or move the Supabase schema authority. The first full check intentionally reports tests that the product still needs to author;
the upgrade never creates placeholder tests. Downgrade from full to lite is not supported.

## What lite forbids

R212 forbids test files, test scripts and dependencies, test-tool configuration, UAT records, worker apps, event machinery,
queues, jobs, projections, sagas and realtime back-end kinds. Lite also forbids Edge Functions and a second front-end app.

R213 to R216 forbid a second schema authority, dynamic database DDL, unsafe policies or definer functions, unchecked database
configuration and stale generated types. R217 to R220 forbid Supabase access outside its owners, untyped or swallowed results,
unverified principals, front-end service-role use and plaintext credentials.
