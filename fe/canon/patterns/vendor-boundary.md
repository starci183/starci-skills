# vendor boundary

## Definition

The component library is imported by two folders and no others: `leaves/`, which wraps a vendor
primitive that takes only values, and `shells/`, which wraps one whose API requires children.

The point of the boundary is a question somebody can answer without reading the tree: **what would
changing component libraries cost?** Two folders is an answer. "It depends where people reached for
it" is not — and that is the state every codebase drifts into, one reasonable exception at a time.

The question that settles a file's place: **does this file name the library?** If it does, it is one
of the two wrapper tiers, and which one is decided by whether the primitive it wraps needs children.
If it does not, it may sit anywhere and must not start.

What holds this law is
[`sources/fe/vendor-boundary.mjs`](../../../sources/fe/vendor-boundary.mjs).

## Rules

**VENDOR-1 · One wrapper per primitive, and everything above asks the wrapper.**

A tier that needs vendor BEHAVIOUR — a focus trap, a scroll lock, a keyboard walk — asks for a
wrapper rather than reaching past one. That case is where the boundary is usually lost, because
behaviour does not look like styling and the reach feels justified.

**VENDOR-2 · The permission is a folder, and it is checked in both directions.**

Outward: a component elsewhere that imports the library is misfiled. Inward: a file in a wrapper
folder that imports nothing is not a wrapper — it is an ordinary component that wandered into an
exemption it does not need.

The second half is what makes this a policy rather than a hole. A folder anybody can opt into stops
meaning anything, and the first thing to opt in is always something that was hard to place.

**VENDOR-3 · A glyph library is its own boundary, with its own folder.**

The component library is not the only vendor. A glyph set is a second one, and a rule that names one
vendor protects one vendor — which is how a caret came to be imported straight from a glyph package
at a size that existed nowhere else, reported by nothing. Every vendor gets a named owner or it gets
none.

**VENDOR-4 · A provider standing the library up is not a component reaching past its tier.**

The file that mounts a theme or a portal root for the whole application is doing something different
from a component pulling in a widget, and a rule that could not tell them apart would be one nobody
could satisfy. The scope is the component tree; outside it, the boundary does not apply.

**VENDOR-5 · When no wrapper exists, the answer is to add one.**

Not to reach past the boundary this once. The wrapper is where the decision about that primitive is
kept, and a call site that reaches past it is a second place that decision now lives.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Importing the component library outside the wrapper folders | The boundary becomes a judgement per file, and the cost question loses its answer | Use the wrapper; add one if none exists |
| A file in a wrapper folder that imports no library | It is an ordinary component holding an exemption it does not need | Move it to the tier it belongs to |
| Reaching past a wrapper for BEHAVIOUR | Behaviour does not look like styling, which is why the boundary is usually lost here | Wrap the behaviour and compose the wrapper |
| A second vendor with no named owner | A rule that names one vendor protects one vendor | Give it a folder and a rule of its own |
| Reaching past the boundary once, for one screen | The exception is the first call site of a permanent hole | Add the wrapper |

## Examples

### The two folders

```tsx
// leaves/Button: a vendor primitive that takes only values
import { Button as HeroButton } from "@heroui/react"
```

```tsx
// shells/ModalShell: a vendor primitive whose API requires children
import { Modal } from "@heroui/react"
```

They differ in one thing: whether the primitive needs children. Nothing else decides which folder.

### The reverse check

```tsx
// shells/ModalShell: the exemption is being used
import { Modal } from "@heroui/react"
```

```tsx
// shells/SurfaceCard: imports no library, so it is a branch in the wrong folder
import { Tree } from "@/components/branches/Tree"
```

They differ in one thing: whether the folder was earned.

### The behaviour trap

```tsx
// the focus trap lives in a shell; this file composes it
<ModalShell props={{ isOpen }} on={{ dismiss }}>{children}</ModalShell>
```

```tsx
// "it is only behaviour, not styling" - and the boundary is now three folders wide
import { Modal } from "@heroui/react"
```

They differ in one thing: whether the answer to "what would a swap cost" is still a list.
