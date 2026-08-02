# Type safety, FE — STRICT

> `tsconfig.json` sets `"strict": true`, which includes `strictNullChecks`. Every rule below is
> INFERRED from real code on `mtp`; none of it is invented.

## 1. No `any` — use `unknown` and narrow

`any` is banned outright, including `as any`, `: any`, and `Array<any>` — see
[[props-and-types]] §3. A value whose type is not yet known — external input, JSON, an error — is
declared `unknown` and then **narrowed explicitly** before use:

```ts
// features/profile/CV/completeness.ts — a type guard by typeof
const hasNonEmptyString = (value: unknown): boolean =>
    typeof value === "string" && value.trim().length > 0

// hooks/useSpeechSynthesis.ts — narrowing with `in`
if (typeof window === "undefined" || !("speechSynthesis" in window)) { return }

// Wrong: const hasNonEmptyString = (value: any) => value.trim?.().length > 0
```

An error from SWR or a `catch` stays `unknown` across the whole boundary — do not cast it for
convenience:

```ts
// blocks/async/AsyncContent/index.tsx
error?: unknown   // truthy → ErrorContent; pass SWR's `error` straight through

// Wrong: error?: any
// Wrong: error?: Error — SWR never promises an Error instance
```

## 2. A discriminated union, not a scatter of optional flags

State or a payload with several branches is a union with a discriminating field, each branch
`readonly` — not a pile of booleans and optionals that can contradict each other:

```ts
// hooks/zustand/overlay/store.ts
export type PendingCartIntent =
    | { readonly type: "add"; readonly courseId: string }
    | { readonly type: "open" }

// Wrong: { isAdd?: boolean; courseId?: string }
// That shape admits a meaningless state — isAdd true with courseId undefined.
```

An async region does not invent its own flags: use SWR's `{ data, error, isLoading }` and render
through `AsyncContent`, which resolves in the order error → loading → empty → content. When a public
hook wraps that, it must SPELL OUT what each branch means in JSDoc:

```ts
// features/architecture/hooks/useSystemHealthPoll.ts
/** Live health keyed by component name, or `null` before the first resolve. */
healthByName: HealthByName | null
// The caller must read null as "checking…", NEVER as up.
```

## 3. `strictNullChecks` — null and undefined are explicit, and `!` must be PROVEN

Nullable from the API keeps its `| null`; do not flatten it to `undefined`
([[props-and-types]] §3). Handle it with `?.`, `??`, and guards — not with a scattered `!`.

**A non-null assertion `!` is allowed only when the proof sits right beside it**, visible in the
same glance:

```ts
// features/dashboard/TopLearners/index.tsx — Boolean(data) stands IMMEDIATELY before data!
const hasOverflow = Boolean(data) && data!.entries.length > TOP_N

// Wrong: const hasOverflow = data!.entries.length > TOP_N   — nothing proves it
```

When you cannot prove it in place, write a real guard (`if (!data) return null`) or a
`?? fallback`. A `!` whose justification is several lines or a function away is out of standard.

## 4. No loose `as X` — prefer `satisfies`

`as X` is legitimate only when TypeScript **cannot** know something the runtime **certainly** does,
and it must carry a readable reason:

```ts
// blocks/marketing/ArchitectureScene/index.tsx — the reason sits directly above the assertion
/** Default scene (StarCi backend). JSON widens tuples/unions, so assert the schema. */
const DEFAULT_DATA = sceneJson as unknown as ArchitectureSceneData

// blocks/cards/GroupPressableCard/index.tsx — the DOM API returns EventTarget; narrow it
const target = event.target as HTMLElement | null

// blocks/learn/EntityResultRow/index.tsx — an API string mapped to a narrow key, WITH a fallback
KIND_META[kind as KnownKind] ?? KIND_META.content

// Wrong: const data = response as CourseData    — a blind cast of an unvalidated payload, no reason
// Wrong: const items = [] as Array<Item>        — write const items: Array<Item> = []
```

**To check a shape while keeping the literal, use `satisfies`, not `as`.** `as` discards the check;
`satisfies` keeps the narrowing:

```ts
// blocks/marketing/ShowcaseMockup/index.tsx — keys stay literal, values are checked
export const SHOWCASE_THEMES = { accent: {…}, starci: {…}, aqua: {…} } satisfies Record<string, ShowcaseTheme>

// features/profile/CV/…/AchievementBlockEditor/index.tsx — checks an object literal as it is built
onChange({ ...block, items } satisfies CvBlock)

// Wrong: } as Record<string, ShowcaseTheme>
// That drops the missing-or-extra-key check and loses the literal keys as well.
```

## 5. Generics, and infer versus annotate

A reusable shape becomes a generic rather than a copy-pasted interface: `WithClassNames<T>` is the
model ([[props-and-types]] §1).

**Annotate public boundaries; let TypeScript infer locals.**

- An exported hook or function annotates its return type explicitly:
  `export const useSystemHealthPoll = (): UseSystemHealthPollResult =>`.
- A data fetch names its generic at the call site when TypeScript cannot infer it:
  `useSWR<HealthByName>(…)`.
- A local `const` inside a body is left to inference — `const trimmed = body.trim()` — with no
  redundant annotation.

When you need "the type of what this function returns", derive it rather than retyping it by hand:
`type MutateAddToCartResult = Awaited<ReturnType<typeof mutateAddToCart>>`.

## 6. `as const` with Record and mapped types — no loose index signature

A constant table or tuple gets `as const`, and the type is then **derived from the data**, so there
is one source of truth:

```ts
// blocks/learn/EntityResultRow/index.tsx
const KIND_META = { content: {…}, code: {…}, challenge: {…}, … } as const
type KnownKind = keyof typeof KIND_META

// blocks/cards/GroupPressableCard/index.tsx
const STEP_ORDER = ["sm", "md", "lg", "xl", "xl3", "xl4"] as const
```

The strongest combination for a configuration map is `as const satisfies Record<…>` — the literals
are KEPT and the shape is CHECKED:

```ts
// blocks/stats/ProgressRing/index.tsx
const SIZE_MAP = {
    sm: { ring: "size-16", label: "body-sm" }, …
} as const satisfies Record<"sm" | "md" | "lg", { ring: string; label: "body-sm" | "body" | "h5" }>
```

When the key domain is known, write `Record<UnionKey, V>` rather than `{ [key: string]: V }` —
`type HealthByName = Record<string, SystemHealthComponent>` still gives the value a real type. An
`[key: string]: any` is banned outright.

## 7. A public boundary carries explicit types

An exported props interface has JSDoc on every prop ([[props-and-types]] §2). An exported hook
annotates a dedicated return-shape interface (`UseSystemHealthPollResult`). An exported helper
annotates its return:
`const metaForKind = (kind: string): (typeof KIND_META)[KnownKind] =>`.

Only a function or constant that never leaves its own file may be left entirely to inference.
