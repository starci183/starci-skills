# Hàm

Tệp này trả lời một câu hỏi: cho một component, hook hay helper frontend, hàm có hình dạng gì,
nhận gì, và trả về gì?

Nguồn: `src/components/pages/AuthenticationPage/*`, `pages/CartPage/index.tsx`,
`blocks/ai/StarCiAiChat/*`, `blocks/ai/CourseAdvisorRecommendationCard/*`,
`leaves/ButtonStateSample/index.tsx`, `hooks/swr/useQueryCourseSwr.ts`,
`hooks/swr/useMutateAddToCartSwr.ts`, `packages/grammar/src/core/primitive/Button/index.tsx`.

## FE-FUNCTION-1 — Component là một arrow const với một tham số `props`

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Mọi component trong app | `export const AuthenticationPageBase = (props: AuthenticationPageProps) => { … }` (441 `export const X = (` so với 0 `export function` dưới `src/components`; 428 nhận `(props: XProps)`, 0 phá cấu trúc ngay tại chữ ký) |
| Trường hợp 2 | Đọc trường | `const { on } = props` ở đầu thân, hoặc `props.props.labels`, `props.state` ngay tại chỗ |
| Trường hợp 3 | Thân biểu thức khi không có state cục bộ | `export const ButtonStateSample = (props: ButtonStateSampleProps) => ( <span …>{props.props.label}</span> )` |
| Trường hợp 4 | Component trong gói Grammar | phá cấu trúc kèm mặc định tại chữ ký: `export const Button = ({ children, variant = "secondary", size = "md", type = "button", …, onPress }: ButtonProps) => …` — quy ước của gói khác quy ước của app; mỗi bên nhất quán nội bộ |

## FE-FUNCTION-2 — Hợp đồng ba phần của nửa thuần

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Hợp đồng block đầy đủ | `export type StarCiAiChatProps = { readonly state: StarCiAiChatState; readonly props: StarCiAiChatData; readonly on?: StarCiAiChatActions }` (`state`/`blockState` ở 85, `props:` ở 78, `on?:` ở 69 trên 101 `component.tsx` của block) |
| Trường hợp 2 | Hợp đồng leaf | `export type ButtonStateSampleProps = { readonly props: ButtonStateSampleData; readonly isLoading?: boolean }` |
| Trường hợp 3 | Thẻ có khe hành động | `{ readonly props: CourseAdvisorRecommendationCardData; readonly isLoading?: boolean; readonly action: { readonly href: string; readonly label: string } }` |
| Trường hợp 4 | Page chỉ có hành động | `{ readonly measure?: "form" \| "formCompact"; readonly initialMode?: AuthMode; readonly initialStep?: "details" \| "code"; readonly on?: AuthenticationPageActions }` |

## FE-FUNCTION-3 — Kiểu props đặt ở đâu

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Nửa thuần | Khai báo trong `component.tsx` ngay trên component, cùng các phần `Data`, `Labels`, `Actions`, `State` |
| Trường hợp 2 | Nửa nối có đầu vào | Khai báo trong `index.tsx`: `export type CourseAdvisorRecommendationCardProps = { readonly recommendation: CourseAdvisorRecommendation }` |
| Trường hợp 3 | Nửa nối không nhận gì | `export type CartPageProps = Record<never, never>` và thân bắt đầu bằng `void props` (59 tệp index; 34 dùng `Record<never, never>`) |
| Trường hợp 4 | Bộ vẽ con cục bộ | `type TurnProps = { readonly turn: StarCiAiTurn; … }` không export, đặt trên `const Turn` |

## FE-FUNCTION-4 — Mỗi nửa làm gì

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Nửa nối | `"use client"`; gọi `useTranslations`, `useLocale`, `useRouter`, `useQuery…Swr`; giải mọi nhãn và dữ kiện; trả về `<XBase state=… props={{ … }} on={{ … }} />` (49/49 `index.tsx` của page và 89/109 `index.tsx` của block mang `"use client"`) |
| Trường hợp 2 | Nửa thuần | Không `"use client"` (0/49 page, 3/109 block); không import lúc chạy từ `@/hooks` hay `@/modules/api` (0 trên 150 `component.tsx`; 18 tệp chỉ import kiểu) |
| Trường hợp 3 | Đầu vào suy từ route | `const routeState = (value: string \| null) => { switch (value) { case "sign-up": return { mode: "signUp" as const, step: "details" as const, measure: "form" as const } … } }` trong `index.tsx`, rồi `const initial = routeState(authState)` |
| Trường hợp 4 | Điều hướng là một hành động | `on={{ signedIn: () => router.replace("/dashboard") }}` |

## FE-FUNCTION-5 — Khi nào tách helper

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Một boolean trên union trạng thái | `const stateNeedsRetry = (state: StarCiAiChatState): boolean => state === "sessionsFailed" \|\| …` đặt trên component (11 trên 101 `component.tsx` của block có const như vậy) |
| Trường hợp 2 | Một bộ dựng chuỗi | `const turnMarkdown = (turn: StarCiAiTurn, partialLabel: string): string => { … }` |
| Trường hợp 3 | Một mảnh JSX lặp lại | `const Turn = (props: TurnProps) => { … }` trong cùng tệp, không mở thư mục mới |
| Trường hợp 4 | Một nhánh bên trong phần vẽ | một IIFE: `const transcript = (() => { if (…) return …; if (…) return …; return … })()` |
| Trường hợp 5 | Một biến thể class | đi vào `classNames.ts` dưới dạng `getAiChatBubbleClassName(role)` |

## FE-FUNCTION-6 — Hình dạng hook

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Đọc | `export const useQueryCourseSwr = ({ displayId }: UseQueryCourseSwrParams = {}) => { const viewer = useViewerKey(); return useSWR<CourseDetail \| null>(displayId === undefined ? null : [QUERY_COURSE_SWR_KEY, displayId, viewer ?? "guest"], async () => { const result = await queryCourse({ request: { displayId } }); return result.data?.course?.data ?? null }) }` |
| Trường hợp 2 | Ghi | `export const useMutateAddToCartSwr = (courseId?: string) => useSWRMutation(courseId === undefined ? null : [MUTATE_ADD_TO_CART_SWR_KEY, courseId], async (_key: readonly [string, string], { arg }: AddToCartTrigger) => mutationAddToCart({ courseId: arg.courseId }))` |
| Trường hợp 3 | Trả về | kết quả SWR được trả nguyên; component đọc `query.data`, `query.isLoading`, `checkout.trigger`, `checkout.isMutating` |
| Trường hợp 4 | Khóa | `null` khi thiếu đầu vào; danh tính người xem là một phần của khóa đọc |

## FE-FUNCTION-7 — Tệp route

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Mọi `page.tsx` | `const AuthenticationRoute = () => <AuthenticationPage {...{}} />` rồi `export default AuthenticationRoute` — route không đưa ra quyết định vẽ nào |
