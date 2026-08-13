# landmark

## Definition

A landmark is the small set of elements a reader can jump BETWEEN without reading what is inside
them — `main`, `nav`, `aside`, `header`, `footer`. They are not shapes. A `div` and a `main` lay out
identically and one of them is the reason "skip to main content" exists.

This law exists because a registry makes the mistake easy to miss. A key named `dashboard-main`
records the intent perfectly and renders a `div`, because the branch that draws registry nodes draws
divs. Nothing turns red: **a name in a key is not an element in a document.** An entire application
shipped that way — every region correctly named, not one landmark in the DOM, and no gate with
anything to say about it.

What holds this law is [`sources/fe/landmark.mjs`](../../../sources/fe/landmark.mjs).

Implementation anchors in `starci-academy-fe`: `src/components/branches/Main/index.tsx` and
`src/app/dashboard/layout.tsx`.

## Rules

**LANDMARK-1 · One branch per landmark element.**

`Tree` draws a `div`. A landmark gets its own branch — `Main` today, `Nav` and `Aside` when a screen
needs them — identical to `Tree` in every respect except the element it opens. Adding one is a
one-file change, which is what keeps the alternative from winning by being cheaper.

**LANDMARK-2 · The branch owns no class, exactly like `Tree`.**

The registry key supplies the classes, the children it admits and the reason they sit that way. The
branch supplies the element. That is the whole difference between the two, and it is why a landmark
branch cannot become a second registry.

**LANDMARK-3 · Not a prop on `Tree`.**

`<Tree as="main">` puts the landmark in the caller's hands, beside the styling decisions, and the
first screen to forget it is the screen nobody can skip into. An element that changes what a
document MEANS is not a variant of one that does not.

**LANDMARK-4 · The routed page is marked by the layout that composes its chrome.**

The layout that renders a `Tree` around the routed children is the file that knows where navigation
ends and the page begins, so it wraps those children in `Main`. Two layouts do not qualify and are
not asked to: the ROOT layout draws `html` and `body` and mounts providers, and a PASS-THROUGH layout
delegates to another that owns the chrome. Requiring either would put a second `main` in the
document.

**LANDMARK-5 · One `main` per document, and it belongs to whoever owns the whole screen.**

A second `main` is not a stronger landmark, it is an ambiguous one. So the landmark is refused
everywhere except the files that own a whole screen: a route file — its `layout.tsx`, or its
`page.tsx` — and the page surface itself, `components/pages/<Name>/{index,component}.tsx`. Every
tier below that draws a PART of a screen, and a landmark added there is a second one.

**The two shapes are held to different sets, and collapsing them was a real defect.** The landmark
BRANCH is a component somebody imports in order to wrap a screen; it stays in route files, because a
page reaching for it is the trap this law was written for. A frame whose CONTRACT ENTRY declares
`host: "main"` is not that — nobody imported a landmark, the registry says which element the key's
node opens and the frame obeys. That entry is rendered by whoever renders the screen's outermost
node, and [LAYOUT-6](file-layout.md) says the route file is emphatically not it: a route mounts a
page and draws nothing.

Held to route files only, the two laws refused each other. Every page moved out of `app/` to satisfy
LAYOUT-6 was reported for misplacing its landmark, and the only way to satisfy both at once was to
leave the page owner in the routing tree — the exact defect LAYOUT-6 exists to prevent. A rule that
can only be satisfied by breaking another rule is a finding about the rule.

That refusal is what settles the trap this law was written for: registry keys named `dashboard-main`,
`profile-main` and `explore-main` are reading COLUMNS inside a page, and drawing any of them with the
landmark branch would claim the landmark three times on one screen. Such a key's entry must not
declare `host: "main"` — the name is a name, and the host is the promise.

**What this law does NOT hold.** A file-at-a-time rule cannot see that a layout and a page beneath it
both opened a landmark. The rules narrow the place to route files and refuse every tier below, which
is where the mistake is actually made; the remaining case is a review question. Saying so is cheaper
than a gate that implies a guarantee it does not have.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A hand-written `<main>` | It carries no key, so nothing records its classes, its children or why it exists | `Main` with a registry key |
| `as` / `element` prop on `Tree` | The document's meaning becomes a call-site styling choice | A branch per landmark element |
| A landmark branch inside a page or block | The document gets a second `main` and the landmark stops meaning anything | Leave it to the route layout |
| Treating a `*-main` key as a landmark | Those keys are reading columns; three of them would claim one landmark | `Tree` for the column, `Main` for the page |
| A class on the landmark branch | The branch becomes a second registry with no `why` | Put it in the key |

## Examples

### The ordinary case — the layout marks the page

```tsx
// layout: navigation is a sibling of the routed page, and the page is the landmark.
<Tree
    contract="nav-over-body-page"
    render={defineContractComponent("nav-over-body-page", {
        navigation: defineContractProjection("double-navbar", () => <ShellNav />),
        body: defineContractProjection("routed-page-main", () => (
            <Main
                contract="routed-page-main"
                render={defineContractComponent("routed-page-main", {
                    page: defineLeafComponent("page", {}, () => children),
                })}
            />
        )),
    })}
/>
```

```tsx
// Wrong: the key says "main" and the DOM says "div". The intent is recorded and unreachable.
body: defineLeafComponent("page", {}, () => children),
```

They differ in one thing: whether a reader can skip the navigation to reach the page.

### The trap this law was written for

```tsx
// Wrong: `dashboard-main` is the reading column beside the rail, not the page. Drawn with the
// landmark branch it becomes a second `main` under the one the layout already opened.
<Main contract="dashboard-main" render={...} />
```

```tsx
// Right: the column is a shape, so it stays a Tree. The landmark was claimed one level up.
<Tree contract="dashboard-main" render={...} />
```

They differ in one thing: whether the document has one landmark or several.
