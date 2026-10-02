# lite-app

One StarCi lite app: a Nest API in `be/`, one Next web app in `fe/`, and Supabase as the schema authority.

## Overview

The starter keeps one deployable API and one web app. The browser uses only the public Supabase client under row-level security; privileged Auth and Storage operations stay behind the API.

## Stack

TypeScript everywhere, NestJS in `be/`, Next.js with next-intl in `fe/`, Supabase for Auth and PostgreSQL, npm workspaces, and Turbo for front-end tasks.

## Repository layout

- `supabase/`: local configuration, forward-only SQL migrations, seed data, and generated database types.
- `be/`: the API, shared platform capabilities, verified identity admission, and privileged Supabase integrations.
- `fe/`: the web app; all Supabase access is owned by `src/modules/db`.
- `.starcistacks/`: value-free environment metadata and encrypted-secret custody.
- `.starciwork/`: product workspace, brand, and shell records.

## Development

```sh
npm install
npm run contract:emit
npm run typecheck
npm run lint
npm run build:be
npm run build:fe
```

The API reads `PORT`, `HTTP_SECURITY_ALLOWED_ORIGINS`, `PRIMARY_DB_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. The web app reads `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Missing configuration stops the relevant process with a named error; no template supplies credential defaults.

## Database changes

Create a forward-only migration under `supabase/migrations`, keep each table's RLS policies and grants beside the table, and run `npm run contract:emit` to refresh `supabase/types/database.types.ts`.

## Work

The product's Work records live in `.starciwork`.
