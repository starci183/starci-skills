# Kiểm thử

Tệp này trả lời một câu hỏi: cho một đơn vị frontend, spec của nó nằm đâu, khẳng định gì, và
để yên điều gì?

Nguồn: `src/components/pages/CartPage/index.spec.tsx`,
`pages/CodingDomainPage/component.spec.tsx`, `blocks/commerce/CartBlock/index.spec.tsx`,
`hooks/index.ts`, `packages/grammar/src/**/*.spec.tsx`, `packages/grammar/src/**/*.test.mjs`,
script trong `package.json` (`vitest run`).

## FE-TEST-1 — Vị trí

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Nửa thuần | `component.spec.tsx` cạnh `component.tsx` (55 block, 42 page) |
| Case 2 | Nửa nối | `index.spec.tsx` cạnh `index.tsx` (61 block, 24 page, 19 leaf) |
| Case 3 | Hook | `useQueryCourseSwr.spec.ts` cạnh hook |
| Case 4 | Chuỗi class | `classNames.spec.ts` cạnh `classNames.ts` (2 trong block); chứng minh CSS của Grammar trong `styles.spec.ts` (6) |
| Case 5 | Nơi khác | 0 trên 497 spec nằm trong thư mục `__tests__/` |
| Case 6 | Bộ chạy | `vitest`, `@testing-library/react`; `describe/it/expect/vi` import từ `"vitest"` |

## FE-TEST-2 — Spec nửa nối: giả lập các cánh cửa, khẳng định props được trao xuống

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | State giả lập được hoist | `const mocks = vi.hoisted(() => ({ input: undefined as TestInput \| undefined, token: "token" as string \| undefined, cart: { data: undefined as unknown, error: undefined as unknown, isLoading: false, mutate: vi.fn() }, … }))` |
| Case 2 | Barrel hooks | `vi.mock("@/hooks", () => ({ useQueryMyCartSwr: () => mocks.cart, useQueryCoursesCheckoutPreviewSwr: () => mocks.preview, … }))` (25 trên 61 spec index của block) |
| Case 3 | Dịch và điều hướng | `vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }))`, `vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))` |
| Case 4 | Bản sao thuần | `vi.mock("./component", () => ({ CartBlockBase: (input: TestInput) => { mocks.input = input; return <output data-testid="cart" /> } }))` |
| Case 5 | Import sau các mock | `import { CartBlock } from "./index"` đặt sau các lời gọi `vi.mock` |
| Case 6 | Khẳng định | `expect(mocks.input?.blockState).toBe("empty")`, `act(() => { mocks.input?.on.pay() })`, `expect(mocks.checkout.trigger).toHaveBeenCalledWith(expect.objectContaining({ paymentType: "payos" }))` |
| Case 7 | Đặt lại | `beforeEach(() => { vi.clearAllMocks(); mocks.input = undefined; … })` |

## FE-TEST-3 — Spec nửa thuần: vẽ fixture, khẳng định điều người đọc sẽ tìm thấy

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Vẽ | `render(<CodingDomainPageBase domain="arrays" navHome="Home" navPractice="Practice" title="Arrays" />)` |
| Case 2 | Mốc và chữ | `expect(screen.getByRole("heading", { name: "Arrays" })).toBeInTheDocument()` (185 spec dùng `getByRole`, 173 `getByText`, 60 `getByTestId`) |
| Case 3 | Chủ sở hữu con bị thay thế | `vi.mock("@/components/blocks/coding/CodingDomainStanding", () => ({ CodingDomainStanding: () => <div data-testid="domain-standing" /> }))` rồi `expect(screen.getByTestId("domain-standing")).toBeInTheDocument()` |
| Case 4 | Page ghép mà không sở hữu | `it("composes the connected cart block without owning its state", () => { render(<CartPage />); expect(screen.getByTestId("cart-block")).toHaveTextContent("cart-block") })` |
| Case 5 | Kho trạng thái | spec thuần lặp qua mảng `X_STATES` được export để vẽ từng thành viên |

## FE-TEST-4 — Tên

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | `describe` | export đang được thử: `describe("CodingDomainPageBase"`, `describe("CartBlock"`, `describe("CartPage route"` (85 trên 97 `component.spec` dùng tên `…Base`; 0 `index.spec` dùng) |
| Case 2 | `it` | một câu về hành vi: `"keeps topic anatomy while composing connected standing and problem owners"`, `"maps cart states and dispatches browse, clear and checkout actions"` |

## FE-TEST-5 — Không khẳng định

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Snapshot | 0 `toMatchSnapshot` / `toMatchInlineSnapshot` trong `src/` |
| Case 2 | Mạng | không bao giờ chạm tới; `@/hooks` bị giả lập toàn bộ, đó là lý do barrel tồn tại |
| Case 3 | Nội dung bản dịch | `useTranslations: () => (key: string) => key` — spec khẳng định khóa, không khẳng định câu chữ |
| Case 4 | Một chuỗi class nguyên văn trong spec component hoặc index | Không viết gì. Hãy khẳng định vai trò, chữ, hoặc prop được trao xuống: 215 trên 272 spec component không mang `toHaveClass` hay `className` nào. Ghim một chuỗi nguyên văn là nhân đôi thẩm quyền trình bày ra một chỗ thứ hai, nên một class dời về thang đóng sẽ làm spec đỏ vì một thay đổi đúng, còn một class ngoài thang thì bị chính spec ghim nó khoá lại. Chứng minh class đã có hai nhà riêng: `classNames.spec.ts` (2 tệp, 11 khẳng định) và `styles.spec.ts` của Grammar (6 tệp). 57 spec đang ghim là câu hỏi để ngỏ bên dưới, không phải một thực hành thứ hai |

## FE-TEST-6 — Gói Grammar

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Hành vi component | `index.spec.tsx` cạnh `index.tsx` (24) |
| Case 2 | Bản build | `common/index.test.mjs`: `import test from "node:test"` … `assert.equal(COMMON_UI_RULE_IDS.length, 117)` chạy trên `../../dist/common/index.js` |
| Case 3 | Bề mặt gói | `package-boundary.test.mjs`: `assert.deepEqual(Object.keys(packageJson.peerDependencies).sort(), ["@heroui/react", "react"])` |
| Case 4 | Chứng minh toàn họ | `core/family.spec.tsx`, `core/surface-card-family.spec.tsx`, `core/scrollable-surfaces.spec.tsx` |

## FE-TEST-7 — Phủ sóng tính theo từng nửa, và spec của nửa này không phủ nửa kia

Một unit có hai nửa là có hai đối tượng đo. Spec nối giả lập trọn `./component` (FE-TEST-2 Case 4)
còn spec thuần thay các con bằng stub (FE-TEST-3 Case 3), nên mỗi bên cố tình mù với bên kia; một
unit chỉ có một spec là có một nửa chưa được phủ, chứ không phải phủ một phần cả hai.

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Một block hay page mới có đủ hai nửa | Cả `index.spec.tsx` lẫn `component.spec.tsx`, đặt cạnh đúng tệp mà mỗi spec đo (28 trên 101 thư mục block và 22 trên 49 thư mục page hiện đã có cả hai) |
| Case 2 | Xét xem spec nối có thay được spec thuần không | Không: `vi.mock("./component", () => ({ CartBlockBase: (input) => { mocks.input = input; return <output /> } }))` thay trọn nửa thuần, nên không có gì nửa thuần render được đo |
| Case 3 | Xét xem spec thuần có thay được spec nối không | Không: nó render fixture và stub các con, nên không hook, khoá SWR, tra bản dịch hay đấu nối hành động nào được chạy |

Không phải rule này: một leaf, vốn không có `component.tsx` (FE-FOLDER-2 Case 4) nên chỉ có một spec.

## Câu hỏi để ngỏ

- 57 trên 272 spec component và index chứa `toHaveClass` hoặc `className`, trong 167 lời gọi. 215
  spec còn lại chỉ khẳng định vai trò, chữ và props được trao xuống, còn chứng minh class đã có nhà
  riêng (`classNames.spec.ts`, `styles.spec.ts`). FE-TEST-5 Case 4 ghi đa số ấy thành luật; 57 spec
  kia là một khoản nợ đứng đối lập với luật chứ không phải một thực hành thứ hai, và file này không
  nói nên xoá cái nào trước.
- FE-TEST-7 Case 1 ràng một unit mới. Nó không phải bản kiểm kê cây hiện tại: 73 trên 101 thư mục
  block và 27 trên 49 thư mục page đang có một spec chứ không phải hai, và ở đây không luật hoá một
  đợt quét khoản tồn ấy.
