# {{project}}

One StarCi app: its back end in `be/`, its front end in `fe/`, one install at the root.

## Overview

The app starts with the core api app (`be/apps/core`) and the cli app (`be/apps/cli`) over one primary database, two Next apps (`fe/apps/landing`, the public front door, and `fe/apps/app`, the product) over the shared packages `fe/packages/{{project}}-ui` and `fe/packages/{{project}}-i18n`.

## Stack

TypeScript everywhere; NestJS in `be/`, Next.js with next-intl in `fe/`; npm with one `package.json` and one lockfile at the root.

## Repository layout

- `be/`: the back end, `be/apps/<app>/src` composes `be/src/features` and `be/src/modules`; its tests live under `be/src/tests`.
- `fe/`: the front end, one Next app per `fe/apps/<app>` and the shared workspace packages under `fe/packages/` (the ui drawings and the next-intl stack both apps call).
- `scripts/`: the app's operational scripts; `hfs.json` declares both sides.

## Status badges

Declare `ci.github.repository` and `ci.github.defaultBranch` in `.starcistacks/application-stacks.yaml` (or set the GitHub `repository` URL in `package.json`), then run `npx starci app sync --write`. Sync inserts a managed badge block after the title; `npx starci app sync --check` verifies it.

## Development

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build:be
npm run build:fe
```

The core api app reads `PORT`, `HTTP_SECURITY_ALLOWED_ORIGINS` (comma-separated origins allowed to send state-changing browser
requests) and `PRIMARY_DB_URL` at boot; every door is closed until it is marked public or sign-in is designed. The cli app reads
`PRIMARY_DB_URL`: `npm run migrate` applies the migrations of the primary database before the api starts, and
`npm run cli -- seed run` runs the dev seeds of `.starcistacks/dev/seeds` (run both from the app root). The product app reads
`NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_GRAPHQL_URL` (the back end it calls through `fe/apps/app/src/modules/api`, read once the first GraphQL operation exists), the landing `NEXT_PUBLIC_APP_URL` (the product app it hands the reader over to). A missing key stops the process with an error that names it.

Production browser build values live in `.starcistacks/application-stacks.yaml` under `environments.production.deploy.images.*.buildArgs.values`. Replace the placeholder origins for the product's `NEXT_PUBLIC_SITE_URL` and the landing's `NEXT_PUBLIC_APP_URL` with your product app's public origin before building deployment images.

## Work

The product's Work records live in `.starciwork`.
