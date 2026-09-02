# Typing

This file answers one question: given a frontend value, how is its type declared?

Sources: `tsconfig.json` (`strict: true`), `eslint.config.mjs` (`@typescript-eslint/array-type`
generic), `src/components/**`, `src/hooks/swr/*`, `src/modules/toast/api.ts`,
`packages/grammar/src/common/conformance.ts`, `core/primitive/Button/index.tsx`.

## FE-TYPING-1 — `type` for shapes, `interface` in the hook layer

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Props and data shapes | `export type StarCiAiTurn = { readonly id: string; readonly role: "user" \| "assistant"; … }` (919 `export type X = {` against 232 `export interface` in `src/`, 403 vs 6 for `…Props`) |
| Case 2 | Hook params | `export interface UseQueryCourseSwrParams { displayId?: string }` — the `interface` share sits in `hooks/` and `modules/api`, not in components |
| Case 3 | Intersection | `export type CourseAdvisorRecommendationCardData = CourseAdvisorRecommendation & { readonly title?: string; … }` |
| Case 4 | Grammar package | `export type ButtonProps = { … }`, `export type GrammarRuleConformance = { … }` — `type` throughout |

## FE-TYPING-2 — `readonly` on every field

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Props field | `readonly measure?: "form" \| "formCompact"` (2336 `readonly` prop lines against 69 without) |
| Case 2 | Nested object | `readonly action: { readonly href: string; readonly label: string }` |
| Case 3 | Collection | `readonly turns: ReadonlyArray<StarCiAiTurn>`, `readonly states: Readonly<Record<StarCiAiChatState, string>>` |
| Case 4 | Tuple key | `_key: readonly [string, string]` |

## FE-TYPING-3 — Literal unions, not booleans, for state

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Component state | `export type StarCiAiChatState = \| "sessionsPending" \| "sessionsFailed" \| "noSession" \| … \| "contextCleared"` (21 members) |
| Case 2 | Mode | `export type StarCiAiMode = "general" \| "history"`; `role: "user" \| "assistant"` |
| Case 3 | Inventory of the union | `export const STARCI_AI_CHAT_STATES: ReadonlyArray<StarCiAiChatState> = [ … ]` beside the type |
| Case 4 | Flag that is truly binary | `readonly isLoading?: boolean`, `readonly isPartial?: boolean` — `is`/`has` prefixed |
| Case 5 | Closed vocabulary in Grammar | `export type ButtonVariant = "primary" \| "secondary" \| "tertiary" \| "outline" \| "ghost"`; `const VARIANTS = { … } as const` |

## FE-TYPING-4 — Arrays

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Any array type | `ReadonlyArray<string>`, `Array<T>` — never `T[]` (lint `@typescript-eslint/array-type: generic`) |
| Case 2 | Frozen literal | `const PENDING_TURN_IDS = ["pending-1", "pending-2"] as const` (252 `as const` sites in `src/`) |

## FE-TYPING-5 — Inferred and declared

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Component return | inferred; no `: JSX.Element` on any of the 441 components |
| Case 2 | Helper return | declared when primitive: `(state: StarCiAiChatState): boolean =>`, `(turn: StarCiAiTurn, partialLabel: string): string =>` |
| Case 3 | Hook return | inferred from `useSWR<CourseDetail \| null>(…)`; the generic names the data |
| Case 4 | Async utility | declared: `export const runGraphQLWithToast = async <T>(action: () => Promise<GraphQLResponse<T>>, options: RunGraphQLWithToastOptions = {}): Promise<boolean>` |
| Case 5 | Narrowed literal | `return { mode: "signIn" as const, step: "code" as const, measure: "form" as const }` so a switch returns a union, not `string` |

## FE-TYPING-6 — Casting

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Double cast | not written (lint `no-double-cast`) |
| Case 2 | Spec mock slot | `data: undefined as unknown` inside `vi.hoisted(() => ({ … }))` |
| Case 3 | Ignoring a prop | `void props` rather than an underscore or a cast |

## FE-TYPING-7 — Enums

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Component vocabulary | never an enum; a string-literal union |
| Case 2 | GraphQL operation names | `export enum MutationCvBlocks { Create = "create", … }` — the 92 enums in `src/` are all in `modules/api/graphql` |
