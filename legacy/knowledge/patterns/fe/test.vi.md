# Kiểm thử

Tệp này trả lời một câu hỏi: cho một đơn vị frontend, spec của nó nằm đâu, khẳng định gì, và
để yên điều gì?

Nguồn: `src/components/pages/CartPage/index.spec.tsx`,
`pages/CodingDomainPage/component.spec.tsx`, `blocks/commerce/CartBlock/index.spec.tsx`,
`hooks/index.ts`, `packages/grammar/src/**/*.spec.tsx`, `packages/grammar/src/**/*.test.mjs`,
script trong `package.json` (`vitest run`), và
[bằng chứng gom nhà](../../../tests/evidence/20260903-consolidation.md) cho phần kiểm kê đứng sau
FE-TEST-1 Case 7.

Một rule đã nghỉ ở đây: `FE-TEST-7` gộp vào `FE-TEST-1` Case 7, vì "spec nằm đâu" và "spec đo nửa nào"
là một luật về một chỗ đặt. Số của nó không được dùng lại.

## FE-TEST-1 — Vị trí

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Nửa thuần | `component.spec.tsx` cạnh `component.tsx` (55 block, 42 page) |
| Case 2 | Nửa nối | `index.spec.tsx` cạnh `index.tsx` (61 block, 24 page, 19 leaf) |
| Case 3 | Hook | `useQueryCourseSwr.spec.ts` cạnh hook |
| Case 4 | Chuỗi class | `classNames.spec.ts` cạnh `classNames.ts` (2 trong block); chứng minh CSS của Grammar trong `styles.spec.ts` (6) |
| Case 5 | Nơi khác | 0 trên 497 spec nằm trong thư mục `__tests__/` |
| Case 6 | Bộ chạy | `vitest`, `@testing-library/react`; `describe/it/expect/vi` import từ `"vitest"` |
| Case 7 | Một unit mới có đủ hai nửa (FE-FUNCTION-4) | Cả hai tệp ở trên, mỗi nửa một tệp. Không bên nào thay được bên kia: spec nối thay trọn nửa thuần (FE-TEST-2 Case 4) còn spec thuần stub các con của nó (FE-TEST-3 Case 3), nên một unit chỉ mang một spec là có một nửa chưa được phủ chứ không phải phủ một phần cả hai. Một leaf không có nửa thuần nên chỉ một spec (FE-FOLDER-2 Case 4) |

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
| Case 4 | Một chuỗi class nguyên văn trong spec component hoặc index | Không viết gì. Hãy khẳng định vai trò, chữ, hoặc prop được trao xuống. Ghim một chuỗi nguyên văn là nhân đôi thẩm quyền trình bày ra một chỗ thứ hai, nên một class dời về thang đóng sẽ làm spec đỏ vì một thay đổi đúng, còn một class ngoài thang thì bị chính spec ghim nó khoá lại. Chứng minh class đã có nhà riêng: `classNames.spec.ts` đặt cạnh chính chuỗi nó chứng minh, và spec style của gói Grammar. Những spec vẫn ghim một chuỗi nguyên văn là câu hỏi để ngỏ bên dưới, không phải một thực hành thứ hai |

## FE-TEST-6 — Gói Grammar

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Hành vi component | `index.spec.tsx` cạnh `index.tsx` (24) |
| Case 2 | Bản build | `common/index.test.mjs`: `import test from "node:test"` … `assert.equal(COMMON_UI_RULE_IDS.length, 117)` chạy trên `../../dist/common/index.js` |
| Case 3 | Bề mặt gói | `package-boundary.test.mjs`: `assert.deepEqual(Object.keys(packageJson.peerDependencies).sort(), ["@heroui/react", "react"])` |
| Case 4 | Chứng minh toàn họ | `core/family.spec.tsx`, `core/surface-card-family.spec.tsx`, `core/scrollable-surfaces.spec.tsx` |

## Câu hỏi để ngỏ

- Một thiểu số spec component và index vẫn ghim chuỗi class nguyên văn. FE-TEST-5 Case 4 ghi đa số
  thành luật và coi phần còn lại là một khoản nợ đối lập với luật chứ không phải một thực hành thứ
  hai; file này không nói nên xoá cái nào trước. Số đếm nằm ở
  [bằng chứng gom nhà](../../../tests/evidence/20260903-consolidation.md).
- FE-TEST-1 Case 7 ràng một unit mới. Nó không phải bản kiểm kê cây hiện tại: phần lớn unit đang có
  một spec chứ không phải hai, và ở đây không luật hoá một đợt quét khoản tồn ấy.
