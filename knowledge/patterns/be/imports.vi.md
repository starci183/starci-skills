# Import

Tệp này trả lời một câu hỏi: cho một tệp backend, nó được import gì, qua đường dẫn nào, theo kiểu
nào, và theo thứ tự nào?

Nguồn: `tsconfig.json` (`paths`), `jest.config.ts` (`moduleNameMapper`), `eslint.config.mjs`,
`features/api/core/graphql/mutations/courses/add-to-cart/*`,
`features/api/core/graphql/queries/courses/course/course.handler.ts`,
`modules/platform/exceptions/errors/ai/ai-quota-exhausted.ts`,
`modules/platform/exceptions/filters/abstract-exception-http.filter.ts`.

## BE-IMPORTS-1 — Alias

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Một năng lực | `@modules/<capability>/<đường dẫn sâu tới tệp>` — `import { ICQRSHandler } from "@modules/platform/cqrs/icqrs-handler"` |
| Trường hợp 2 | Một cánh cửa | `@features/<door>/…` (dùng từ `apps/` và kiểm thử) |
| Trường hợp 3 | Trợ giúp kiểm thử | `import { makeEntityManagerMock } from "@tests/mocks/entity-manager.mock"` |
| Trường hợp 4 | Trong một đơn vị | `./add-to-cart.command`, `./graphql-types/request`, `./add-to-cart.service` |
| Trường hợp 5 | Ngược lên trong cùng cánh cửa | `import { ExecuteParams } from "../../../../types/execute"` — 290 tệp dưới `features` dùng đường dẫn tương đối này; 0 tệp dùng `@features/api/core/types/execute` (lint `no-self-module-alias`) |
| Trường hợp 6 | Trong cây exception | `import { AbstractException } from "../abstract"` |

## BE-IMPORTS-2 — Kiểu ngoặc

Mọi import đều nhiều dòng, một binding mỗi dòng, dấu phẩy cuối. Lint `object-curly-newline` với
`ImportDeclaration: "always"` ép điều này.

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Một binding | `import {\n    Injectable,\n} from "@nestjs/common"` |
| Trường hợp 2 | Nhiều binding | `import {\n    CommandHandler,\n    ICommandHandler,\n} from "@nestjs/cqrs"` |
| Trường hợp 3 | Chỉ kiểu | `import type {\n    EntityManager,\n} from "typeorm"`; `import type {\n    AbstractExceptionMetadata,\n} from "../abstract"` (1388 trên 4463 tệp dùng `import type`) |

## BE-IMPORTS-3 — Thứ tự

Không bị lint ép. Import đầu tiên chiếm ưu thế trong tệp đơn vị GraphQL là framework Nest.

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Framework trước | `@nestjs/graphql`, `@nestjs/common`, `@nestjs/cqrs` (import đầu tiên ở 303 trên 398 tệp GraphQL được lấy mẫu) |
| Trường hợp 2 | Rồi năng lực | `@modules/api/…`, `@modules/integrations/…`, `@modules/platform/…`, `@modules/databases/…` (46 tệp bắt đầu ở đây) |
| Trường hợp 3 | Rồi tương đối | `../../../../types/execute` (41 tệp bắt đầu ở đây), rồi `./…` sau cùng (7) |
| Trường hợp 4 | Lệch | `add-to-cart.handler.ts` mở bằng `@modules/platform/cqrs/icqrs-handler` và xen `@nestjs/common` sau nhiều import `@modules`; thứ tự trên là ưu thế, không phải toàn thể |

## BE-IMPORTS-4 — Chiều phân tầng

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | `features` → `modules` | luôn được phép: handler import entity, exception, decorator từ `@modules/…` |
| Trường hợp 2 | `modules` → `features` | không được phép (lint `no-capability-imports-features`); 6 tệp không phải spec dưới `modules/bussiness/{daily-quest,flashcard,kpi-reward,streak,weekly-challenge}` vẫn làm vậy — ghi nhận là nợ, không phải mẫu |
| Trường hợp 3 | `modules/**/*.module.ts` → module khác trong repo | không import; module năng lực được đăng ký `isGlobal: true` ở gốc app (lint `no-non-global-module-import`, ở mức error cho cả `src/modules` lẫn `src/features`) |
| Trường hợp 4 | Barrel thư mục | không tồn tại để import; mọi import gọi thẳng tên tệp (lint `must-deep-module-import`, `no-folder-reexport`) |
| Trường hợp 5 | Thoát tương đối qua năng lực khác | `from "../../modules/…"` xuất hiện ở 0 tệp (lint `no-relative-capability-escape`) |

## BE-IMPORTS-5 — Một đơn vị GraphQL import gì

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Handler | `@modules/platform/cqrs/icqrs-handler`, entity từ `@modules/databases/postgresql/primary/entities/*.entity`, exception từ `@modules/platform/exceptions/errors/<domain>/<name>`, `@nestjs/common`, `@nestjs/cqrs`, `typeorm` (kiểu), `./<name>.command` |
| Trường hợp 2 | Resolver | `@nestjs/graphql`, `@nestjs/common`, `@modules/api/apollo/server/decorators/locale.decorators`, `@modules/api/apollo/server/interceptors/graphql-transform.interceptor`, `@modules/integrations/keycloak/guards/keycloak-auth-graphql.guard`, `@modules/integrations/keycloak/keycloak.decorators`, `@modules/platform/throttler/*`, `./graphql-types/request`, `./graphql-types/response`, `./<name>.service` |
| Trường hợp 3 | Response | `@nestjs/graphql`, `@modules/api/apollo/server/graphql-types/object-types/graphql-response`, `@modules/api/apollo/server/types/graphql-response`, entity |
| Trường hợp 4 | Module | `@nestjs/common` và bốn tệp anh em |

## BE-IMPORTS-6 — Bị cấm

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Default export | không có (lint `no-default-export`; các điểm vào vòng đời Jest được miễn) |
| Trường hợp 2 | `process.env` | chỉ `src/modules/platform/env/utils/parse-env.ts`; mọi nơi khác gọi `envConfig()` |
| Trường hợp 3 | `console.*` | lint error trong `src/**`; 188 tệp ghi log qua `WinstonService`, còn sót 12 chỗ `console.` |
| Trường hợp 4 | `Logger` của Nest | không dùng (lint `no-nest-logger`, `no-framework-logger`) |
| Trường hợp 5 | Token cache thô ngoài module cache | lint `must-use-cache-service` |

## BE-IMPORTS-7 — Jest nhìn thấy cùng alias

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | `jest.config.ts` | `moduleNameMapper: { "^@modules/(.*)$": "<rootDir>/src/modules/$1", "^@features/(.*)$": "<rootDir>/src/features/$1", "^@tests/(.*)$": "<rootDir>/src/tests/$1" }` |
| Trường hợp 2 | Spec giả lập một đường dẫn module | `jest.mock("@modules/platform/env/config", () => ({ envConfig: () => ({ … }) }))` |
