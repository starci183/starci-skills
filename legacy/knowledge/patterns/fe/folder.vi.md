# Thư mục

Tệp này trả lời một câu hỏi: cho một mẩu mã frontend, nó nằm ở thư mục nào và mang tên tệp gì?

Nguồn: `src/components/**` của ứng dụng tham chiếu, `src/hooks/**`, `src/modules/api/**`, `src/app/**`,
`packages/grammar/src/**`. Các con số là số tệp tại thời điểm đọc.

## FE-FOLDER-1 — Thư mục theo tầng

`src/components/` chứa tám thư mục tầng. Block được gom theo miền sản phẩm; page và leaf nằm phẳng.

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Một đơn vị hình ảnh cố định, tái dùng | `src/components/leaves/<Name>/` (40 đơn vị, phẳng) |
| Case 2 | Một đơn vị tính năng có nửa nối dữ liệu | `src/components/blocks/<domain>/<Name>/` (109 đơn vị trong 11 miền: `ai auth coding commerce community courses dashboard learn locale profile search`) |
| Case 3 | Một màn hình có route | `src/components/pages/<Name>Page/` (50 đơn vị, phẳng) |
| Case 4 | Các tầng khác đang có | `branches/`, `composites/`, `layouts/`, `overlays/`, `product-shells/` |

## FE-FOLDER-2 — Bộ tệp của một đơn vị

Một đơn vị là một thư mục PascalCase. Các tệp bên trong mang tên cố định; tên đơn vị là tên thư
mục, không bao giờ là tên tệp.

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Đơn vị page (`pages/AuthenticationPage/`) | `classNames.ts` · `component.tsx` · `index.tsx` |
| Case 2 | Đơn vị page có spec (`pages/CartPage/`) | `component.tsx` · `index.spec.tsx` · `index.tsx` |
| Case 3 | Đơn vị block (`blocks/ai/StarCiAiChat/`) | `classNames.ts` · `component.spec.tsx` · `component.tsx` · `index.spec.tsx` · `index.tsx` |
| Case 4 | Đơn vị leaf (`leaves/ButtonStateSample/`) | `classNames.ts` · `index.tsx` — leaf không có `component.tsx`, vì nó không có nửa nối dữ liệu |

Số đếm trong pages (50): `index.tsx` 49, `component.tsx` 49, `component.spec.tsx` 42,
`index.spec.tsx` 24, `audit.md` 22, `classNames.ts` 9. Trong blocks (109): `component.tsx` 101,
`index.tsx` 95, `classNames.ts` 76, `index.spec.tsx` 61, `component.spec.tsx` 55. Trong leaves
(40): `index.tsx` 40, `classNames.ts` 33, `index.spec.tsx` 19.

`classNames.ts` chỉ có mặt khi đơn vị sở hữu chuỗi class. Một page chỉ ghép block vào khung
Grammar thường không có tệp này; 9 page có tệp này đều chỉ đặt bí danh cho khung trang của Grammar:

```ts
// pages/AuthenticationPage/classNames.ts
import { cn } from "@heroui/react"
import { formPageClassName } from "@grammar/common"

/** Grammar-owned page frame; this app alias adds no visual override. */
export const authenticationPageClassName = cn(formPageClassName)
```

## FE-FOLDER-3 — Tệp route gắn đúng một page

`src/app/[lang]/**/page.tsx` là nơi duy nhất có default export (67 trong `src/app`, 0 trong
`src/components`).

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Một route | `app/[lang]/authentication/page.tsx`: `import { AuthenticationPage } from "@/components/pages/AuthenticationPage"` … `const AuthenticationRoute = () => <AuthenticationPage {...{}} />` … `export default AuthenticationRoute` |
| Case 2 | Các tệp toàn cục của app | `app/globals.css`, `app/providers.tsx`, `app/global-error.tsx`, `app/sitemap.ts`, `app/robots.ts`, mỗi tệp có `.spec` kề bên |

## FE-FOLDER-4 — Vị trí tầng dữ liệu

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Hook đọc | `src/hooks/swr/useQuery<Thing>Swr.ts` (80) kèm `.spec.ts` kề bên |
| Case 2 | Hook ghi | `src/hooks/swr/useMutate<Thing>Swr.ts` (32) kèm `.spec.ts` kề bên |
| Case 3 | Hook xác thực / socket | `src/hooks/auth/useSessionToken.ts`, `src/hooks/socketio/**` |
| Case 4 | Cánh cửa duy nhất cho component | `src/hooks/index.ts` chỉ re-export hook (docblock ghi rõ chỉ hook; kiểu, khóa cache và module truy vấn nằm sau đường dẫn riêng của chúng) |
| Case 5 | Một tài liệu GraphQL | `src/modules/api/graphql/queries/query-<thing>.ts`, `src/modules/api/graphql/mutations/mutation-<thing>.ts` |
| Case 6 | Kiểu request/response | `src/modules/api/graphql/queries/types/<thing>.ts` |
| Case 7 | Module ngoài API | `src/modules/{ai,code,learn,routing,search,theme,toast,types,utils}/` |

## FE-FOLDER-5 — Đơn vị trong gói Grammar

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Một component Grammar | `packages/grammar/src/core/<primitive|composite|branch|composition>/<Name>/index.tsx` (39 `index.tsx`) |
| Case 2 | Chuỗi class của nó | `classNames.ts` kề bên (13), ví dụ `core/branch/Rail/classNames.ts` |
| Case 3 | Spec của nó | `index.spec.tsx` kề bên (24); chứng minh CSS trong `styles.spec.ts` (6) |
| Case 4 | Cửa vào của họ | `core/index.ts`, `core/styles.css`, `core/dna.ts`; `common/index.ts` re-export `state.js`, `spacing.js`, `conformance.js`, `renderers.js`, `registry.js` |
| Case 5 | Chứng minh bản build | `common/index.test.mjs`, `core/index.test.mjs`, `package-boundary.test.mjs` (node:test chạy trên `dist/`) |

## FE-FOLDER-6 — Thứ một thư mục đơn vị không chứa

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Một component thứ hai trong cùng thư mục | Không thấy ở 87 trên 109 thư mục block; đơn vị là một export cho mỗi `index.tsx`/`component.tsx` |
| Case 2 | Chuỗi class trong `component.tsx` | Không bao giờ; chúng đi vào `classNames.ts` (lint `class-names-in-colocated-file`, `no-inline-class-name`) |
| Case 3 | Thư mục `__tests__/` | 0 trong toàn bộ `src/`; spec nằm cạnh tệp của nó |
| Case 4 | Thư mục `helpers/` hay `utils/` | 0 dưới `src/components` (lint `no-helper-folder-in-components`) |
| Case 5 | Một hằng triển khai | Không bao giờ. `process.env.NEXT_PUBLIC_*` sống dưới `src/modules/` và được với tới qua đúng module sở hữu nó. Một thư mục component đọc thẳng biến môi trường sẽ mang theo một giá trị mặc định, nên cùng một lần đổi môi trường có thêm một nhà cho mỗi thư mục đã đọc nó. Các lần xuất hiện nằm ở [bằng chứng lượt quét presentation](../../../tests/evidence/20260903-presentation-sweep.md) |

## Câu hỏi để ngỏ — hằng tiền tệ và locale

Một hằng tiền tệ hay locale không phải hằng triển khai. Bộ định dạng được dựng ngay nơi đọc locale,
nên hằng tiền tệ nằm trong nửa nối cạnh nó, và quan sát chỉ về phía ấy chứ không về một module dùng
chung — ghi ở [bằng chứng lượt quét presentation](../../../tests/evidence/20260903-presentation-sweep.md). Vì vậy FE-FOLDER-6 Case 5 chỉ phủ hằng triển
khai, còn việc một hằng tiền tệ có thuộc về một module tiền riêng hay không là quyết định của chủ sở
hữu, không phải của tệp này.

## Câu hỏi để ngỏ — tệp phụ trong thư mục block

22 tệp dưới `src/components/blocks` nằm ngoài năm tên chuẩn: cây con `blocks/profile/overview/`
(`OverviewCourses.tsx`, `SkillSnapshot.tsx`, `shared.ts`, `useOverviewEvidence.ts`, …),
`learn/CourseMockInterviewResultBlock/verdict.ts`, `profile/ProfileCvBuilder/buildCvTexSource.ts`,
và ba `classNames.spec.ts`/`styles.spec.ts`. Chưa có quy ước chiếm ưu thế cho chỗ đặt một module
helper riêng của block, nên tệp này không áp đặt.
