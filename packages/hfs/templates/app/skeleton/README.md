# {{project}}

One StarCi app: its back end in be/, its front end in fe/, one install at the root.

## Overview

The app starts with one api app (be/apps/api), one Next app (fe/apps/web) and the liveness probe both serve.

## Stack

TypeScript everywhere; NestJS in be/, Next.js with next-intl in fe/; npm with one package.json and one lockfile at the root.

## Repository layout

- `be/`: the back end, `apps/<app>/src` composes `src/features` and `src/modules`; its tests live under `src/tests`.
- `fe/`: the front end, one Next app per `apps/<app>`.
- `scripts/`: the app's operational scripts; `hfs.json` declares both sides.

## Development

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build:be
npm run build:fe
```

## Work

The product's Work records live in `.starciwork`.
