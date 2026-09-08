# Folder

This file answers one question: given a piece of backend code, which directory and which file
name does it get?

Sources: `src/features/api/core/graphql/mutations/courses/add-to-cart/*`,
`src/features/api/core/graphql/queries/courses/course/*`,
`src/features/api/core/graphql/mutations/courses/courses.module.ts`,
`src/modules/platform/{winston,throttler,exceptions}/`, `src/modules/ai/`,
`src/modules/databases/postgresql/primary/{entities,enums}/`, `src/tests/`, `jest.config.ts`.

## BE-FOLDER-1 — Two roots

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A door the outside world calls | `src/features/<door>/` — `api`, `socketio`, `cli`, `backup`, `mock`, `video-encoder` |
| Case 2 | A capability doors compose | `src/modules/<capability>/` — `ai`, `api`, `bussiness`, `crypto`, `databases`, `filesystem`, `init`, `integrations`, `lib`, `membership`, `platform`, `playground-agent-core` |
| Case 3 | Test infrastructure | `src/tests/{e2e,fixtures,harness,helpers,mocks}/` — e.g. `src/tests/mocks/entity-manager.mock.ts` |
| Case 4 | Composition root | `apps/core/src/app.module.ts` (registers `AbstractExceptionHttpFilter` as `APP_FILTER`) |

## BE-FOLDER-2 — One GraphQL unit

A mutation or query is one kebab-case folder under its domain. The file set is fixed.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Mutation unit `mutations/courses/add-to-cart/` | `add-to-cart.command.ts` · `add-to-cart.handler.ts` · `add-to-cart.handler.spec.ts` · `add-to-cart.service.ts` · `add-to-cart.resolver.ts` · `add-to-cart.module.ts` · `add-to-cart.module-definition.ts` · `graphql-types/request.ts` · `graphql-types/response.ts` |
| Case 2 | Query unit `queries/courses/course/` | `course.query.ts` · `course.handler.ts` · `course.handler.spec.ts` · `course.service.ts` · `course.resolver.ts` · `course.resolver.spec.ts` · `course.module.ts` · `course.module-definition.ts` · `graphql-types/request.ts` · `graphql-types/response.ts` |
| Case 3 | Shared GraphQL objects | `features/api/core/graphql/shared/…` (`*.object.ts`, 14) |

Counts under `features/api/core/graphql`: `.module.ts` 338, `.module-definition.ts` 336,
`.resolver.ts` 305, `.service.ts` 203, `.handler.ts` 129, `.handler.spec.ts` 104, `.query.ts` 64,
`.command.ts` 62, `.resolver.spec.ts` 59.

## BE-FOLDER-3 — Domain aggregator

| Case | When | Write |
| --- | --- | --- |
| Case 1 | The domain folder | `mutations/courses/courses.module.ts` + `courses.module-definition.ts` beside the unit folders `add-to-cart/`, `clear-cart/`, `course-enroll/`, … |
| Case 2 | Registration | `AddToCartSingleMutationModule.register({ … })` listed inside `courses.module.ts`; import alone is not registration |
| Case 3 | Top aggregators | `mutations/mutations.module.ts`, `queries/queries.module.ts`, `graphql/graphql.module.ts`, `core/core.module.ts`, `api/api.module.ts`, each with a `.module-definition.ts` |

## BE-FOLDER-4 — One capability module

| Case | When | Write |
| --- | --- | --- |
| Case 1 | `modules/platform/winston/` | `winston.module.ts` · `winston.module-definition.ts` · `winston.service.ts` · `winston.service.spec.ts` · `winston.providers.ts` · `winston.providers.spec.ts` · `winston.decorators.ts` · `config.ts` · `constants/` · `enums/` · `types/` · `utils/` |
| Case 2 | `modules/platform/throttler/` | `throttler.module.ts` · `throttler.module-definition.ts` · `throttler.decorators.ts` · `config.ts` · `types.ts` · `enums/` · `guards/` · `types/` · `utils/` |
| Case 3 | `modules/ai/` | `ai.module.ts` · `ai.module-definition.ts` · `ai-entitlement.service.ts` (+ `.spec.ts`) · `ai-invoke.service.ts` · `constants/ai-entitlement.constants.ts` · `balancer/` · `ping/` · `types/` · `utils/` |
| Case 4 | Helper | `modules/bussiness/projections/user-stats/kpi-current.util.ts` (`.util.ts` beside its `types.ts`) |

Counts under `src/modules`: `.service.ts` 396, `.service.spec.ts` 271, `.entity.ts` 197,
`.module.ts` 116, `.module-definition.ts` 115, `.listener.ts` 18, `.providers.ts` 16,
`.decorators.ts` 16, `.guard.ts` 11.

## BE-FOLDER-5 — Exceptions have one home

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Any exception class | `src/modules/platform/exceptions/errors/<domain>/<name>.ts` — 294 files across `ai/ api/ backup/ bento4/ cache/ cli/ coding/ community/ courses/ …` (lint `exception-in-errors-folder`) |
| Case 2 | The base | `errors/abstract.ts` |
| Case 3 | Transport mapping | `exceptions/filters/abstract-exception-http.filter.ts` (+ `.spec.ts`) |
| Case 4 | Enums used by exceptions | `exceptions/enums/ensure.ts`, `exceptions/enums/job.ts` |
| Case 5 | Legacy suffix | five files still end in `.exception.ts` under `errors/mixin/`; the 289 others carry no suffix |

## BE-FOLDER-6 — Data

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Entity | `modules/databases/postgresql/primary/entities/cart-item.entity.ts` (197 `.entity.ts`, 92 with `.entity.spec.ts`); base `entities/abstract.ts`, `abstract-projection.ts` |
| Case 2 | Enum | `modules/databases/postgresql/primary/enums/locale.ts`, `enums/action-type.ts` (76 files export an enum here) |
| Case 3 | Migration | `<timestamp>-<PascalCaseName>.ts`, e.g. `1719200000000-AddIsEnrolledToEnrollments.ts` — the only PascalCase file names in `src/` (95) |

## BE-FOLDER-7 — Tests

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Unit | `<name>.spec.ts` beside `<name>.ts` (875) |
| Case 2 | Integration | `<name>.int-spec.ts` beside its subject (7), e.g. `graphql/schema-builds.int-spec.ts` |
| Case 3 | End-to-end and harness | `src/tests/e2e/`, `src/tests/harness/` (`*.e2e-spec.ts`, `*.harness-spec.ts`; `jest-harness.json`) |
| Case 4 | Shared mocks | `src/tests/mocks/entity-manager.mock.ts` imported as `@tests/mocks/entity-manager.mock` |

## Open question

One class per exception file holds in 275 of 294 files; 19 files hold two to eight classes
(`errors/api/graphql.ts`, `errors/community/*.ts`, `errors/users/user.ts`). The single-class form
dominates and is what new files follow; the multi-class files are not declared wrong here.
