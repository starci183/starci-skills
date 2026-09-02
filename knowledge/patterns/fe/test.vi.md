# Kiểm thử

Tệp này trả lời một câu hỏi: cho một đơn vị frontend, spec của nó nằm đâu, khẳng định gì, và
để yên điều gì?

Nguồn: `src/components/pages/CartPage/index.spec.tsx`,
`pages/CodingDomainPage/component.spec.tsx`, `blocks/commerce/CartBlock/index.spec.tsx`,
`hooks/index.ts`, `packages/grammar/src/**/*.spec.tsx`, `packages/grammar/src/**/*.test.mjs`,
script trong `package.json` (`vitest run`).

## FE-TEST-1 — Vị trí

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Nửa thuần | `component.spec.tsx` cạnh `component.tsx` (55 block, 42 page) |
| Trường hợp 2 | Nửa nối | `index.spec.tsx` cạnh `index.tsx` (61 block, 24 page, 19 leaf) |
| Trường hợp 3 | Hook | `useQueryCourseSwr.spec.ts` cạnh hook |
| Trường hợp 4 | Chuỗi class | `classNames.spec.ts` cạnh `classNames.ts` (2 trong block); chứng minh CSS của Grammar trong `styles.spec.ts` (6) |
| Trường hợp 5 | Nơi khác | 0 trên 497 spec nằm trong thư mục `__tests__/` |
| Trường hợp 6 | Bộ chạy | `vitest`, `@testing-library/react`; `describe/it/expect/vi` import từ `"vitest"` |

## FE-TEST-2 — Spec nửa nối: giả lập các cánh cửa, khẳng định props được trao xuống

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | State giả lập được hoist | `const mocks = vi.hoisted(() => ({ input: undefined as TestInput \| undefined, token: "token" as string \| undefined, cart: { data: undefined as unknown, error: undefined as unknown, isLoading: false, mutate: vi.fn() }, … }))` |
| Trường hợp 2 | Barrel hooks | `vi.mock("@/hooks", () => ({ useQueryMyCartSwr: () => mocks.cart, useQueryCoursesCheckoutPreviewSwr: () => mocks.preview, … }))` (25 trên 61 spec index của block) |
| Trường hợp 3 | Dịch và điều hướng | `vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }))`, `vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))` |
| Trường hợp 4 | Bản sao thuần | `vi.mock("./component", () => ({ CartBlockBase: (input: TestInput) => { mocks.input = input; return <output data-testid="cart" /> } }))` |
| Trường hợp 5 | Import sau các mock | `import { CartBlock } from "./index"` đặt sau các lời gọi `vi.mock` |
| Trường hợp 6 | Khẳng định | `expect(mocks.input?.blockState).toBe("empty")`, `act(() => { mocks.input?.on.pay() })`, `expect(mocks.checkout.trigger).toHaveBeenCalledWith(expect.objectContaining({ paymentType: "payos" }))` |
| Trường hợp 7 | Đặt lại | `beforeEach(() => { vi.clearAllMocks(); mocks.input = undefined; … })` |

## FE-TEST-3 — Spec nửa thuần: vẽ fixture, khẳng định điều người đọc sẽ tìm thấy

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Vẽ | `render(<CodingDomainPageBase domain="arrays" navHome="Home" navPractice="Practice" title="Arrays" />)` |
| Trường hợp 2 | Mốc và chữ | `expect(screen.getByRole("heading", { name: "Arrays" })).toBeInTheDocument()` (185 spec dùng `getByRole`, 173 `getByText`, 60 `getByTestId`) |
| Trường hợp 3 | Chủ sở hữu con bị thay thế | `vi.mock("@/components/blocks/coding/CodingDomainStanding", () => ({ CodingDomainStanding: () => <div data-testid="domain-standing" /> }))` rồi `expect(screen.getByTestId("domain-standing")).toBeInTheDocument()` |
| Trường hợp 4 | Page ghép mà không sở hữu | `it("composes the connected cart block without owning its state", () => { render(<CartPage />); expect(screen.getByTestId("cart-block")).toHaveTextContent("cart-block") })` |
| Trường hợp 5 | Kho trạng thái | spec thuần lặp qua mảng `X_STATES` được export để vẽ từng thành viên |

## FE-TEST-4 — Tên

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | `describe` | export đang được thử: `describe("CodingDomainPageBase"`, `describe("CartBlock"`, `describe("CartPage route"` (85 trên 97 `component.spec` dùng tên `…Base`; 0 `index.spec` dùng) |
| Trường hợp 2 | `it` | một câu về hành vi: `"keeps topic anatomy while composing connected standing and problem owners"`, `"maps cart states and dispatches browse, clear and checkout actions"` |

## FE-TEST-5 — Không khẳng định

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Snapshot | 0 `toMatchSnapshot` / `toMatchInlineSnapshot` trong `src/` |
| Trường hợp 2 | Mạng | không bao giờ chạm tới; `@/hooks` bị giả lập toàn bộ, đó là lý do barrel tồn tại |
| Trường hợp 3 | Nội dung bản dịch | `useTranslations: () => (key: string) => key` — spec khẳng định khóa, không khẳng định câu chữ |
| Trường hợp 4 | Chuỗi class trong spec component | thực hành chiếm ưu thế là không; xem câu hỏi để ngỏ |

## FE-TEST-6 — Gói Grammar

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Hành vi component | `index.spec.tsx` cạnh `index.tsx` (24) |
| Trường hợp 2 | Bản build | `common/index.test.mjs`: `import test from "node:test"` … `assert.equal(COMMON_UI_RULE_IDS.length, 117)` chạy trên `../../dist/common/index.js` |
| Trường hợp 3 | Bề mặt gói | `package-boundary.test.mjs`: `assert.deepEqual(Object.keys(packageJson.peerDependencies).sort(), ["@heroui/react", "react"])` |
| Trường hợp 4 | Chứng minh toàn họ | `core/family.spec.tsx`, `core/surface-card-family.spec.tsx`, `core/scrollable-surfaces.spec.tsx` |

## Câu hỏi để ngỏ

64 trên 272 spec component chứa `toHaveClass` hoặc `className`. 208 spec còn lại chỉ khẳng định
vai trò, chữ và props được trao xuống, còn chứng minh class đã có nhà riêng (`classNames.spec.ts`,
`styles.spec.ts`). Thực hành đa số được ghi lại; 64 spec kia không bị tuyên là sai ở đây.
