# Kiểm thử

Tệp này trả lời một câu hỏi: cho một đơn vị backend, spec của nó nằm đâu, đối tượng được dựng
thế nào, khẳng định gì, và để yên điều gì?

Nguồn: `jest.config.ts`, `features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.handler.spec.ts`,
`modules/ai/ai-entitlement.service.spec.ts`,
`modules/ai/ping/classes/abstract-provider-ping.service.spec.ts`, `src/tests/**`, `eslint.config.mjs`.

## BE-TEST-1 — Vị trí và làn

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Đơn vị | `<name>.spec.ts` cạnh `<name>.ts` (875; lint `unit-test-colocated`) |
| Trường hợp 2 | Bản sao của handler | `add-to-cart.handler.spec.ts` cạnh handler (118 trên 149 handler; lint `handler-has-twin-spec`) |
| Trường hợp 3 | Bản sao của service | 271 trên 396 service dưới `src/modules` |
| Trường hợp 4 | Tích hợp | `*.int-spec.ts` (7), Testcontainers, `globalSetup: src/tests/helpers/e2e-setup.ts`, `testTimeout: 120_000` |
| Trường hợp 5 | Đầu cuối và harness | `*.e2e-spec.ts`, `*.harness-spec.ts` dưới `src/tests/<lane>`, bị loại khỏi `unit` theo hậu tố |
| Trường hợp 6 | Projects | `projects: [{ displayName: "unit", testMatch: ["**/*.spec.ts"], testPathIgnorePatterns: ["\\.int-spec\\.ts$", "\\.e2e-spec\\.ts$", "\\.harness-spec\\.ts$"] }, { displayName: "integration", testMatch: ["**/*.int-spec.ts"], … }]` |
| Trường hợp 7 | Bộ chạy | `jest` với `ts-jest` (`diagnostics: false`), `testEnvironment: "node"` |

## BE-TEST-2 — Spec handler: dựng trực tiếp, ép kiểu các mock

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Đối tượng | `const handler = new AddToCartHandler({ exists } as never)` — entity manager là một object trần gồm `jest.fn()`; `as never` xuất hiện ở 496 trên 875 spec, `as unknown as` ở 323 |
| Trường hợp 2 | Nhà máy thông điệp | `const command = (courseId: string) => new AddToCartCommand({ request: { courseId }, user: { id: "u1" } } as never)` |
| Trường hợp 3 | Câu trả lời mock theo thứ tự | `const exists = jest.fn().mockResolvedValueOnce(false)`; sau đó `exists.mockResolvedValueOnce(true).mockResolvedValueOnce(true)` |
| Trường hợp 4 | Gọi qua cửa công khai | `handler.execute(command("missing"))`, không bao giờ gọi `process` |

## BE-TEST-3 — Spec service: một testing module với mock dùng chung

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Module | `Test.createTestingModule({ … })` (274 spec) với `getEntityManagerToken(POSTGRESQL_PRIMARY)` |
| Trường hợp 2 | Entity manager | `import { makeEntityManagerMock } from "@tests/mocks/entity-manager.mock"` cùng các kiểu `EntityManagerMock`, `QueryBuilderMock` |
| Trường hợp 3 | Cấu hình | `jest.mock("@modules/platform/env/config", () => ({ envConfig: () => ({ ai: { ping: mockPingConfig } }) }))` |
| Trường hợp 4 | Lớp trừu tượng | một lớp con cục bộ: `class TestPingService extends AbstractProviderPingService { protected readonly provider = ModelProvider.OpenAI; execute = jest.fn()…; protected executePing(key: string) { return this.execute(key) } }` |
| Trường hợp 5 | Hằng fixture | UPPER_SNAKE có chú thích: `/** Free base credit caps the mocked quota config hands back (credits per window). */ const BASE_CREDITS_5H = 30` |

## BE-TEST-4 — Điều được khẳng định

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Kiểu exception | `await expect(handler.execute(command("missing"))).rejects.toBeInstanceOf(CourseNotFoundException)` (262 spec dùng `rejects.toBeInstanceOf` / `toThrow(`; 49 so khớp chuỗi thông điệp) |
| Trường hợp 2 | Thứ tự tác dụng phụ | `await expect(handler.execute(…)).rejects.toBeInstanceOf(UserNotFoundException); expect(exists).not.toHaveBeenCalled()` |
| Trường hợp 3 | Hàng được trả về | `await expect(handler.execute(command("one"))).resolves.toBe(existing)`; `.resolves.toEqual({ id: "cart-2" })` |
| Trường hợp 4 | Đối số được lưu | `expect(save).toHaveBeenCalledWith({ id: "draft" })` |
| Trường hợp 5 | Cách viết `it` | động từ đứng đầu: `throws` (83), `rejects` (65), `returns` (50), `refuses` (25), `maps`, `creates` — ví dụ `it("rejects anonymous callers before querying course state", …)` |

## BE-TEST-5 — Điều không được khẳng định

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Chỉ một lời gọi | một spec chỉ chứng minh mock đã được gọi (lint `no-call-only-spec`) |
| Trường hợp 2 | Phong bì thay vì trạng thái, trong e2e | một bước e2e khẳng định hàng đã lưu, không phải `success: true` (lint `e2e-asserts-persisted-state`) |
| Trường hợp 3 | Thời gian trôi | không `sleep` trong luồng; thăm dò trạng thái (lint `no-sleep-in-flow`) |
| Trường hợp 4 | Đầu ra mô hình thật, trong e2e | không gọi nhà cung cấp trong e2e (`no-model-call-in-e2e`); làn harness sở hữu việc đó (`harness-calls-provider-directly`) |
| Trường hợp 5 | Một nhánh trong một bước | một bước chứng minh một kết quả (lint `no-branch-in-flow-step`) |

## BE-TEST-6 — Tên và bố cục

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | `describe` | tên lớp: `describe("AddToCartHandler", () => { … })`, `describe("AbstractProviderPingService", …)` (367 `…Service`, 121 `…Handler`, 58 `…Resolver`) |
| Trường hợp 2 | Định dạng | callback xuống dòng mới: `describe("AddToCartHandler",\n    () => {` và `it("…",\n        async () => {` — luật `function-call-argument-newline: always` của repo |
| Trường hợp 3 | Import | cùng kiểu ngoặc nhiều dòng như mã nguồn; đối tượng trước, rồi exception, rồi mock |

## BE-TEST-7 — Độ phủ và miễn trừ lint

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Mẫu số độ phủ | `collectCoverageFrom: ["src/**/*.ts", "apps/**/*.ts", "!src/tests/**", "!**/*.spec.ts", "!**/*.int-spec.ts", "!**/*.e2e-spec.ts", "!**/*.harness-spec.ts", "!**/*.d.ts", "!**/main.ts"]` |
| Trường hợp 2 | Chỉ được phép trong spec | `as unknown as X`, `process.env` (dưới `src/tests/**`), `new Error(…)` trong `src/tests/**` và `apps/*/test/**` |

## Câu hỏi để ngỏ

31 trên 149 handler và 125 trên 396 service hôm nay chưa có spec kề bên. Bản sao là mẫu (luật lint
đã có); khoảng trống được ghi nhận, không được bào chữa.
