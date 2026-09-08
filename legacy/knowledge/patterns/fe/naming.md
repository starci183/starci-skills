# Naming

This file answers one question: given a folder, export, type, constant or function in the
frontend, what is it called?

Sources: `src/components/pages/*`, `src/components/blocks/*/*`, `src/components/leaves/*`,
`src/hooks/swr/*`, `src/modules/api/graphql/**`.

## FE-NAMING-1 — Unit folder and its two exports

The folder name is the connected export; the pure twin appends `Base`.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Page connected half, `pages/CartPage/index.tsx` | `export const CartPage = (props: CartPageProps) => …` (49/49 pages) |
| Case 2 | Page pure half, `pages/AuthenticationPage/component.tsx` | `export const AuthenticationPageBase = (props: AuthenticationPageProps) => …` (47/49; the two `CoursePlayground*Page` units export `…PageShell`) |
| Case 3 | Block pure half, `blocks/ai/StarCiAiChat/component.tsx` | `export const StarCiAiChatBase = …` (98 of 118 `component.tsx` exports end in `Base`) |
| Case 4 | Leaf, `leaves/ButtonStateSample/index.tsx` | `export const ButtonStateSample = …` — no `Base`, no twin |
| Case 5 | Route wrapper, `app/[lang]/authentication/page.tsx` | `const AuthenticationRoute = () => …` |

## FE-NAMING-2 — Props and its parts

| Case | When | Write |
| --- | --- | --- |
| Case 1 | The props type | `export type StarCiAiChatProps = { … }` (403 `export type …Props` against 6 `export interface …Props`) |
| Case 2 | Resolved facts | `export type StarCiAiChatData = { … }`, `export type ButtonStateSampleData = { … }` |
| Case 3 | Resolved copy | `export type StarCiAiChatLabels = { … }`, `CourseAdvisorRecommendationCardLabels` |
| Case 4 | Handlers | `export type StarCiAiChatActions = { … }`, `AuthenticationPageActions` |
| Case 5 | State inventory | `export type StarCiAiChatState = "sessionsPending" \| …`; `export type StarCiAiMode = "general" \| "history"` |
| Case 6 | The same name in both halves | `AuthenticationPageProps` is declared in `component.tsx` and again in `index.tsx` with a different shape; each file owns its own `XProps` |

## FE-NAMING-3 — Class-name exports

| Case | When | Write |
| --- | --- | --- |
| Case 1 | One string for one role | `export const authenticationPageClassName = cn(formPageClassName)` (931 `…ClassName` exports) |
| Case 2 | A map of roles for one unit | `export const aiChatClassNames = { root: cn(…), intro: cn(…), … } as const` (9 `…ClassNames` exports; 7 of 151 `classNames.ts` files use the object form) |
| Case 3 | A variant resolved at call time | `export const getAiChatBubbleClassName = (role: "user" \| "assistant") => …`; `export const getButtonStateSampleClassName = (variant: …) => buttonVariants({ variant, size: "sm" })` |
| Case 4 | Grammar package | `export const railClassName`, `railFrameClassName`, `railBodyClassName`, `railFooterClassName` (`core/branch/Rail/classNames.ts`) |

## FE-NAMING-4 — Hooks and keys

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Read hook | `useQueryCourseSwr`, `useQueryMyCartSwr` (80 files `useQuery…Swr.ts`) |
| Case 2 | Write hook | `useMutateAddToCartSwr`, `useMutateClearCartSwr` (32 files `useMutate…Swr.ts`) |
| Case 3 | Key constant | `export const QUERY_COURSE_SWR_KEY = "QUERY_COURSE_SWR"`, `export const MUTATE_ADD_TO_CART_SWR_KEY = "MUTATE_ADD_TO_CART_SWR"` |
| Case 4 | Hook params type | `export interface UseQueryCourseSwrParams { displayId?: string }`; trigger arg `export type AddToCartArg`, `export type AddToCartTrigger` |
| Case 5 | Non-data hooks | `useSessionToken`, `useViewerKey`, `useAuthPanel` under `hooks/auth/` |
| Case 6 | GraphQL document module | `modules/api/graphql/queries/query-course.ts`, `mutations/mutation-add-to-cart.ts`; the document const is `query1`, the function `queryCourse` / `mutationAddToCart` |

## FE-NAMING-5 — Constants and module-level values

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Frozen module value | `const HISTORY_STATES = new Set<StarCiAiChatState>([…])`, `const PENDING_TURN_IDS = ["pending-1", "pending-2"] as const`, `const DEFAULT_MESSAGES: ToastMessages = { … }` (120 exported + 163 local `UPPER_SNAKE` consts) |
| Case 2 | Exported inventory | `export const STARCI_AI_CHAT_STATES: ReadonlyArray<StarCiAiChatState> = […]` |
| Case 3 | Grammar lookup tables | `const VARIANTS = { primary: "primary", … } as const`, `const SIZES = { sm: "sm", md: "md", lg: "lg" } as const`, `const SKELETON_CLASS_NAME = …` (`core/primitive/Button/index.tsx`) |
| Case 4 | Operation-name enums (the only enums in `src/`) | `export enum MutationCvBlocks { Create = "create", Update = "update", Render = "render", Rewrite = "rewrite" }` (92, all in `modules/api/graphql`) |

## FE-NAMING-6 — Handlers, booleans, helpers

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Action handler | bare verb inside the `on` object: `on?: { signedIn?: () => void }`, `on?.send`, `on?.selectMode?.("general")` — never `onX` on the pure half (lint `handler-on-prefix`) |
| Case 2 | Boolean prop | `is`/`has` prefix: `isLoading`, `isEnrolled`, `isPartial`, `isArchived`, `isOnline` (286 of 366 boolean props) |
| Case 3 | Local pure helper | verb or noun phrase in camelCase: `stateNeedsRetry`, `turnMarkdown`, `routeState` |
| Case 4 | Local sub-render | PascalCase with its own props type: `const Turn = (props: TurnProps) => …` |

## FE-NAMING-7 — File names outside component folders

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Hook file | camelCase equal to the export: `useQueryCourseSwr.ts`, `useSessionToken.ts` |
| Case 2 | Module file | kebab-case: `query-course.ts`, `course-advisor-response.ts`, `content-ai-selection-context.ts`, `create-apollo-client.ts` |
| Case 3 | Spec file | same basename plus `.spec`: `useQueryCourseSwr.spec.ts`, `component.spec.tsx`, `index.spec.tsx` |
| Case 4 | Spec `describe` | the export name: `describe("StarCiAiChatBase"` in `component.spec.tsx` (85/97), `describe("CartBlock"` in `index.spec.tsx` (0 `…Base` there) |
