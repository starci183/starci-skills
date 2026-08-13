# props and slots

## Definition

A component's props are a CLOSED set of named slots, and the set is written as a type alias per
layer rather than assembled per component. What a caller may hand a component is therefore not a
convention anybody has to remember — it is the only thing that compiles.

The distinction that matters: **a rule is correct today; a fence is correct next month.** An
interface spelling out `props` and `isLoading` is a rule — correct when written, one `extends` away
from carrying a caller's own styling. An alias that IS the whole shape is a fence: there is nowhere
to put a fourth slot, so an author who wanted one has to decide which layer they are actually
writing.

Five slots exist across the whole system, and no component has all five. `props` is what it draws.
`on` is what it does. `contract` is the key it renders, and `render` is one named component per slot
that key declares — having those two is what makes a container a container. `isLoading` is handed
down, never decided locally.

`render` is branded contract content, never markup or an arbitrary React component. Tree may take
bound `ContractSlots<K>` or `ContractProjection<K>`. A surface host takes
`ContractComponent<K, LeafProps<D,A>>`: a real component type carrying the exact key while changing
runtime data continues through the ordinary `props`, `on`, and `isLoading` slots. The call site does
not rebuild a descriptor or close data into callbacks. See [`contract`](contract.md), CONTRACT-11.

What holds this law is [`sources/fe/props.ts`](../../../sources/fe/props.ts), which is the fence
itself, and [`sources/fe/props-and-slots.mjs`](../../../sources/fe/props-and-slots.mjs) for the one
thing a fence cannot see: a shape written inline at the parameter, where it has no name to be read
by.

Implementation anchors in `starci-academy-fe`: `src/components/contracts/props.ts` and
`src/components/branches/SurfaceListCard/index.tsx`.

## Rules

**SLOTS-1 · The data slot carries DATA, and a function does not satisfy it.**

Whatever a JSON document could hold. That single constraint is what stops a component being smuggled
through the data slot, which is why handlers travel in their own slot rather than beside the values
they act on. A component arriving as data would make its caller the author of a shape nobody can
find from the outside.

**SLOTS-2 · Data is declared with a type alias, never an interface.**

Not a style preference. A type alias gets an implicit index signature and an interface does not, so
an interface silently fails the data fence — it compiles at the declaration and stops satisfying the
constraint that keeps functions out. The alias is the constraint working; the interface is the
constraint quietly absent.

**SLOTS-3 · A parameter's shape has a name.**

An inline object type at the parameter is a shape with nowhere to be read from: it cannot be
imported, cannot be referenced by the twin that tests it, and cannot be found by anybody looking for
what this component accepts. Naming it costs one line and is the difference between a contract and a
signature.

The name is `XProps` for component `X`, and it names the complete input before the function. An
intersection such as `Frame & { signOutLabel: string }` written inline at the parameter is still an
anonymous shape and is refused for the same reason as an inline object.

**SLOTS-4 · The presence of `contract` and `render` is the layer boundary, and it is the only one
that never needs arguing about.**

A closed shape has neither; an open container has both. Both directions are visible in the props
alias, so a file that has drifted across the boundary is visible from its type rather than from a
review. A container the caller cannot fill belongs one layer down whatever it is called, and a
closed shape given slots has become a container whatever folder it sits in.

The slot is not called `children` and the name is not cosmetic. `children` accepts markup that has
already been built — a `.map`, a ternary, a subtree nobody named — so what is inside a container
could never be stated anywhere. `render` accepts one component per named slot, which is what lets
the boundary be a fact the compiler holds rather than a habit reviewers keep.

**SLOTS-5 · `isLoading` is received, never decided.**

A component below the layer that owns a request is told whether the thing it draws has arrived. It
does not ask. The layer that owns the request writes the flag once when it hands a tree down, and
never receives one itself — which is why the block's own props carry a situation instead.

**SLOTS-6 · There is no appearance slot.**

No class name, no style, no gap, no per-part styling hook. A caller who can restyle a node has
become its second owner, and the component now has two authors who never speak. Whatever the caller
was trying to say is a VARIANT with a name, decided inside.

**SLOTS-7 · A list surface receives domain collections through named `props`, never `items`.**

`SurfaceListCard` is a contract host, not a data model. Its stable branded `render` component owns
the domain props shape, so `tasks`, `courses`, or any later collection travels under its real name
inside `props`. A generic top-level `items` slot would create a second data lane and teach the shared
surface every caller's model. The strict rule rejects that lane at the JSX call site.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A function in the data slot | It smuggles a component through data, and the shape becomes unfindable from outside | Put it in the handler slot |
| An interface for a component's data | It silently fails the fence that keeps functions out | A type alias |
| An inline object type on a parameter | The shape has no name, so nothing can import it, test it or find it | Name it in the module |
| A slot the alias does not have | The alias IS the shape; wanting one more means the layer was chosen wrongly | Decide which layer this is |
| `children` outside ModalShell/DrawerShell/DropdownShell | Markup arrives already built, so what a container holds can never be stated or checked | `contract` plus a branded `ContractComponent<K>` |
| `items` on `SurfaceListCard` | It creates a second data lane and makes the shared surface know a caller's collection model | Put the collection under its domain name in the render component's named `props` type |
| `render` on a closed shape | It has become a container, whatever its folder says | Move it to the container layer |
| A component that decides its own `isLoading` | It asks a question the layer above already answered | Take the flag |
| A class name, style or spacing prop | The component gains a second author who is invisible from inside | A named variant |
| A per-part styling hook | Every internal element becomes public surface, and the component can never change | A named variant, decided inside |

## Examples

### The fence, and the rule that looks like it

```ts
type TextProps = LeafProps<TextData>
```

```ts
interface TextProps {
    props: TextData
    isLoading?: boolean
}
```

They differ in one thing: whether a fourth slot can be added next month without anybody noticing.

### The alias trap

```ts
type TextData = {
    readonly content: string
}
```

```ts
interface TextData {
    readonly content: string
}
```

They differ in one thing: whether the data fence still holds. The interface compiles here and stops
satisfying the constraint one layer up.

### The naming trap

```tsx
export const Row = ({ props }: RowProps) => /* ... */
```

```tsx
export const Row = ({ props }: { props: { label: string; value: string } }) => /* ... */
```

They differ in one thing: whether anything else can refer to the shape.

### The intersection trap

```tsx
export type DashboardPageProps = DashboardFrame & DashboardCopy
export const _DashboardPage = (input: DashboardPageProps) => /* ... */
```

```tsx
export const _DashboardPage = (
    input: DashboardFrame & { readonly signOutLabel: string; readonly unavailableMessage: string },
) => /* ... */
```

They differ in one thing: whether the complete public input has the component's name.

### The escape-hatch trap

```tsx
<StatRow props={{ label, value, isOwnRow: true }} />
```

```tsx
<StatRow props={{ label, value }} nameClassName={isMe ? "text-accent" : undefined} />
```

They differ in one thing: whether the component decides what its own emphasis looks like.
