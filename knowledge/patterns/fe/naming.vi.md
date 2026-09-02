# Đặt tên

Tệp này trả lời một câu hỏi: cho một thư mục, export, kiểu, hằng hay hàm trong frontend, nó được
gọi là gì?

Nguồn: `src/components/pages/*`, `src/components/blocks/*/*`, `src/components/leaves/*`,
`src/hooks/swr/*`, `src/modules/api/graphql/**`.

## FE-NAMING-1 — Thư mục đơn vị và hai export của nó

Tên thư mục là export nối dữ liệu; bản sao thuần thêm hậu tố `Base`.

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Nửa nối của page, `pages/CartPage/index.tsx` | `export const CartPage = (props: CartPageProps) => …` (49/49 page) |
| Trường hợp 2 | Nửa thuần của page, `pages/AuthenticationPage/component.tsx` | `export const AuthenticationPageBase = (props: AuthenticationPageProps) => …` (47/49; hai đơn vị `CoursePlayground*Page` export `…PageShell`) |
| Trường hợp 3 | Nửa thuần của block, `blocks/ai/StarCiAiChat/component.tsx` | `export const StarCiAiChatBase = …` (98 trên 118 export trong `component.tsx` kết thúc bằng `Base`) |
| Trường hợp 4 | Leaf, `leaves/ButtonStateSample/index.tsx` | `export const ButtonStateSample = …` — không `Base`, không bản sao |
| Trường hợp 5 | Vỏ route, `app/[lang]/authentication/page.tsx` | `const AuthenticationRoute = () => …` |

## FE-NAMING-2 — Props và các phần của nó

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Kiểu props | `export type StarCiAiChatProps = { … }` (403 `export type …Props` so với 6 `export interface …Props`) |
| Trường hợp 2 | Dữ kiện đã giải | `export type StarCiAiChatData = { … }`, `export type ButtonStateSampleData = { … }` |
| Trường hợp 3 | Câu chữ đã giải | `export type StarCiAiChatLabels = { … }`, `CourseAdvisorRecommendationCardLabels` |
| Trường hợp 4 | Bộ xử lý | `export type StarCiAiChatActions = { … }`, `AuthenticationPageActions` |
| Trường hợp 5 | Kho trạng thái | `export type StarCiAiChatState = "sessionsPending" \| …`; `export type StarCiAiMode = "general" \| "history"` |
| Trường hợp 6 | Cùng tên ở cả hai nửa | `AuthenticationPageProps` được khai báo trong `component.tsx` và khai báo lại trong `index.tsx` với hình dạng khác; mỗi tệp sở hữu `XProps` của riêng nó |

## FE-NAMING-3 — Export class-name

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Một chuỗi cho một vai trò | `export const authenticationPageClassName = cn(formPageClassName)` (931 export `…ClassName`) |
| Trường hợp 2 | Một bản đồ vai trò cho một đơn vị | `export const aiChatClassNames = { root: cn(…), intro: cn(…), … } as const` (9 export `…ClassNames`; 7 trên 151 tệp `classNames.ts` dùng dạng object) |
| Trường hợp 3 | Biến thể giải lúc gọi | `export const getAiChatBubbleClassName = (role: "user" \| "assistant") => …`; `export const getButtonStateSampleClassName = (variant: …) => buttonVariants({ variant, size: "sm" })` |
| Trường hợp 4 | Gói Grammar | `export const railClassName`, `railFrameClassName`, `railBodyClassName`, `railFooterClassName` (`core/branch/Rail/classNames.ts`) |

## FE-NAMING-4 — Hook và khóa

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Hook đọc | `useQueryCourseSwr`, `useQueryMyCartSwr` (80 tệp `useQuery…Swr.ts`) |
| Trường hợp 2 | Hook ghi | `useMutateAddToCartSwr`, `useMutateClearCartSwr` (32 tệp `useMutate…Swr.ts`) |
| Trường hợp 3 | Hằng khóa | `export const QUERY_COURSE_SWR_KEY = "QUERY_COURSE_SWR"`, `export const MUTATE_ADD_TO_CART_SWR_KEY = "MUTATE_ADD_TO_CART_SWR"` |
| Trường hợp 4 | Kiểu tham số hook | `export interface UseQueryCourseSwrParams { displayId?: string }`; đối số trigger `export type AddToCartArg`, `export type AddToCartTrigger` |
| Trường hợp 5 | Hook không phải dữ liệu | `useSessionToken`, `useViewerKey`, `useAuthPanel` dưới `hooks/auth/` |
| Trường hợp 6 | Module tài liệu GraphQL | `modules/api/graphql/queries/query-course.ts`, `mutations/mutation-add-to-cart.ts`; hằng tài liệu là `query1`, hàm là `queryCourse` / `mutationAddToCart` |

## FE-NAMING-5 — Hằng và giá trị cấp module

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Giá trị module đóng băng | `const HISTORY_STATES = new Set<StarCiAiChatState>([…])`, `const PENDING_TURN_IDS = ["pending-1", "pending-2"] as const`, `const DEFAULT_MESSAGES: ToastMessages = { … }` (120 hằng `UPPER_SNAKE` export + 163 cục bộ) |
| Trường hợp 2 | Kho export | `export const STARCI_AI_CHAT_STATES: ReadonlyArray<StarCiAiChatState> = […]` |
| Trường hợp 3 | Bảng tra trong Grammar | `const VARIANTS = { primary: "primary", … } as const`, `const SIZES = { sm: "sm", md: "md", lg: "lg" } as const`, `const SKELETON_CLASS_NAME = …` (`core/primitive/Button/index.tsx`) |
| Trường hợp 4 | Enum tên thao tác (enum duy nhất trong `src/`) | `export enum MutationCvBlocks { Create = "create", Update = "update", Render = "render", Rewrite = "rewrite" }` (92, toàn bộ trong `modules/api/graphql`) |

## FE-NAMING-6 — Bộ xử lý, boolean, helper

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Bộ xử lý hành động | động từ trần trong object `on`: `on?: { signedIn?: () => void }`, `on?.send`, `on?.selectMode?.("general")` — không bao giờ `onX` ở nửa thuần (lint `handler-on-prefix`) |
| Trường hợp 2 | Prop boolean | tiền tố `is`/`has`: `isLoading`, `isEnrolled`, `isPartial`, `isArchived`, `isOnline` (286 trên 366 prop boolean) |
| Trường hợp 3 | Helper thuần cục bộ | cụm động từ hoặc danh từ camelCase: `stateNeedsRetry`, `turnMarkdown`, `routeState` |
| Trường hợp 4 | Bộ vẽ con cục bộ | PascalCase với kiểu props riêng: `const Turn = (props: TurnProps) => …` |

## FE-NAMING-7 — Tên tệp ngoài thư mục component

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Tệp hook | camelCase trùng export: `useQueryCourseSwr.ts`, `useSessionToken.ts` |
| Trường hợp 2 | Tệp module | kebab-case: `query-course.ts`, `course-advisor-response.ts`, `content-ai-selection-context.ts`, `create-apollo-client.ts` |
| Trường hợp 3 | Tệp spec | cùng tên gốc cộng `.spec`: `useQueryCourseSwr.spec.ts`, `component.spec.tsx`, `index.spec.tsx` |
| Trường hợp 4 | `describe` trong spec | tên export: `describe("StarCiAiChatBase"` trong `component.spec.tsx` (85/97), `describe("CartBlock"` trong `index.spec.tsx` (0 `…Base` ở đó) |
