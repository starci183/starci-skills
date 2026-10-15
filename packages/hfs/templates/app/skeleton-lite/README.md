# {{project}}

One StarCi lite app: a Nest API in `be/`, one Next web app in `fe/`, and Supabase as the schema authority.

## Overview

The starter keeps one deployable API and one web app, with the same code structure as a full app: the web app calls the API over GraphQL (`fe/apps/web/src/modules/api`, SWR hooks under `fe/apps/web/src/hooks/swr`) and uses Supabase only for Auth in the browser (`fe/apps/web/src/modules/auth`); every data read and write goes through the API, which verifies the access token.

## Stack

TypeScript everywhere, NestJS in `be/`, Next.js with next-intl in `fe/`, Supabase for Auth and PostgreSQL, npm workspaces, and Turbo for front-end tasks.

## Repository layout

- `supabase/`: local configuration, forward-only SQL migrations, seed data, and generated database types.
- `be/`: the API, shared platform capabilities, verified identity admission, and privileged Supabase integrations.
- `fe/`: the web app; the only Supabase client is the Auth client of `fe/apps/web/src/modules/auth`, data goes through `fe/apps/web/src/modules/api`.
- `.starcistacks/`: value-free environment metadata and encrypted-secret custody.
- `.starciwork/`: `.gitignore`, `.starciwork/workspace.yaml` project metadata and repo roles, and optional brand drawing records, references, and assets.

## Development

```sh
npm install
npm run contract:emit
npm run typecheck
npm run lint
npm test
npm run build:be
npm run build:fe
```

The API reads `PORT`, `HTTP_SECURITY_ALLOWED_ORIGINS`, `PRIMARY_DB_URL`, `PRIMARY_DB_SCHEMA`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. The web app reads `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and, once the first GraphQL operation exists, `NEXT_PUBLIC_GRAPHQL_URL`. Missing configuration stops the relevant process with a named error; no template supplies credential defaults.

`npm test` runs the back end's unit specs with per-file coverage. Optional integration specs run with `npm run test:integration` against the local Supabase stack (`npm run db:start`); a lite app has no e2e world.

The public runtime template tracks only sealed member names. Scaffolding creates this app's own age recipient and encrypts generated placeholder values into the declared `.starcistacks/<environment>/secrets/*.enc` members. Keep the matching host age identity in untracked local custody, then use `starci app secret set` to replace each placeholder with an actual value before deployment. Product apps retain sealed member custody. Runtime specs use disposable copies with ephemeral identities and remove them afterwards.

## Database changes

Create a forward-only migration under `supabase/migrations`, keep each table's RLS policies and grants beside the table, and run `npm run contract:emit` to refresh `supabase/types/database.types.ts`. `starci app add table <name> --fe` adds the table with its GraphQL feature on the API and its operations and SWR hooks in the web app; `npm run codegen:graphql` regenerates the web app's wire types from `be/contracts/<app>/schema.graphql`.

## Work

Brand records live in `.starciwork/brand/`. `.starciwork/workspace.yaml` supplies the project id and repo roles so Work tools
can locate the app root and map brand records to the front end. Lite permits this metadata without brand records; the tree
is required only when brand records exist, and workspace metadata remains optional.
