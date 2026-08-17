---
title: Props-and-slots
module: props-and-slots
kind: pattern
codes: [SLOTS-1, SLOTS-2, SLOTS-3, SLOTS-4, SLOTS-5, SLOTS-6, SLOTS-7]
---

# Props-and-slots

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |
| `@canon-fe-props` | `@starci/eslint-canon-fe/props` | npm package | the published frontend prop types this record cites |


## Record

The input to this pattern is a shape that has already been accepted — a layout, a block, a capability
or a contract that somebody has decided is right. The decision is not reopened here. The output is
source architecture: which file the component lives in, which tier alias types its parameter, which
slots that alias opens, what the data type is called, and what the component is therefore forbidden
to accept. This pattern lands an accepted shape into typed code.

## Law

A component's props are a CLOSED set of named slots, and that set is written as a type alias per
tier rather than assembled per component. What a caller may hand a component is therefore not a
convention anybody has to remember — it is the only thing that compiles.

The distinction that decides everything below: **a rule is correct today; a fence is correct next
month.** An interface spelling out `props` and `isLoading` is a rule — correct when written, one
`extends` away from carrying a caller's own styling. An alias that IS the whole shape is a fence:
there is nowhere to put a fourth slot, so an author who wanted one has to decide which tier they are
actually writing.

Five slots exist across the whole system and no component has all five. `props` is what it draws.
`on` is what it does. `contract` is the key it renders and `render` is one named component per slot
that key declares — having those two is what makes a container a container. `isLoading` is handed
down, never decided locally.

**This is binding, not advisory.** Every component that accepts anything at all has a slot
situation, and that situation has a code below. "It only takes one prop" is not an exemption; it is
where the fence is most often replaced by a hand-written shape that looks the same on the day it is
written.

## Situation codes

Every situation this module governs carries a code, `SLOTS-<n>`. The code names the SITUATION; the
tier alias names what that situation emits. The numbers are stable and cited from outside this
module, so they are never renumbered when the list changes.

| Code | Situation | What the source must look like |
|---|---|---|
| `SLOTS-1` | Something carrying **behaviour** wants to travel down the same lane as data | Requires: the data slot carries data — whatever a JSON document could hold. Forbids: a function, a component or any value carrying behaviour inside `props` |
| `SLOTS-2` | A component's data shape is being declared | Requires: a component's data is declared with a type alias. Forbids: `interface` for a data shape |
| `SLOTS-3` | A component parameter needs a type | Requires: a parameter takes one named type, `XProps` for component `X`. Forbids: an inline object type, or an intersection assembled at the parameter |
| `SLOTS-4` | A caller wants to decide the **interior** of a component | Requires: a container declares `contract` and `render`; a closed shape declares neither. Forbids: a markup hole outside the closed shells; `render` on a closed shape |
| `SLOTS-5` | Something on screen is waiting for data to arrive | Requires: a component below the request owner receives `isLoading`. Forbids: a component deciding its own waiting state |
| `SLOTS-6` | A caller wants one place to **look different** | Requires: appearance is a named variant decided inside. Forbids: `className`, `style`, spacing props, per-part styling hooks |
| `SLOTS-7` | A shared surface must display a collection that belongs to a domain | Requires: a shared list surface receives collections under their domain name inside `props`. Forbids: a generic top-level `items` lane on that surface |

There is no `SLOTS-8`. The list runs `SLOTS-1` through `SLOTS-7`, and a gap in the numbering would
mean a code was retired, not that one is missing.

## Reading an accepted shape

1. **Read what the shape states.** The tier is one of leaf, composite, branch or block, and it is
   decided before the props type is written. The shape states which values the component draws,
   which handlers it calls, whether a caller may supply what goes inside and under which contract
   key, which layer owns the fetch, and any appearance the caller asked for.
2. **Name what the shape does not state, and therefore does not resolve.** An accepted shape does
   not choose `type` over `interface`, does not name the parameter type, does not decide which lane
   `render` uses, and does not say who computes a waiting state. Those are resolved here, by code —
   never assumed from the shape's silence.
3. **Resolve outermost first.** Start at the container. Whether the outer component declares
   `contract` and `render` fixes the tier alias of everything under it; only then do the interior
   components have a tier to be typed against.
4. **Ask each code's question, in order.** Does anything carrying behaviour sit in the data slot
   (`SLOTS-1`)? Is the data shape declared with a type alias (`SLOTS-2`)? Does the parameter take one
   named `XProps` (`SLOTS-3`)? May the caller decide the interior (`SLOTS-4`)? Who owns the request,
   and therefore who writes `isLoading` (`SLOTS-5`)? Was any styling asked for, and what is the
   business name of that variant (`SLOTS-6`)? Does a shared surface receive a collection, and under
   which name (`SLOTS-7`)?
5. **When two codes both match, the boundary line decides.** A handler in `props` is `SLOTS-1`; a
   component in `props` is `SLOTS-4` wearing `SLOTS-1`'s clothes, because the caller is deciding the
   interior without declaring `contract`. A class string is valid data by type, so `SLOTS-1` does not
   stop it and `SLOTS-6` does, on ownership grounds. `SLOTS-4` asks whether the caller may fill;
   `SLOTS-7` asks which lane the data takes once the answer to `SLOTS-4` is yes. A named `interface`
   satisfies `SLOTS-3` and still fails `SLOTS-2`. Record both codes when both apply; do not collapse
   them into one.

## `SLOTS-1` — the data slot carries DATA only

**Situation.** Something carries behaviour — a handler, a component, a factory — and the most
convenient place to put it is next to the values it acts on. The law says no: data is what a JSON
document could hold, and only that.

**What it emits in source.** `props` typed by a data alias whose every member is JSON-shaped. The
behaviour that wanted to ride along is moved into the `on` slot, and nothing that carries behaviour
is reachable from `props`.

**Recognition signs.** A `() =>` appears inside `props`; a capitalised name, or a variable holding a
component, appears inside `props`; somebody argues that "it belongs to this data so keep it close";
the shape being passed is defined by the **caller** rather than by the component. The test: serialize
all of `props` to JSON and read it back — whatever is lost was never `props`.

**Boundary.** This is not `SLOTS-4`: a handler that strays into `props` is `SLOTS-1`, but a
**component** that strays into `props` is `SLOTS-4` disguised as `SLOTS-1` — the caller is deciding
the interior without declaring `contract`. It is not `SLOTS-2` either: `SLOTS-1` is about the
**value** passed, `SLOTS-2` about **how the type of that value is declared**, and a `SLOTS-2`
violation is the most common way a `SLOTS-1` violation stays green.

**Common business situations.** A row with its own delete button · a card with `onRetry` bound per
item · a cell that draws its own badge · a list handed a currency formatting function · an empty
state carrying a CTA per kind of emptiness.

## `SLOTS-2` — data is declared with `type`, never with `interface`

**Situation.** A component's data shape is being declared. The two ways of writing it look
equivalent, and only one keeps `SLOTS-1`'s fence standing.

**What it emits in source.** `type XData = { … }` in the module that owns it, satisfying the
`D extends ComponentData` constraint that every tier alias imposes. This is **not** a code-style
preference: TypeScript grants an *implicit index signature* to a type alias and **not** to an
interface, so an interface **silently** slips the data constraint — it compiles at the declaration
and then stops satisfying the constraint that keeps functions out of `props`.

**Recognition signs.** The compile error appears at the **use site** rather than at the declaration,
and the reader wrongly concludes the tier alias is broken; somebody has just "fixed" it by loosening
the tier alias constraint instead of changing `interface` to `type`. The test: will this data type
ever be passed through an alias slot? If yes, it must be a `type`.

**Boundary.** This is not `SLOTS-1`: the alias is the **precondition** for `SLOTS-1` to have any
force, and an interface does not break `SLOTS-1` loudly — it makes `SLOTS-1` absent. It is not
`SLOTS-3` either: `SLOTS-3` demands a type with a **name**, `SLOTS-2` demands the type be declared
with the **right tool**, and a named interface has enough name for `SLOTS-3` while still failing
`SLOTS-2`.

**Common business situations.** A card's data shape · a table row's payload · the shape of one item
in a list · a data type reused across several leaves.

## `SLOTS-3` — the parameter shape must have a NAME

**Situation.** A component is written and the shape is typed straight into the parameter. It
compiles, it runs, and it is a shape with **nowhere to be read from**: not importable, not
referenceable from the twin test, not findable by the person asking "what does this component take?"

**What it emits in source.** One exported named type per component, `XProps` for component `X`,
declared in the component's own module and naming the **entire input** before the function begins.
The parameter takes that name and nothing else.

**Recognition signs.** A `{` opens immediately after the parameter's `:`; an intersection is
assembled in place, such as `Frame & { signOutLabel: string }` — half-named is still anonymous,
because nobody can name the other half; the twin test has to copy the shape instead of importing it.
The test: can anything else in the repository refer to this shape?

**Boundary.** This is not `SLOTS-2` — see above. It is also not the scalar-parameter case:
`(value: string)` is not a shape, has no place it needs to be read from, and does not belong to this
code.

**Common business situations.** A component written quickly while building a screen · a page
component that picked up a few copy strings · a component refactored out of a large file · a render
helper taking a "temporary" object.

## `SLOTS-4` — having `contract` and `render` is the tier boundary

**Situation.** Deciding whether this component is a **closed shape** or an **open container**. A
closed shape has neither slot; an open container has both. Both directions are **visible in the props
alias**, so a file that has drifted across the boundary shows it in its own type, without waiting for
review.

**What it emits in source.** A container emits `contract` plus `render` together in a `BranchProps`
parameter, one named component per slot the key declares; a closed shape emits a `LeafProps`,
`CompositeProps` or `BlockProps` parameter with neither slot and no markup hole. The unnamed slot is
`children`, and the name is not a matter of taste: a markup hole takes in something **already built**
— a `.map`, a ternary, an unnamed subtree — so the interior of a container could never be stated
anywhere. `render` takes **one component per named slot**, which turns the boundary into a fact the
compiler holds rather than a habit the reviewer holds.

**Recognition signs.** A closed shape has just grown a slot for the caller to pour content into; a
container the caller **cannot** pour content into belongs to a lower tier whatever it is named;
somebody proposes "let it take markup just this once". The test: may the caller decide the interior?
Yes ⇒ declare `contract` + `render`. No ⇒ this component is on the closed tier and the slot under
discussion does not exist.

**Boundary.** This is not `SLOTS-1` — see above. It is not `SLOTS-7` either: `SLOTS-4` asks
**whether the caller may fill**, `SLOTS-7` asks **which lane the data takes** once `SLOTS-4`'s answer
is already yes.

**Common business situations.** A card whose body is decided by the screen · a shared list surface ·
a section with different content per page · a layout wrapper · a modal.

## `SLOTS-5` — `isLoading` is RECEIVED, never self-decided

**Situation.** A component below the layer that owns the request is **told** whether what it draws
has arrived. It does not ask. The request-owning layer writes that flag **once** as it hands the tree
down, and that layer itself never receives the flag — because its props carry a **business
situation** rather than a waiting flag.

**What it emits in source.** `isLoading` written by the request owner and passed down; the owner's
own props alias carries no such flag. No `useState`, `useEffect` or fetch hook computes a waiting
state inside a leaf or a composite.

**Recognition signs.** A `useState`, `useEffect` or fetch hook inside a leaf or composite decides the
waiting state; two components in the same tree wait **out of step** because each answers for itself;
`isLoading` appears in the props of the layer that owns the request. The test: who calls the request?
If not this file, this file has **no standing** to answer "has it arrived yet?"

**Boundary.** This is not `SLOTS-1`: a waiting flag is a `boolean`, so it passes `SLOTS-1`
legitimately. `SLOTS-5`'s problem is not the flag's type but **who writes it**.

**This is the module's weakest code.** No type and no rule catches a component computing its own
waiting state; only a reader catches it.

**Common business situations.** A dashboard card's skeleton · a paginated table · an avatar waiting
on a profile · summary figures · a suggestion list loaded after the main content.

## `SLOTS-6` — there is no appearance slot

**Situation.** A caller wants one place to look different: a class, a style, a spacing, a styling
hook per interior part. None of those slots exist.

**What it emits in source.** A named variant, decided **inside** the component; no prop named for
appearance anywhere in the alias. Whoever can adjust a node's appearance has become its **second
owner**, and the component then has two authors who never speak to each other. What the caller is
trying to say is a **named variant**.

**Recognition signs.** A prop name ending in `ClassName`, `Style`, `Gap`, `Spacing`; a `classNames`
object opening each interior part to the caller; the same component looking different on two screens
with neither screen able to name the difference. The test: what is the caller trying to say about the
**business**? That answer is the variant's name.

**Boundary.** This is not `SLOTS-1`: a class string **is** valid data by type, so `SLOTS-1` does not
block it; `SLOTS-6` blocks it on ownership grounds, not type grounds. It is not `SLOTS-4` either:
opening appearance opens **the look**, opening `render` opens **the structure** — two different
holes, and the appearance hole is never legitimate.

**Common business situations.** Highlighting your own row in a leaderboard · a card given more
prominence on a landing page · a destructive button · read and unread rows · a selected state.

## `SLOTS-7` — a collection travels under its domain name inside `props`, never through `items`

**Situation.** A shared surface must display a collection: tasks, courses, invoices, or whatever is
added later. That surface is a **place that holds a contract**, not a data model. Because its stable
`render` component already owns the domain-shaped props, the collection travels under **its real
name** inside `props`.

**What it emits in source.** The collection as a domain-named member inside `props`, and no
top-level `items` slot on the shared surface. A top-level `items` slot creates a **second data lane**
running parallel to `props` and teaches the shared surface each caller's collection model; by the
third caller the surface knows three models it should have known none of.

**Recognition signs.** One call site sends data down two paths, part in `props` and part in `items`;
somebody is debating whether a value "should go in `props` or `items`" — a question that only exists
once the second lane exists. The test: if another domain uses this surface tomorrow, does the surface
have to learn anything new?

**Boundary.** This is not `SLOTS-4` — see above. It is not `SLOTS-1` either: both speak about
`props`, but `SLOTS-1` says **what may enter** and `SLOTS-7` says **which path is used**.

**Common business situations.** A daily task card · a list of courses in progress · payment history ·
a notification list · a members table.

## Layer held

Which tier actually holds each code. `unrepresentable` means a closed union or an alias that is the
whole shape makes the wrong value impossible to write; `enforced` means a named rule in
`@canon-fe` reports it; `documented` means nothing mechanical holds it and only
a reader does.

| Code | Tier | Held by | What still escapes |
|---|---|---|---|
| `SLOTS-1` | `unrepresentable` | `DataValue` in `@canon-fe-props` — a closed union with no function member | Nothing, wherever the tier alias is used |
| `SLOTS-2` | `unrepresentable` | The `D extends ComponentData` constraint on every tier alias | The error lands at the slot, not at the `interface`; a data type never passed through a slot compiles |
| `SLOTS-3` | `enforced` | `no-inline-parameter-type` | A named type that is not `XProps` for component `X` — the name is read, not checked |
| `SLOTS-4` | `enforced` | `no-children-slot`, plus `BranchProps` for the positive half | The rule sees the markup hole; nothing sees a closed shape that grows `render` |
| `SLOTS-5` | `documented` | Nothing. `BlockProps` proves a block never RECEIVES the flag; nothing proves a leaf never DECIDES it | Any local waiting state a component computes for itself |
| `SLOTS-6` | `unrepresentable` + `enforced` | The three closed tier aliases carry no appearance member, and JSX refuses an unknown attribute. The hole the aliases leave — a props type written by hand — is closed by four rules: `no-public-classname-prop` at the declaration and at the call site, `no-per-part-classname-prop` for `<part>ClassName`, `no-public-frame-css-props` for CSS-shaped frame props above the leaf tier, and `no-css-door-type-laundering` for a door hidden behind `Omit`/`Pick`/`Exclude` | A door under a name none of the four recognise — the rules read prop names, so an appearance decision travelling as `tone` or `density` is a naming question, not a slot the type system can see |
| `SLOTS-7` | `enforced` | `no-surface-list-items-slot` | Any other shared surface — the rule is bound to one import path |

Four codes are held by a type and three by a rule, which is the arrangement this law wants and not a
coincidence: a shape that refuses is stronger than a rule that reports, and the rules exist exactly
where a type has nothing to look at. `SLOTS-3` is the clearest case — every constraint the alias
imposes is satisfied by an inline shape, and it is still wrong, because the wrongness is not which
fields exist but that nothing else can refer to them.

## Anchor

Each code, and real code it can be checked against.

| Code | Path | What to look for |
|---|---|---|
| `SLOTS-1` | `@canon-fe-props` | The `DataValue` union and `ComponentData`; confirm no member is a function type, then try to assign a handler to `props` |
| `SLOTS-2` | `@canon-fe-props` | `LeafProps<D extends ComponentData>`; declare a data shape with `interface` and pass it in — the constraint fails |
| `SLOTS-3` | `@canon-fe` | `isInlineObjectType`, which walks intersections and parentheses, and the invalid fixtures in `props-and-slots.test.mjs` |
| `SLOTS-4` | `@canon-fe-props` · `@canon-fe` | `BranchProps` carrying `contract` + `render` and no markup hole; then `CHILDREN_SHELLS` and `isGoverned` for the exempt shells and the tiers the rule governs |
| `SLOTS-5` | `@canon-fe-props` | `BlockProps` — two slots, no `isLoading`, which anchors the RECEIVED half only. The DECIDED half has no anchor |
| `SLOTS-6` | `@canon-fe-props` | `LeafProps`, `CompositeProps`, `BranchProps`; confirm there is no appearance member and no index signature that would admit one |
| `SLOTS-7` | `@canon-fe` · `@canon-fe-props` | `noSurfaceListItemsSlot` — the import-source test that binds it, and the `items` attribute check; then `ContractRenderBranchProps`, where runtime data stays in `props` |

An anchor is not decoration. A law that cannot be pointed at in real code is a proposal, and the one
half-anchored row above is the honest cost of keeping `SLOTS-5`.

## Inputs

| Input | Evidence required |
|---|---|
| tier | leaf, composite, branch or block — decided before the props type is written |
| data | The values the component draws, and proof each one is JSON-shaped |
| behaviour | The handlers the component calls, kept out of the data |
| fill | Whether a caller may supply what goes inside, and under which contract key |
| request ownership | Which layer owns the fetch, and therefore which layer writes `isLoading` |
| appearance intent | Any styling the caller wanted, restated as a named variant |

## Rules

1. The alias is the whole shape; there is no fourth slot to add.
2. Data and behaviour travel in different slots.
3. Every parameter shape has a name in the module that declares it, and that name is `XProps`.
4. `contract` and `render` appear together or not at all.
5. The layer that owns a request writes `isLoading` and never receives one.
6. Appearance is decided inside the component, under a name.
7. A shared surface learns no caller's collection model.
8. One tier alias per component; a component that needs a different one has chosen the wrong tier.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **The closed shells (`SLOTS-4`).** `SLOTS-4` exempts the shells that hand an interior straight to
  vendor mechanics — modal, drawer and dropdown — because they arrange nothing and cannot refuse a
  shape the vendor declares. The enforcing rule also exempts the route seam that converts what a
  framework layout is handed. No folder-wide exemption exists; the list is four files, by name.
- **The registry table (`SLOTS-4`).** `SLOTS-4` does not apply to the contract table itself, where a
  named child grammar describes what a key admits. Reporting it would ask the file that abolished the
  anonymous hole to stop describing what replaced it.
- **Outside the component tiers (`SLOTS-4`).** A routed page is not governed by `SLOTS-4`; taking
  what a framework hands it is the one thing a page legitimately does.
- **Two lanes for `render` (`SLOTS-4`).** `SLOTS-4` is satisfied by bound slots and by a stable
  branded component type. Which lane applies is decided by whether the runtime data repeats, not by
  preference.
- **A scalar parameter (`SLOTS-3`).** `SLOTS-3` governs shapes. A parameter typed `string` is not a
  shape with nowhere to be read from and needs no alias.
- **No exception for `SLOTS-6`.** One "just this once" is one handover of second ownership, and that
  ownership is never recovered by review.

## Output

One block per file the accepted shape produces.

```text
component: <name>
tier: <leaf | composite | branch | block>
data: <XData, declared with type>
props: <XProps = LeafProps<XData> | CompositeProps<XData> | BranchProps<XData, K> | BlockProps<S, XData>>
slots: <props | props + on | props + on + contract + render | state + props>
situation: <SLOTS-1 … SLOTS-7>
reason: <business fact that excludes the adjacent code>
```

## Worked example

**The accepted shape.** A shared list surface on the dashboard shows the learner's daily tasks: the
screen owns the fetch, the surface renders whatever the contract key declares, and each task is drawn
by one row component with its own complete-task action.

It resolves to two files.

```text
component: DailyTaskSurface
tier: branch
data: DailyTaskSurfaceData, declared with type
props: DailyTaskSurfaceProps = BranchProps<DailyTaskSurfaceData, K>
slots: props + on + contract + render
situation: SLOTS-4, SLOTS-7
reason: the screen decides the interior of this surface, so contract and render appear together — and the daily tasks travel under their domain name inside props, not through a top-level items lane, because the next domain to use this surface must teach it nothing; this is not SLOTS-4 alone because the answer to "may the caller fill?" is already yes and the open question is which lane the data takes
```

```text
component: DailyTaskRow
tier: leaf
data: DailyTaskRowData, declared with type
props: DailyTaskRowProps = LeafProps<DailyTaskRowData>
slots: props + on
situation: SLOTS-1, SLOTS-2, SLOTS-3
reason: the complete-task handler travels in on and never inside props, because a handler that strays into props is SLOTS-1 and not SLOTS-4 — nothing here lets the caller decide the row's interior; the data type is declared with type rather than interface so the tier constraint still holds; and the parameter takes the named DailyTaskRowProps so the twin test can import the shape instead of copying it
```

**What the shape does not state, and therefore does not resolve.** It does not say whether the data
type is written with `type` or `interface`, it does not name the parameter type, it does not choose
between the two lanes for `render` — bound named slots or a stable branded component type, decided by
whether the runtime data repeats — and it does not say who computes the waiting state. Only the last
of those has an owner named in the shape: the screen owns the fetch, so the screen writes `isLoading`
and never receives it, while the surface and the row receive it. And `SLOTS-5` is held by nothing
mechanical, so if the row ever computes its own waiting state, only a reader will catch it.

## Scope

This module states a rule true of any front end written in typed components. It names no product, no
component library, no registry key and no repository. Every example is ordinary TSX.
