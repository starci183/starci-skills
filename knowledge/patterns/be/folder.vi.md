# Thư mục

Tệp này trả lời một câu hỏi: cho một mẩu mã backend, nó nằm ở thư mục nào và mang tên tệp gì?

Nguồn: `src/features/api/core/graphql/mutations/courses/add-to-cart/*`,
`src/features/api/core/graphql/queries/courses/course/*`,
`src/features/api/core/graphql/mutations/courses/courses.module.ts`,
`src/modules/platform/{winston,throttler,exceptions}/`, `src/modules/ai/`,
`src/modules/databases/postgresql/primary/{entities,enums}/`, `src/tests/`, `jest.config.ts`.

## BE-FOLDER-1 — Hai gốc

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Một cánh cửa thế giới bên ngoài gọi vào | `src/features/<door>/` — `api`, `socketio`, `cli`, `backup`, `mock`, `video-encoder` |
| Trường hợp 2 | Một năng lực mà các cánh cửa ghép lại | `src/modules/<capability>/` — `ai`, `api`, `bussiness`, `crypto`, `databases`, `filesystem`, `init`, `integrations`, `lib`, `membership`, `platform`, `playground-agent-core` |
| Trường hợp 3 | Hạ tầng kiểm thử | `src/tests/{e2e,fixtures,harness,helpers,mocks}/` — ví dụ `src/tests/mocks/entity-manager.mock.ts` |
| Trường hợp 4 | Gốc ghép nối | `apps/core/src/app.module.ts` (đăng ký `AbstractExceptionHttpFilter` làm `APP_FILTER`) |

## BE-FOLDER-2 — Một đơn vị GraphQL

Một mutation hay query là một thư mục kebab-case dưới miền của nó. Bộ tệp là cố định.

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Đơn vị mutation `mutations/courses/add-to-cart/` | `add-to-cart.command.ts` · `add-to-cart.handler.ts` · `add-to-cart.handler.spec.ts` · `add-to-cart.service.ts` · `add-to-cart.resolver.ts` · `add-to-cart.module.ts` · `add-to-cart.module-definition.ts` · `graphql-types/request.ts` · `graphql-types/response.ts` |
| Trường hợp 2 | Đơn vị query `queries/courses/course/` | `course.query.ts` · `course.handler.ts` · `course.handler.spec.ts` · `course.service.ts` · `course.resolver.ts` · `course.resolver.spec.ts` · `course.module.ts` · `course.module-definition.ts` · `graphql-types/request.ts` · `graphql-types/response.ts` |
| Trường hợp 3 | Đối tượng GraphQL dùng chung | `features/api/core/graphql/shared/…` (`*.object.ts`, 14) |

Số đếm dưới `features/api/core/graphql`: `.module.ts` 338, `.module-definition.ts` 336,
`.resolver.ts` 305, `.service.ts` 203, `.handler.ts` 129, `.handler.spec.ts` 104, `.query.ts` 64,
`.command.ts` 62, `.resolver.spec.ts` 59.

## BE-FOLDER-3 — Bộ gom theo miền

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Thư mục miền | `mutations/courses/courses.module.ts` + `courses.module-definition.ts` bên cạnh các thư mục đơn vị `add-to-cart/`, `clear-cart/`, `course-enroll/`, … |
| Trường hợp 2 | Đăng ký | `AddToCartSingleMutationModule.register({ … })` liệt kê trong `courses.module.ts`; import suông không phải đăng ký |
| Trường hợp 3 | Các bộ gom cấp trên | `mutations/mutations.module.ts`, `queries/queries.module.ts`, `graphql/graphql.module.ts`, `core/core.module.ts`, `api/api.module.ts`, mỗi cái có `.module-definition.ts` |

## BE-FOLDER-4 — Một module năng lực

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | `modules/platform/winston/` | `winston.module.ts` · `winston.module-definition.ts` · `winston.service.ts` · `winston.service.spec.ts` · `winston.providers.ts` · `winston.providers.spec.ts` · `winston.decorators.ts` · `config.ts` · `constants/` · `enums/` · `types/` · `utils/` |
| Trường hợp 2 | `modules/platform/throttler/` | `throttler.module.ts` · `throttler.module-definition.ts` · `throttler.decorators.ts` · `config.ts` · `types.ts` · `enums/` · `guards/` · `types/` · `utils/` |
| Trường hợp 3 | `modules/ai/` | `ai.module.ts` · `ai.module-definition.ts` · `ai-entitlement.service.ts` (+ `.spec.ts`) · `ai-invoke.service.ts` · `constants/ai-entitlement.constants.ts` · `balancer/` · `ping/` · `types/` · `utils/` |
| Trường hợp 4 | Helper | `modules/bussiness/projections/user-stats/kpi-current.util.ts` (`.util.ts` cạnh `types.ts` của nó) |

Số đếm dưới `src/modules`: `.service.ts` 396, `.service.spec.ts` 271, `.entity.ts` 197,
`.module.ts` 116, `.module-definition.ts` 115, `.listener.ts` 18, `.providers.ts` 16,
`.decorators.ts` 16, `.guard.ts` 11.

## BE-FOLDER-5 — Exception có một nhà duy nhất

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Mọi lớp exception | `src/modules/platform/exceptions/errors/<domain>/<name>.ts` — 294 tệp trong `ai/ api/ backup/ bento4/ cache/ cli/ coding/ community/ courses/ …` (lint `exception-in-errors-folder`) |
| Trường hợp 2 | Lớp gốc | `errors/abstract.ts` |
| Trường hợp 3 | Ánh xạ vận chuyển | `exceptions/filters/abstract-exception-http.filter.ts` (+ `.spec.ts`) |
| Trường hợp 4 | Enum mà exception dùng | `exceptions/enums/ensure.ts`, `exceptions/enums/job.ts` |
| Trường hợp 5 | Hậu tố cũ | năm tệp vẫn kết thúc bằng `.exception.ts` dưới `errors/mixin/`; 289 tệp còn lại không có hậu tố |

## BE-FOLDER-6 — Dữ liệu

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Entity | `modules/databases/postgresql/primary/entities/cart-item.entity.ts` (197 `.entity.ts`, 92 có `.entity.spec.ts`); gốc `entities/abstract.ts`, `abstract-projection.ts` |
| Trường hợp 2 | Enum | `modules/databases/postgresql/primary/enums/locale.ts`, `enums/action-type.ts` (76 tệp export enum ở đây) |
| Trường hợp 3 | Migration | `<timestamp>-<PascalCaseName>.ts`, ví dụ `1719200000000-AddIsEnrolledToEnrollments.ts` — tên tệp PascalCase duy nhất trong `src/` (95) |

## BE-FOLDER-7 — Kiểm thử

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Đơn vị | `<name>.spec.ts` cạnh `<name>.ts` (875) |
| Trường hợp 2 | Tích hợp | `<name>.int-spec.ts` cạnh đối tượng của nó (7), ví dụ `graphql/schema-builds.int-spec.ts` |
| Trường hợp 3 | Đầu cuối và harness | `src/tests/e2e/`, `src/tests/harness/` (`*.e2e-spec.ts`, `*.harness-spec.ts`; `jest-harness.json`) |
| Trường hợp 4 | Mock dùng chung | `src/tests/mocks/entity-manager.mock.ts` import dưới tên `@tests/mocks/entity-manager.mock` |

## Câu hỏi để ngỏ

Một lớp cho một tệp exception đúng ở 275 trên 294 tệp; 19 tệp chứa từ hai đến tám lớp
(`errors/api/graphql.ts`, `errors/community/*.ts`, `errors/users/user.ts`). Dạng một lớp chiếm ưu
thế và là điều tệp mới đi theo; các tệp nhiều lớp không bị tuyên là sai ở đây.
