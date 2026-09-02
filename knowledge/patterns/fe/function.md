# Function

This file answers one question: given a frontend component, hook or helper, what shape does the
function take, what does it receive, and what does it return?

Sources: `src/components/pages/AuthenticationPage/*`, `pages/CartPage/index.tsx`,
`blocks/ai/StarCiAiChat/*`, `blocks/ai/CourseAdvisorRecommendationCard/*`,
`leaves/ButtonStateSample/index.tsx`, `hooks/swr/useQueryCourseSwr.ts`,
`hooks/swr/useMutateAddToCartSwr.ts`, `packages/grammar/src/core/primitive/Button/index.tsx`.

## FE-FUNCTION-1 — A component is an arrow const with one `props` parameter

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Any app component | `export const AuthenticationPageBase = (props: AuthenticationPageProps) => { … }` (441 `export const X = (` against 0 `export function` under `src/components`; 428 take `(props: XProps)`, 0 destructure at the signature) |
| Case 2 | Reading fields | `const { on } = props` at the top, or `props.props.labels`, `props.state` inline |
| Case 3 | Expression body when there is no local state | `export const ButtonStateSample = (props: ButtonStateSampleProps) => ( <span …>{props.props.label}</span> )` |
| Case 4 | Grammar package component | destructures with defaults at the signature: `export const Button = ({ children, variant = "secondary", size = "md", type = "button", …, onPress }: ButtonProps) => …` — the package convention differs from the app convention; each side is internally consistent |

## FE-FUNCTION-2 — The three-part contract of a pure half

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Full block contract | `export type StarCiAiChatProps = { readonly state: StarCiAiChatState; readonly props: StarCiAiChatData; readonly on?: StarCiAiChatActions }` (`state`/`blockState` in 85, `props:` in 78, `on?:` in 69 of 101 block `component.tsx`) |
| Case 2 | Leaf contract | `export type ButtonStateSampleProps = { readonly props: ButtonStateSampleData; readonly isLoading?: boolean }` |
| Case 3 | Card with an action slot | `{ readonly props: CourseAdvisorRecommendationCardData; readonly isLoading?: boolean; readonly action: { readonly href: string; readonly label: string } }` |
| Case 4 | Page with only actions | `{ readonly measure?: "form" \| "formCompact"; readonly initialMode?: AuthMode; readonly initialStep?: "details" \| "code"; readonly on?: AuthenticationPageActions }` |

## FE-FUNCTION-3 — Where the props type goes

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Pure half | Declared in `component.tsx` directly above the component, together with its `Data`, `Labels`, `Actions`, `State` parts |
| Case 2 | Connected half that takes input | Declared in `index.tsx`: `export type CourseAdvisorRecommendationCardProps = { readonly recommendation: CourseAdvisorRecommendation }` |
| Case 3 | Connected half that takes nothing | `export type CartPageProps = Record<never, never>` and the body starts with `void props` (59 index files; 34 use `Record<never, never>`) |
| Case 4 | Local sub-render | `type TurnProps = { readonly turn: StarCiAiTurn; … }` unexported, above `const Turn` |

## FE-FUNCTION-4 — What each half does

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Connected half | `"use client"`; calls `useTranslations`, `useLocale`, `useRouter`, `useQuery…Swr`; resolves every label and fact; returns `<XBase state=… props={{ … }} on={{ … }} />` (49/49 page `index.tsx` and 89/109 block `index.tsx` carry `"use client"`) |
| Case 2 | Pure half | No `"use client"` (0/49 pages, 3/109 blocks); no runtime import from `@/hooks` or `@/modules/api` (0 of 150 `component.tsx`; 18 import a type only) |
| Case 3 | Route-derived input | `const routeState = (value: string \| null) => { switch (value) { case "sign-up": return { mode: "signUp" as const, step: "details" as const, measure: "form" as const } … } }` in `index.tsx`, then `const initial = routeState(authState)` |
| Case 4 | Navigation as an action | `on={{ signedIn: () => router.replace("/dashboard") }}` |

## FE-FUNCTION-5 — When a helper is extracted

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A boolean over the state union | `const stateNeedsRetry = (state: StarCiAiChatState): boolean => state === "sessionsFailed" \|\| …` above the component (11 of 101 block `component.tsx` hold such consts) |
| Case 2 | A string builder | `const turnMarkdown = (turn: StarCiAiTurn, partialLabel: string): string => { … }` |
| Case 3 | A repeated JSX fragment | `const Turn = (props: TurnProps) => { … }` in the same file, not a new folder |
| Case 4 | A branch inside the render | an IIFE: `const transcript = (() => { if (…) return …; if (…) return …; return … })()` |
| Case 5 | A class variant | goes to `classNames.ts` as `getAiChatBubbleClassName(role)` |

## FE-FUNCTION-6 — Hook shape

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Read | `export const useQueryCourseSwr = ({ displayId }: UseQueryCourseSwrParams = {}) => { const viewer = useViewerKey(); return useSWR<CourseDetail \| null>(displayId === undefined ? null : [QUERY_COURSE_SWR_KEY, displayId, viewer ?? "guest"], async () => { const result = await queryCourse({ request: { displayId } }); return result.data?.course?.data ?? null }) }` |
| Case 2 | Write | `export const useMutateAddToCartSwr = (courseId?: string) => useSWRMutation(courseId === undefined ? null : [MUTATE_ADD_TO_CART_SWR_KEY, courseId], async (_key: readonly [string, string], { arg }: AddToCartTrigger) => mutationAddToCart({ courseId: arg.courseId }))` |
| Case 3 | Return | the SWR result is returned as-is; the component reads `query.data`, `query.isLoading`, `checkout.trigger`, `checkout.isMutating` |
| Case 4 | Key | `null` when the input is missing; the viewer identity is part of a read key |

## FE-FUNCTION-7 — Route file

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Every `page.tsx` | `const AuthenticationRoute = () => <AuthenticationPage {...{}} />` then `export default AuthenticationRoute` — the route makes no drawing decision |
