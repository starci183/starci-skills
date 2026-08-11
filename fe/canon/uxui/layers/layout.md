# layout

## Definition

A layout is **route-stable chrome**. It holds the routed body — and it knows the domain:
who is signed in, which section is current, what the cart holds. Open and domain-aware at once, which
is exactly the pair no other tier is allowed.

What makes it a layout rather than a very large block is that it **survives navigation**. The body
underneath is replaced; the bar, the rail and the footer are not. A reader who moves between two
sections must not see the chrome flicker, because chrome that repaints on every route reads as the
whole application reloading.

The question that settles it: **does it stay while the body changes?** If yes, it is a layout. If it
appears in response to an action and goes away again, it is an overlay. If nothing can be put
inside it at all, it is a block.

## Rules

**LAYOUT-1 · The framework boundary brands the routed body before composition.**

Next's root `app/layout.tsx` is the framework boundary and therefore receives `children`; no
component layout does. The boundary closes that node into the contract's `page` leaf immediately.
A layout that accepts or reads arbitrary body markup has coupled the chrome to the page, and now
every new page edits the layout.

**LAYOUT-2 · It is a SIBLING of the body, not a parent of its state.**

The layout and the routed body sit side by side in one tree. It may know which section is current —
that is navigation, and navigation is the layout's own domain — but it holds nothing the body owns.
A layout storing what the body is working on is a global variable with a nicer name.

**LAYOUT-3 · It resolves its own domain, exactly like a block.**

Session, navigation, notification count, cart count: it fetches these itself. They belong to the
chrome, not to whichever page happens to be mounted, and passing them down from a page would make
every page responsible for the bar.

**LAYOUT-4 · It never aggregates the API of what it holds into its own.**

A layout republishing what pages accept becomes a funnel: every page change edits the layout, and
the layout's props stop describing the layout. This is the single most common way an app shell turns
into the file nobody can touch.

**LAYOUT-5 · It owns no class of its own.**

Same as branch, same reason. The relationship between bar, body and footer — what is pinned, what
fills, what scrolls — is a contract node with a stated reason, not a class string.

**LAYOUT-6 · It draws no domain content of its own.**

A layout composes blocks for anything with meaning. The bar's notification list, the account menu,
the cart summary: each is a block the layout holds, not markup the layout writes. What the layout
owns is the TOPOLOGY — what sits where, and what survives.

**LAYOUT-7 · What must not repaint is stated, not hoped for.**

If the chrome is remounting on navigation, that is a defect, not a styling detail. The structure
that prevents it — the layout as a sibling of the body — is the rule, and a change that breaks it is
a change to the rule.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Reading what it holds to decide anything | The chrome is then coupled to the page, and every new page edits it | Take the decision as its own domain (current route, session) |
| Holding what the body is working on | A layout is global; state put there is global state with a nicer name | Leave it in the page or the block that owns it |
| Republishing page props | Every page change now edits the layout, and its props stop describing it | Let the page own its own props |
| Writing a class | The pin/fill/scroll relationship is a node with a reason, not a string | Name a contract entry for the shell topology |
| Writing domain markup inline (a notification list, an account menu) | Those are domain sentences, and the layout stops being topology | Compose the block that says it |
| Taking a fetched payload as a prop | The page becomes responsible for the chrome | Fetch it here |
| Remounting on navigation | The application appears to reload on every link | Keep the layout a sibling of the routed body |
| `children` on a component layout | Arbitrary page markup crosses into a domain-aware component and cannot be checked | Brand framework children at `app/layout.tsx`, then compose the layout as a sibling |

## Examples

### The ordinary case — chrome that survives the body

```tsx
// framework boundary: it brands the opaque routed body immediately; the layout is its sibling.
<Tree
    contract="nav-over-body-page"
    render={defineContractComponent("nav-over-body-page", {
        navigation: defineContractProjection("double-navbar", () => <ShellNav />),
        body: defineLeafComponent("page", {}, () => children),
    })}
/>
```

```tsx
// Wrong: the shell now reads the body to decide its own shape, so every new page is a shell edit.
export const AppShell = ({ children, pageKind }: AppShellProps) => (
    <div className={pageKind === "wide" ? "max-w-full" : "max-w-app-lg"}>{children}</div>
)
```

They differ in one thing: whether the chrome knows anything about the page inside it.

### The funnel trap

```tsx
// layout: it resolves only the chrome domain and receives no page API.
export const ShellNav = () => ( /* ... */ )
```

```tsx
// Wrong: a funnel. Every page's needs now surface in the shell's props, and the shell grows a
// field per page forever.
export const ShellNav = ({
    showSearch, hideFooter, breadcrumbs, pageTitle, ctaLabel,
}: AppShellProps) => ( /* ... */ )
```

They differ in one thing: whether the shell's props describe the shell.

### The repaint trap

```tsx
// layout: a sibling of the routed body. The route changes, the body is replaced, the bar is not.
<Tree
    contract="nav-over-body-page"
    render={defineContractComponent("nav-over-body-page", {
        navigation: defineContractProjection("double-navbar", () => <ShellNav />),
        body: defineLeafComponent("page", {}, () => children),
    })}
/>
```

```tsx
// Wrong: the nav is rendered by the page, so it unmounts and remounts on every navigation, and
// the whole application appears to reload.
export default function CoursesPage() {
    return <><ShellNav /><CourseCatalog /></>
}
```

They differ in one thing: whether the chrome is a sibling of the body or part of it.
