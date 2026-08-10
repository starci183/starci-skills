# naming

## Definition

Naming here is the mechanical half: the spellings that are the same in every file regardless of what
the file is for. How a module-level function is declared, and what a thing that responds to a reader
is called.

These are not preferences. Both forms of each pair work, and that is exactly why they are rules —
nothing corrects the second spelling, so a file written on a Tuesday reads differently from its
neighbour, and every diff afterwards carries noise that has nothing to do with the change.

What a component is called for — the thing rather than its first caller — is not settled here. That
question is answered per layer, because the failure it prevents is different at each one.

What holds this law is [`sources/naming.mjs`](../../../sources/fe/naming.mjs).

## Rules

**NAMING-1 · A module-level function is an arrow const.**

`export const X = () => {}`, never `function X() {}` and never `export default function`. One
spelling means a reader scanning a file sees the same silhouette for every declaration in it, and a
grep for the name finds the definition rather than a hoisted surprise.

The deeper reason is hoisting. A `function` declaration exists before the line that declares it, so
a file can call downward and stay green — and the order of a file then stops meaning anything,
because nothing enforces that a thing is defined before it is used. A const cannot be used before it
exists, so the file reads top to bottom in the order it actually runs.

**NAMING-2 · Something that responds to a reader is named `onX`, never `handleX`.**

Both the prop and the local. `handleSubmit` and `onSubmit` describe the same function, but a
codebase that uses both has two vocabularies for one idea, and every author has to decide which one
this file is in.

`on` is the one that survives the trip. The prop is already `on.press`, the DOM attribute is already
`onClick`, and the slot the function is passed into is already `on` — so a local called
`handlePress` is renamed at the boundary, every time, and the rename is a chance to get it wrong.
Naming it `onPress` at birth means the name is the same at the declaration, at the call site and in
the props type.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| `function X() {}` at module level | It is hoisted, so the file's order stops carrying any guarantee about what exists when | `export const X = () => {}` |
| `export default function` | The same, plus the export has no name to grep for at its call sites | A named arrow const, exported by name |
| `handleX` as a local | It is renamed at the boundary every time it is passed, and a rename is a chance to be wrong | `onX`, the same word the slot uses |
| `handleX` as a prop | Two vocabularies for one idea, and every author must decide which one this file speaks | `onX` |
| A name that says where it is used | It dies at the second caller, and is either copied or left lying | Name what it is — the rule for this is stated per layer |

## Examples

### The ordinary case — one silhouette per declaration

```tsx
// Every declaration in the file has the same shape, and nothing exists before its own line.
export const formatQuota = (value: number) => `${value} left`

export const CreditStatRow = ({ props }: CreditStatRowProps) => (
    <StatRow props={{ label: props.label, value: formatQuota(props.remaining) }} />
)
```

```tsx
// Wrong: the component calls a helper declared below it and stays green, so the file's order
// promises nothing to whoever reads it next.
export function CreditStatRow({ props }: CreditStatRowProps) {
    return <StatRow props={{ label: props.label, value: formatQuota(props.remaining) }} />
}

function formatQuota(value: number) {
    return `${value} left`
}
```

They differ in one thing: whether a name can be used before the line that creates it.

### The handler trap — the rename at the boundary

```tsx
// The name is the same at the declaration, at the slot, and in the props type.
const onClaim = () => claim.trigger()

return <_DailyQuest state="claimable" props={frame} on={{ claim: onClaim }} />
```

```tsx
// Wrong: the function is called one thing here and another thing one line later, and nothing
// but habit keeps the two in step.
const handleClaim = () => claim.trigger()

return <_DailyQuest state="claimable" props={frame} on={{ claim: handleClaim }} />
```

They differ in one thing: whether the name survives being passed.

### The borderline — a handler that is not a handler

```tsx
// Not a handler: it computes a value. `on` would be a lie, and this rule does not ask for it.
const claimLabel = buildClaimLabel(quest.data)
```

```tsx
// Wrong: named as though a reader triggers it, when nothing does.
const onClaimLabel = buildClaimLabel(quest.data)
```

They differ in one thing: whether a reader's action is what runs it.
