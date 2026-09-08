# Imports

This file answers one question: given a backend file, what may it import, through which path, in
which style, and in which order?

Sources: `tsconfig.json` (`paths`), `jest.config.ts` (`moduleNameMapper`), `eslint.config.mjs`,
`features/api/core/graphql/mutations/courses/add-to-cart/*`,
`features/api/core/graphql/queries/courses/course/course.handler.ts`,
`modules/platform/exceptions/errors/ai/ai-quota-exhausted.ts`,
`modules/platform/exceptions/filters/abstract-exception-http.filter.ts`.

## BE-IMPORTS-1 — Aliases

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A capability | `@modules/<capability>/<deep path to file>` — `import { ICQRSHandler } from "@modules/platform/cqrs/icqrs-handler"` |
| Case 2 | A door | `@features/<door>/…` (used from `apps/` and tests) |
| Case 3 | Test helpers | `import { makeEntityManagerMock } from "@tests/mocks/entity-manager.mock"` |
| Case 4 | Inside one unit | `./add-to-cart.command`, `./graphql-types/request`, `./add-to-cart.service` |
| Case 5 | Up the same door | `import { ExecuteParams } from "../../../../types/execute"` — 290 files under `features` use this relative path; 0 use `@features/api/core/types/execute` (lint `no-self-module-alias`) |
| Case 6 | Inside the exceptions tree | `import { AbstractException } from "../abstract"` |

## BE-IMPORTS-2 — Brace style

Every import is multi-line, one binding per line, trailing comma. Lint `object-curly-newline`
with `ImportDeclaration: "always"` enforces it.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | One binding | `import {\n    Injectable,\n} from "@nestjs/common"` |
| Case 2 | Several | `import {\n    CommandHandler,\n    ICommandHandler,\n} from "@nestjs/cqrs"` |
| Case 3 | Type only | `import type {\n    EntityManager,\n} from "typeorm"`; `import type {\n    AbstractExceptionMetadata,\n} from "../abstract"` (1388 of 4463 files use `import type`) |

## BE-IMPORTS-3 — Order

Not lint-enforced. The dominant first import in GraphQL unit files is the Nest framework.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Framework first | `@nestjs/graphql`, `@nestjs/common`, `@nestjs/cqrs` (first import in 303 of 398 sampled GraphQL files) |
| Case 2 | Then capabilities | `@modules/api/…`, `@modules/integrations/…`, `@modules/platform/…`, `@modules/databases/…` (46 files start here) |
| Case 3 | Then relative | `../../../../types/execute` (41 start here), then `./…` last (7) |
| Case 4 | Deviation | `add-to-cart.handler.ts` opens with `@modules/platform/cqrs/icqrs-handler` and interleaves `@nestjs/common` after several `@modules` imports; the order above is dominant, not universal |

## BE-IMPORTS-4 — Layering direction

| Case | When | Write |
| --- | --- | --- |
| Case 1 | `features` → `modules` | always allowed: a handler imports entities, exceptions, decorators from `@modules/…` |
| Case 2 | `modules` → `features` | not allowed (lint `no-capability-imports-features`); 6 non-spec files under `modules/bussiness/{daily-quest,flashcard,kpi-reward,streak,weekly-challenge}` still do — recorded debt, not a pattern |
| Case 3 | `modules/**/*.module.ts` → another in-repo module | not imported; capability modules are registered `isGlobal: true` at the app root (lint `no-non-global-module-import`, error in both `src/modules` and `src/features`) |
| Case 4 | Folder barrel | none exist to import; every import names a file (lint `must-deep-module-import`, `no-folder-reexport`) |
| Case 5 | Relative escape across capabilities | `from "../../modules/…"` occurs in 0 files (lint `no-relative-capability-escape`) |

## BE-IMPORTS-5 — What a GraphQL unit imports

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Handler | `@modules/platform/cqrs/icqrs-handler`, entities from `@modules/databases/postgresql/primary/entities/*.entity`, exceptions from `@modules/platform/exceptions/errors/<domain>/<name>`, `@nestjs/common`, `@nestjs/cqrs`, `typeorm` (type), `./<name>.command` |
| Case 2 | Resolver | `@nestjs/graphql`, `@nestjs/common`, `@modules/api/apollo/server/decorators/locale.decorators`, `@modules/api/apollo/server/interceptors/graphql-transform.interceptor`, `@modules/integrations/keycloak/guards/keycloak-auth-graphql.guard`, `@modules/integrations/keycloak/keycloak.decorators`, `@modules/platform/throttler/*`, `./graphql-types/request`, `./graphql-types/response`, `./<name>.service` |
| Case 3 | Response | `@nestjs/graphql`, `@modules/api/apollo/server/graphql-types/object-types/graphql-response`, `@modules/api/apollo/server/types/graphql-response`, the entity |
| Case 4 | Module | `@nestjs/common` and the four sibling files |

## BE-IMPORTS-6 — Forbidden

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Default export | none (lint `no-default-export`; Jest lifecycle entries carved out) |
| Case 2 | `process.env` | only `src/modules/platform/env/utils/parse-env.ts`; everyone else calls `envConfig()` |
| Case 3 | `console.*` | lint error in `src/**`; 188 files log through `WinstonService`, 12 residual `console.` sites |
| Case 4 | Nest `Logger` | not used (lint `no-nest-logger`, `no-framework-logger`) |
| Case 5 | Raw cache tokens outside the cache module | lint `must-use-cache-service` |

## BE-IMPORTS-7 — Jest sees the same aliases

| Case | When | Write |
| --- | --- | --- |
| Case 1 | `jest.config.ts` | `moduleNameMapper: { "^@modules/(.*)$": "<rootDir>/src/modules/$1", "^@features/(.*)$": "<rootDir>/src/features/$1", "^@tests/(.*)$": "<rootDir>/src/tests/$1" }` |
| Case 2 | Spec mocking a module path | `jest.mock("@modules/platform/env/config", () => ({ envConfig: () => ({ … }) }))` |
