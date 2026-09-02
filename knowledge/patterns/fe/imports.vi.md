# Import

Tệp này trả lời một câu hỏi: cho một tệp frontend, nó được import gì, qua đường dẫn nào, và theo
thứ tự nào?

Nguồn: `tsconfig.json` (`paths`), `eslint.config.mjs`, `src/hooks/index.ts`,
`src/components/**`, `src/hooks/swr/**`.

## FE-IMPORTS-1 — Đường dẫn

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Bất cứ thứ gì dưới `src/` từ thư mục khác | `@/…` — alias duy nhất (`"@/*": ["./src/*"]`); 459 tệp dùng nó |
| Case 2 | Một đối tượng Grammar | `import { SurfaceCard, Text, Heading, Badge, Button } from "@starci/grammar/common"` (553 import, tất cả qua `/common`) |
| Case 3 | HeroUI | `import { cn } from "@heroui/react"` trong `classNames.ts` (136 trên 151); component nhà cung cấp trong leaf (48) và block (74); `component.tsx` của page không bao giờ (0/49) |
| Case 4 | Tệp trong cùng đơn vị | `./component`, `./classNames`, `./index` |
| Case 5 | Chỉ kiểu | `import type { AuthMode } from "@/hooks/auth/useAuthPanel"`, `import { type CourseDetail } from "…"` (274 tệp) |

## FE-IMPORTS-2 — Thứ tự

Không bị lint ép (không cấu hình luật `import/order`). Thứ tự chiếm ưu thế, đọc từ import đầu tiên
của 417 tệp component, là framework, rồi Grammar, rồi tầng của mình, rồi đơn vị của mình.

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Framework trước | `react` (108 tệp), `next-intl` (45), `next` / `next/navigation` (16), `swr` |
| Case 2 | Rồi Grammar | `@starci/grammar/common` (95 tệp bắt đầu ở đây khi không có import framework) |
| Case 3 | Rồi tầng của mình | `@/components/branches/…`, `@/components/leaves/…`, `@/hooks`, `@/modules/…` (88 tệp bắt đầu bằng `@/components`) |
| Case 4 | Đơn vị của mình sau cùng | `import { aiChatClassNames, getAiChatBubbleClassName } from "./classNames"`, `import { AuthenticationPageBase } from "./component"` |

`blocks/ai/StarCiAiChat/component.tsx` lại xen kẽ import `@starci/grammar/common` và
`@/components/…` theo thứ tự chữ cái của tên binding; thứ tự trên là ưu thế, không phải toàn thể.

## FE-IMPORTS-3 — Dữ liệu vào block qua barrel hooks

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Block đọc hoặc ghi | `import { useQueryCourseSwr } from "@/hooks"` (82 tệp block import `@/hooks`); docblock của barrel nói rõ block import `@/hooks`, không bao giờ `@/hooks/swr/useQuerySomethingSwr` |
| Case 2 | Hook chạm tới tầng vận chuyển | `import { queryCourse } from "../../modules/api/graphql/queries/query-course"` (57 tệp hook) hoặc `from "@/modules/api/…"` (56 tệp hook) — chia đều, xem câu hỏi để ngỏ |
| Case 3 | Một kiểu từ tầng dữ liệu | `import type { CourseAdvisorRecommendation } from "@/modules/ai/course-advisor-response"` — barrel không re-export kiểu |
| Case 4 | Danh tính xác thực | `import { useViewerKey } from "@/hooks/auth/useViewerKey"` bên trong hook; component giả lập `@/hooks/auth/useSessionToken` trong spec |

## FE-IMPORTS-4 — Chiều giữa các tầng

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Page → block | `import { AuthenticationPanel } from "@/components/blocks/auth/AuthenticationPanel"` (48 trên 50 page import block; 11 import leaf; 8 import hooks; 1 import modules) |
| Case 2 | Block → leaf, branch, Grammar, hooks, modules | `import { CodeBlock } from "@/components/leaves/CodeBlock"`, `import { Article } from "@/components/branches/Article"` (82 block import hooks, 67 import modules) |
| Case 3 | Leaf → chỉ Grammar và nhà cung cấp | `import type { ButtonVariant } from "@starci/grammar/common"`, `import { buttonVariants } from "@heroui/styles"` (1 leaf import hooks, 1 import block: ngoại lệ) |
| Case 4 | Import ngược lên | block → page thấy một lần; leaf → block thấy một lần; không cái nào là mẫu |
| Case 5 | Nửa thuần → tầng dữ liệu | không bao giờ lúc chạy; 18 tệp `component.tsx` chỉ dùng `import type` từ `@/modules/api/graphql/queries/…` |

## FE-IMPORTS-5 — Ranh giới nhà cung cấp

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Ký tự biểu tượng | chỉ leaf Icon import `@heroicons/react` (1 tệp component); mọi nơi khác nhận `Icon` của Grammar với một prop nguồn (lint `no-vendor-icon-outside-icon-leaf`, `heroicons-is-the-glyph-vendor`) |
| Case 2 | Tiêu đề | `Heading` từ Grammar, không bao giờ `<h2>` trần (lint `no-heading-tag-outside-heading-component`) |
| Case 3 | Phụ thuộc của gói Grammar | `peerDependencies` đúng là `@heroui/react` và `react`; `dependencies` rỗng (`package-boundary.test.mjs`) |

## FE-IMPORTS-6 — Re-export

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Barrel hooks | `export { useMutateAddToCartSwr } from "./swr/useMutateAddToCartSwr"` — một dòng cho mỗi hook, không `export *` |
| Case 2 | Cửa vào họ Grammar | `export { COMMON_SPACING_SCALE, COMMON_SPACING_TOKENS, type CommonSpacingStep, … } from "./spacing.js"` — có tên, kèm hậu tố `.js` |
| Case 3 | Index của block re-export bản sao | `export * from "./component"` ở cuối `index.tsx` — 19 trên 95 index block và 19 trên 49 index page làm vậy; đa số không |

## FE-IMPORTS-7 — Bị cấm

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Đường dẫn sâu tới hook từ component | `@/hooks/swr/useQueryCourseSwr` — thoát khỏi `vi.mock("@/hooks")` |
| Case 2 | Default export trong `src/components` | 0 tồn tại |
| Case 3 | Cấu hình lint nội tuyến | `eslint-disable` xuất hiện trong 0 tệp; `src/components/blocks/**/{index,component}.tsx` chạy với `noInlineConfig: true` |
| Case 4 | `namespace` | chỉ `src/modules/api/graphql/clients/options.ts`, theo ngoại lệ ghi trong cấu hình |
| Case 5 | Renderer hay kiểu props lấy từ `@starci/grammar/core` | renderer và kiểu props lấy từ `@starci/grammar/common`; `@starci/grammar/core` chỉ xuất `CoreGrammarRoot` và stylesheet của nó |
| Case 6 | Stylesheet của family thứ hai dưới cùng một root | một `CoreGrammarRoot` ở root của composition, một `@starci/grammar/core/styles.css`; family được chọn đúng một lần |
| Case 7 | Bản sao cục bộ của một renderer Common hay một layout vô danh | `TextLink`, `NavLink`, `SeeMoreLink`, `Sidebar` hay hình học shell tự dựng: dùng renderer của Common và truyền prop; adapter sản phẩm như `LearnShellLayout` chỉ ánh xạ route và state vào Common, không sở hữu hình học |
| Case 8 | Tên sản phẩm trong export công khai của Grammar, hay logic nghiệp vụ bên trong Common/Core | `Learn`, `Console`, `Dashboard` ở lại code sản phẩm; route, quyền, persistence và effect không bao giờ vào gói |

## Câu hỏi để ngỏ

- Hook chạm tới `modules/api` qua `../../modules/api/…` ở 57 tệp và `@/modules/api/…` ở 56 tệp.
  Không biến thể nào chiếm ưu thế; tệp này không chọn.
- `export * from "./component"` ở cuối `index.tsx` nối dữ liệu có ở 19/95 block và vắng ở phần còn
  lại. Không áp đặt.
