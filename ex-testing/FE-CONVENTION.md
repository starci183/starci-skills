# FE convention — locked from starci-academy-fe (read by all FE lanes)

## Route tree — `src/app/` / `apps/*/src/app/`
Framework slots only (`route-tree-holds-routes-only`). Every slot is a THIN SHELL:

```tsx
// page.tsx — fixed name, mounts the owner, nothing else
const Page = () => <OrderDetailPage />
export default Page
```

Fixed names enforced by `starci-fe/route-slot-fixed-name` (canon-fe 3.1.0, local
`.claude/packages/fe`): page→Page, layout→Layout, template→Template, loading→Loading,
error→Error, global-error→GlobalError, not-found→NotFound. No data computation, no
state, no props juggling inside a slot file.

## Surface tiers — `components/{pages,layouts,overlays}/<Xxx>{Page,Layout,Overlay}/`

Two halves + twins (`index.tsx`, `component.tsx`, optional `classNames.ts`, `*.spec.tsx`).

### index.tsx — the CONNECTED half (reads state, owns nothing visual)
- pages/overlays: `export type XxxPageProps = Record<never, never>` then `void props` —
  NO props. Read everything via hooks (useParams, useSearchParams, SWR, useTranslations).
- layouts: `export type XxxLayoutProps = { readonly content: ReactNode }` — the ONE prop,
  spelled `content` (academy's name for the slot's children).
- Derives the screen situation via a `xxxStateOf(...)` helper, then renders the pure twin.

### component.tsx — the PURE twin, exported as `XxxBase` (`OrderDetailPageBase`)
Exactly three prop groups:

```ts
export type XxxProps = {
    /** Whole-screen situations this surface settles. */
    readonly state: "loading" | "failed" | "ready" // union per screen — see below
    /** The data payload for whatever state is showing. */
    readonly props: { /* ... */ }
    /** What the surface reports upward. */
    readonly on: { /* ... */ }
}
```

`state` is a UNION because a surface owns multiple whole-screen situations
(academy example: `PublicProfileLayout` = `"loading" | "failed" | "not-found" | "locked" | "ready"`).
The component renders per `state` — it never reads hooks, router, stores, or i18n itself.

## Lower tiers — `components/{leaves,branches,composites,blocks}`

Self-contained (`index.tsx`; blocks also get a `component.tsx` pure twin under a
category folder `blocks/<category>/<Name>/`). State stays BINARY — a leaf has
loading-or-not, not a situation space:

```ts
export type ConfirmButtonProps = {
    readonly props: ConfirmButtonData
    readonly on?: ConfirmButtonActions
    readonly isLoading?: boolean   // lower tiers keep isLoading, never a state union
}
```

## i18n + theme
- next-intl: `src/i18n/{config,routing,request,navigation}.ts`, `src/app/[lang]` routing,
  `src/messages/{en,vi}.json`. Vietnamese lives ONLY in lang/dictionary files
  (`**/messages/**`, `**/*.lang.*`) — everything else English including tests.
- Dark/light: `src/modules/theme/` (academy pattern).

## Style
indent 4 · double quotes · no semicolons · `Array<T>` generic · jsx-a11y full set ·
canon style in ALL new code.
