# Kiểu

Tệp này trả lời một câu hỏi: cho một giá trị frontend, kiểu của nó được khai báo thế nào?

Nguồn: `tsconfig.json` (`strict: true`), `eslint.config.mjs` (`@typescript-eslint/array-type`
dạng generic), `src/components/**`, `src/hooks/swr/*`, `src/modules/toast/api.ts`,
`packages/grammar/src/common/conformance.ts`, `core/primitive/Button/index.tsx`.

## FE-TYPING-1 — `type` cho hình dạng, `interface` ở tầng hook

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Props và hình dạng dữ liệu | `export type StarCiAiTurn = { readonly id: string; readonly role: "user" \| "assistant"; … }` (919 `export type X = {` so với 232 `export interface` trong `src/`, 403 so với 6 cho `…Props`) |
| Trường hợp 2 | Tham số hook | `export interface UseQueryCourseSwrParams { displayId?: string }` — phần `interface` tập trung ở `hooks/` và `modules/api`, không ở component |
| Trường hợp 3 | Giao | `export type CourseAdvisorRecommendationCardData = CourseAdvisorRecommendation & { readonly title?: string; … }` |
| Trường hợp 4 | Gói Grammar | `export type ButtonProps = { … }`, `export type GrammarRuleConformance = { … }` — `type` xuyên suốt |

## FE-TYPING-2 — `readonly` trên mọi trường

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Trường props | `readonly measure?: "form" \| "formCompact"` (2336 dòng prop `readonly` so với 69 dòng không) |
| Trường hợp 2 | Object lồng | `readonly action: { readonly href: string; readonly label: string }` |
| Trường hợp 3 | Tập hợp | `readonly turns: ReadonlyArray<StarCiAiTurn>`, `readonly states: Readonly<Record<StarCiAiChatState, string>>` |
| Trường hợp 4 | Khóa dạng tuple | `_key: readonly [string, string]` |

## FE-TYPING-3 — Union literal, không phải boolean, cho trạng thái

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Trạng thái component | `export type StarCiAiChatState = \| "sessionsPending" \| "sessionsFailed" \| "noSession" \| … \| "contextCleared"` (21 thành viên) |
| Trường hợp 2 | Chế độ | `export type StarCiAiMode = "general" \| "history"`; `role: "user" \| "assistant"` |
| Trường hợp 3 | Kho của union | `export const STARCI_AI_CHAT_STATES: ReadonlyArray<StarCiAiChatState> = [ … ]` kề bên kiểu |
| Trường hợp 4 | Cờ thực sự nhị phân | `readonly isLoading?: boolean`, `readonly isPartial?: boolean` — tiền tố `is`/`has` |
| Trường hợp 5 | Từ vựng đóng trong Grammar | `export type ButtonVariant = "primary" \| "secondary" \| "tertiary" \| "outline" \| "ghost"`; `const VARIANTS = { … } as const` |

## FE-TYPING-4 — Mảng

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Mọi kiểu mảng | `ReadonlyArray<string>`, `Array<T>` — không bao giờ `T[]` (lint `@typescript-eslint/array-type: generic`) |
| Trường hợp 2 | Literal đóng băng | `const PENDING_TURN_IDS = ["pending-1", "pending-2"] as const` (252 chỗ `as const` trong `src/`) |

## FE-TYPING-5 — Suy luận và khai báo

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Kiểu trả về của component | suy luận; không có `: JSX.Element` trên bất kỳ component nào trong 441 |
| Trường hợp 2 | Kiểu trả về của helper | khai báo khi là nguyên thủy: `(state: StarCiAiChatState): boolean =>`, `(turn: StarCiAiTurn, partialLabel: string): string =>` |
| Trường hợp 3 | Kiểu trả về của hook | suy luận từ `useSWR<CourseDetail \| null>(…)`; generic gọi tên dữ liệu |
| Trường hợp 4 | Tiện ích async | khai báo: `export const runGraphQLWithToast = async <T>(action: () => Promise<GraphQLResponse<T>>, options: RunGraphQLWithToastOptions = {}): Promise<boolean>` |
| Trường hợp 5 | Literal thu hẹp | `return { mode: "signIn" as const, step: "code" as const, measure: "form" as const }` để một switch trả về union, không phải `string` |

## FE-TYPING-6 — Ép kiểu

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Ép kép | không viết (lint `no-double-cast`) |
| Trường hợp 2 | Ô giả lập trong spec | `data: undefined as unknown` bên trong `vi.hoisted(() => ({ … }))` |
| Trường hợp 3 | Bỏ qua một prop | `void props` thay vì gạch dưới hay ép kiểu |

## FE-TYPING-7 — Enum

| Trường hợp | Khi nào | Viết |
| --- | --- | --- |
| Trường hợp 1 | Từ vựng component | không bao giờ là enum; là union chuỗi literal |
| Trường hợp 2 | Tên thao tác GraphQL | `export enum MutationCvBlocks { Create = "create", … }` — 92 enum trong `src/` đều nằm ở `modules/api/graphql` |
