# Tokens

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |
| `@canon-fe-contracts` | `@starci/eslint-canon-fe/contracts` | npm package | the published frontend contract types this record cites |

## Record

The input to this pattern is a shape somebody already accepted — a layout, a block, a surface, a
control, a status mark. That decision is closed here; this file does not reopen it. The output is
source architecture: which class string may be written, which file tier may write it, which list a
new member is added to, which stylesheet must define the variable a name requests, and which
component owns a decision instead of assembling it from classes. An accepted shape says what the
screen looks like. This pattern says what the code holding it must look like.

## Law

A token is a member of a closed set. Not a value somebody agreed to prefer — a value that is the
only thing which can be typed, so a screen off the scale is not a screen that failed review, it is a
screen that failed to compile.

Most of this law is therefore held by a type, and the rest of it exists to cover the places the type
does not reach. That division is the whole shape of this module: **the union protects the table, and
the rules protect the folder the union cannot see.**

**This is binding, not advisory.** Every measurement, every colour and every control height a screen
emits has a code below. There is no value small enough to be exempt: a `size-3.5` on one glyph is
`TOKEN-3` for the same reason a raw hex fill is `TOKEN-4`. "It is only one class" is not an
exemption — it is where the last off-scale value in a real codebase survived every rule that
existed.

**The scale, as it actually is.** Six rungs for the seam between things, unevenly spaced.

| Rung | Class | Reads as |
|---|---|---|
| 4px | `gap-1` | two lines of ONE identity — a name over its handle, a figure over the word labelling it, a title over its muted subtitle, a price over the caption qualifying it |
| 8px | `gap-2` | compact horizontal peers in one functional cluster — glyph and label, peer tabs, grouped cards, or an input and its direct inline action |
| 12px | `gap-3` | owner-to-owned or independently readable local units — label to card/input, field to field, card to caption, toolbar to governed content, or unrelated groups sharing a row |
| 16px | `gap-4` | two participants that are each already a cluster — a stack over the stack beneath it, an identity cluster against the trailing fact at the far end of its row, a prompt against the action answering it, or peer cards repeating across a grid |
| 24px | `gap-6` | two blocks on a page |
| 32px | `gap-8` | the layout seam — a rail against the column beside it |

`gap-2` requires two facts at once: the peers are horizontal AND they form one functional cluster.
Fail either test and the seam is `gap-3`. Tokens are selected by relationship and grouping, never by
component name or direction. `gap-4` is selected by the participants alone: once each side is itself
composed, the seam between them out-ranks the seams inside them, in a column, a row and a grid
alike.

**There is no zero rung, and its absence is deliberate.** "Touching" and "almost touching" are not a
distinction a second author reproduces from memory, so the surface this replaced ended up spelling
one identity stack both ways. Only the 4px rung survived that, and it survived because it names a
relationship rather than an amount — the second line qualifies the first. A container that wants no
seam declares no gap class, which is a different statement from naming a rung that measures nothing.

**Insets take 16px and 24px symmetric, or 12/8 and 16/12 asymmetric.** And the relationship that
makes an unfamiliar surface decidable is visible in the table rather than asserted over it: **the
house surface carries a 16px inset around a 16px interior seam.** The edge breathes at the rhythm of
the contents, so the two are one decision and not two. An ordinary surface therefore uses `p-4`. A
joined-list surface preserves that same 16px outer edge without insetting its dividers: the vendor
surface and its content host are `p-0`, the list root is `p-0`, a single row is `p-4`, and
first/middle/last rows are respectively `px-4 pt-4 pb-3`, `px-4 py-3`, and `px-4 pt-3 pb-4`. When
the generic surface inset is enforced with `!important`, the joined-list root wins at equal cascade
strength through a semantic `data-component` selector; utility presence is insufficient, and the
proof is computed padding of `0px` on the rendered page.

**Control height has two tokens, selected by placement rather than importance.**

| Token | Placement |
|---|---|
| `sm` | Embedded action inside a row, list item, compact toolbar, card cluster or another control's local seam |
| `md` | Standalone action that owns a line or anchors a form or surface |

The `variant` axis stays independent: it says whether an action is primary, secondary, outline or
tertiary; it does not select height. A primary action may be `sm` in a compact cluster, and a
tertiary action may be `md` when it stands alone. Label length never changes the size token.

## Situation codes

Every situation this module governs carries a code, `TOKEN-<n>`. The code names the SITUATION; the
requirement column names what the source must look like once that situation is recognised. Codes are
cited from other law files and from task records, so a number is permanent even when the wording
around it changes.

| Code | Situation | What the source must look like |
|---|---|---|
| `TOKEN-1` | A layout value is needed that the vocabulary does not contain | The layout vocabulary is a closed union, so an off-scale value cannot be typed at all. Never a value patrolled by convention that the type could have refused |
| `TOKEN-2` | A value genuinely has to be ADDED to the vocabulary | A new member is added deliberately, in the named list, where the diff shows it. Never a value arriving inside a component nobody reviewed closely |
| `TOKEN-3` | A half step appears: `gap-1.5`, `py-1.5`, `size-3.5` | Whole rungs only; the nearest rung when in doubt. Never a fractional step in any family that measures |
| `TOKEN-4` | A bracketed length such as `[13px]`, or a raw colour code | A member of the vocabulary, or a semantic colour token. Never a bracketed length or a raw colour, even when it equals a rung today |
| `TOKEN-5` | Large text plus heavy weight hand-assembled into a heading | Rank comes from the component that owns tag and metrics together. Never large text plus heavy weight assembled from raw classes |
| `TOKEN-6` | A class string is written inside a leaf, or hoisted into a module constant | Rules read class strings in source, including strings hoisted into module constants. Never an assumption that the leaf folder is covered because the tiers above it are typed |
| `TOKEN-7` | A semantic colour is needed: bare mark, soft plate, or solid plate | A bare mark uses `text-*`; a plate pairs `bg-*-soft` with `text-*-soft-foreground`, or `bg-*` with `text-*-foreground`. Never a `*-soft` background token used as an ink colour |
| `TOKEN-8` | A height must be chosen for a control | Size selected from placement, variant selected from priority. Never height inferred from variant, word count, or how loud the control feels; never custom padding used to shrink a control |
| `TOKEN-9` | A class names a token the theme has not defined | The name is a union member AND the variable it requests exists in the stylesheet. Never reporting names the framework resolves itself — `screen`, `full`, `fit`, the viewport units |

## Reading an accepted shape

1. **Read what the shape states.** It states a relationship: this seam separates two clusters, this
   surface is a joined list, this action sits inside a row, this mark is a bare success glyph, this
   figure is the rank of its card.
2. **Name what the shape does not state, and therefore does not resolve.** A shape never states a
   pixel value, a hex code, a class family, a file tier, a union member, a stylesheet variable, or a
   `variant`. Those are resolved here, by code, and a shape that seems to state one is being read as
   a picture rather than as a decision.
3. **Resolve outermost first.** The layout seam before the block seam, the block seam before the
   surface inset, the surface inset before the seam inside it — and remember the edge of a surface
   and the seam inside it are one decision, so resolving the inset resolves the interior rhythm with
   it. Only then resolve the leaf-level measurements, colours and control heights.
4. **Ask each code's question.** Is the value a non-member (`TOKEN-1`), a considered addition to the
   list (`TOKEN-2`), a fractional step (`TOKEN-3`), an arbitrary length or raw colour (`TOKEN-4`), a
   hand-rolled heading (`TOKEN-5`), a string in the folder the union cannot see (`TOKEN-6`), a colour
   used in the wrong role (`TOKEN-7`), a control height (`TOKEN-8`), or a token name whose variable
   may not exist (`TOKEN-9`)?
5. **When two codes both match, the tier and the failure mode separate them.** The same `[13px]` is
   `TOKEN-1` inside a typed entry, where the compiler refuses it, and `TOKEN-4` inside a leaf, where
   a rule catches it. A shrunk control that also carries custom padding is both `TOKEN-8` and
   `TOKEN-4`; the originating code is `TOKEN-8`, and the arbitrary value is reported alongside it.
   Every emitted measurement, colour and control height resolves to exactly one originating code.

## `TOKEN-1` — the scale is a union, so an off-scale value cannot be typed

**Situation.** Somebody needs a seam the vocabulary does not contain, and the first reflex is to
write `gap-[13px]` and move on.

**What it emits in source.** Nothing new. The value is not written, because it is not a member of
`LayoutClassName`. The entry takes the nearest existing rung, or the work moves to `TOKEN-2`.

**Boundary.** Not `TOKEN-4`: same value shape, different tier and different holder — in a typed
entry the compiler refuses, in a leaf the union cannot reach and a rule catches it. Not `TOKEN-2`:
`TOKEN-1` says the value cannot be typed; `TOKEN-2` says what to do if it must become typeable.

## `TOKEN-2` — adding a member changes the scale, and must read that way

**Situation.** The vocabulary is genuinely missing something. The correct move is not to dodge the
union but to open it deliberately, in the named list, where the diff shows it.

**What it emits in source.** One diff in the vocabulary list itself — the union of literals — with
the comment above it honoured: grow this list deliberately, so the addition reads as a decision. No
change at any call site introduces the member.

**Boundary.** Not `TOKEN-1`, which is the refusal itself. Not `TOKEN-3`: a half step is never a
candidate member, because the scale is whole rungs unevenly spaced, so a half step does not sit
between two rungs — it sits outside the scale.

## `TOKEN-3` — a half step is not between two rungs, it is off the scale

**Situation.** An `x.5` value appears in any family that measures: `gap`, `p`, `m`, `space`, `size`,
`w`, `h`, `inset` and their edges.

**What it emits in source.** A whole rung — the nearest one when in doubt. The `FRACTIONAL` pattern
and the `noFractionalStep` rule built from it hold this in product source.

**Boundary.** Not `TOKEN-4`: `size-3.5` is a fractional step, `size-[14px]` is an arbitrary value.
They draw the same thing and fail in two different ways, so they are two codes. Not `TOKEN-2`: a
half step is not a proposal for a new member.

## `TOKEN-4` — an arbitrary value leaves the system, whatever it equals

**Situation.** A bracketed length, or a raw colour code. Chosen once, by one person, for one screen.

**What it emits in source.** A member of the vocabulary for a measurement, or a semantic colour
token for a colour. `ARBITRARY_LENGTH`, `RAW_COLOUR` and the two message ids in `noArbitraryValue`
hold this — one message for `length`, one for `colour`.

**Boundary.** Not `TOKEN-1`: same value shape, different tier, different holder. Not `TOKEN-7`:
`text-[#16a34a]` is a raw colour, while `text-success-soft` on a bare mark is a semantic colour used
in the wrong role — one stands outside the palette, the other stands inside it wearing the wrong
role. Not `TOKEN-9`: `max-w-[64rem]` is arbitrary; `max-w-app-lg` with no variable defined is
unresolved. Both are broken, but only one looks correct.

## `TOKEN-5` — rank comes from the type scale, not from a hand-assembled pair

**Situation.** Large text plus heavy weight. That IS a heading, whatever tag carries it.

**What it emits in source.** The heading leaf, where `level` drives tag and metrics as one decision.
`LARGE_TEXT` and `HEAVY_WEIGHT` tested together are what `noHandRolledHeading` looks for.

**Boundary.** Not `TOKEN-4`: `TOKEN-5` says nothing about whether the values are on the scale —
`text-2xl` and `font-bold` are both valid members; the fault is combining them here. Not `TOKEN-1`:
the union cannot save this code, because both classes are members. What is lost is not the type size
but the document structure, and structure does not appear in a screenshot.

## `TOKEN-6` — the rule exists for the folder the union cannot see

**Situation.** Every tier above the leaf takes its classes from a typed entry, so the union already
holds them. The leaf writes its own classes and is exempt from entry law by policy — so it is the
one place an off-scale value can still be typed.

**What it emits in source.** A reader that covers the whole folder: `isSourceFile` and the
`VariableDeclarator` branch of `classTextVisitors` implement it, and `LEAF_DIR_RELATIVE` /
`isLeafFile` name the exempt folder. Nothing reports a violation of this code — no rule can fail when
coverage is missing, so the gap is invisible from the outside.

**Boundary.** Not `TOKEN-3` and not `TOKEN-4`: those two say which value is wrong; `TOKEN-6` says
where a rule must look to see it at all. Without `TOKEN-6` those two miss exactly the folder they
were written to cover. Not `TOKEN-1`: `TOKEN-1` covers the entry tier and `TOKEN-6` covers its
complement; only together are they closed. Hoisting to a constant is concealment, not permission —
the last off-scale value in the codebase these rules were written for lived in exactly such a
constant.

## `TOKEN-7` — a semantic colour is paired with the surface carrying it

**Situation.** There are three roles, not one. A bare mark uses `text-success`. A soft plate pairs
`bg-success-soft` with `text-success-soft-foreground`. A solid plate pairs `bg-success` with
`text-success-foreground`. Warning and danger follow the same three roles.

**What it emits in source.** A tone table that pairs `bg-*-soft` with `text-*-soft-foreground`, and
a bare mark that uses plain `text-success`. Nothing mechanical holds this: pairing is a two-class
relationship no rule in the token rule file looks for.

**Boundary.** Not `TOKEN-4`: `TOKEN-7` is the right palette in the wrong role, `TOKEN-4` is outside
the palette entirely. Not `TOKEN-1`: the union can accept both names, because both are valid tokens.
What is wrong is the pair, and a pair is not a member.

## `TOKEN-8` — size follows placement, variant follows priority

**Situation.** Choosing a height for a button. There are only two tokens, and both name a
reproducible relationship: `sm` is an action embedded in a row, list item, compact toolbar or card
cluster; `md` is an action that stands alone, owning a line or anchoring a form.

**What it emits in source.** `export type ButtonSize = "sm" | "md"` and the comment stating size
follows placement, independently of visual priority. The size union closes the set to two, so a
third height is unrepresentable — but WHICH of the two is right is a placement judgement nothing
checks.

**Boundary.** Not `TOKEN-4`: custom padding used to shrink a control usually drags in a half step or
a bracketed value, so two codes fire at once and the originating code is still `TOKEN-8`. Not
`TOKEN-1`: the size set is closed at two, so a third height cannot be typed — but picking the wrong
one of the two still can, which is why this code sits at `documented`. Label length never changes the
size token: a long-labelled button is still an embedded button if it is embedded.

## `TOKEN-9` — a class naming a token means nothing until the theme defines it

**Situation.** `max-w-app-lg` is not a width. It is a request sent to the variable
`--container-app-lg`. When that variable does not exist, the class is still emitted, the element
still renders, and nothing is red.

**What it emits in source.** A name that is a union member AND a stylesheet that defines the
variable it requests — `TOKEN_CLASS_FAMILIES` and `TAILWIND_OWN_NAMES` on the rule side, the
`--container-app-*` variables the `max-w-app-*` names request on the theme side. Held by
`no-unresolved-token-class`.

**Boundary.** Not `TOKEN-1`: this is the one dead value the union cannot catch, and it is worse than
a genuine off-scale value for that reason — an off-scale value does not compile, while this one
passes every gate and reaches production. Not `TOKEN-4`: an arbitrary value stands outside the
system while this one looks correct. Names the framework resolves itself are out of scope: `screen`,
`full`, `fit`, `auto`, `none`, `min`, `max`, `prose`, `px` and the viewport units promise nothing
about this theme, and reporting them sends an author to define a variable nothing reads — measured
across two repositories on the first run: two findings, both wrong, both from this list.

## Layer held

Which tier actually holds each code. A rule is named only where one was found in `tokens.mjs` and
read; everything else is `documented`, and that gap is a measurement, not a failure.

| Code | Tier | What holds it |
|---|---|---|
| `TOKEN-1` | `unrepresentable` | The closed `LayoutClassName` union. `gap-[13px]` is not refused; it is not a member |
| `TOKEN-2` | `documented` | Nothing mechanical. A union can refuse a non-member; it cannot judge whether a new member was a considered decision |
| `TOKEN-3` | `enforced` | `no-fractional-step` |
| `TOKEN-4` | `enforced` | `no-arbitrary-value` (two messages: `length` and `colour`) |
| `TOKEN-5` | `enforced` | `no-hand-rolled-heading` |
| `TOKEN-6` | `documented` | Nothing reports a violation of it. `isSourceFile` and the `VariableDeclarator` visitor in `tokens.mjs` IMPLEMENT it; no rule can fail when coverage is missing |
| `TOKEN-7` | `documented` | Nothing mechanical. Pairing is a two-class relationship no rule in `tokens.mjs` looks for |
| `TOKEN-8` | `documented` | The size union closes the set to two, so a third height is unrepresentable — but WHICH of the two is right is a placement judgement nothing checks |
| `TOKEN-9` | `enforced` | `no-unresolved-token-class` |

Four codes are `enforced`, one is `unrepresentable`, four are `documented`. The vocabulary type owns
the entry tier and the leaf folder stays outside it by policy; the rule file owns product source
under `src/`, and tooling and configuration stay ignorant of all of it because they render nothing.

## Inputs

| Input | Evidence required |
|---|---|
| class string | The literal text, whether written in markup, hoisted into a module constant, or listed in an entry array |
| tier | Which folder the file sits in — typed entry tier, or the leaf folder that writes its own classes |
| vocabulary | The current union members, read from the union itself and not from memory |
| theme | The stylesheet that defines the variables a token name requests |
| placement | For a control: embedded in a row or cluster, versus standalone and owning a line |
| role | For a colour: bare mark, soft plate, or solid plate |

## Rules

1. An off-scale layout value is unrepresentable, not merely refused.
2. A new member of the vocabulary is a diff in the named list, never a value introduced at a call
   site.
3. No measurement takes a fractional step, in any family.
4. No bracketed length and no raw colour appears in product source, whatever it evaluates to.
5. Rank is emitted by the component that owns tag and metrics together, never assembled from
   classes.
6. A rule that reads class strings reads constants as well as markup.
7. A background token is never used as a foreground token.
8. Size comes from placement and variant comes from priority; the two axes never select each other.
9. A class naming a theme token resolves only when the stylesheet defines its variable.
10. The edge of a surface and the seam inside it are one decision.
11. Every emitted measurement, colour and control height resolves to exactly one code.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Positional selectors in an entry.** `TOKEN-1` admits `[&>*]:px-4`-shaped members inside the
  entry table and nowhere else, because a joined list must inset its rows without insetting the
  dividers between them.
- **Names the framework resolves itself.** `TOKEN-9` does not apply to `screen`, `full`, `fit`,
  `auto`, `none`, `min`, `max`, `prose`, `px` or the viewport units. They promise nothing about this
  theme, and reporting them sends an author to define a variable nothing reads.
- **No stylesheet found.** `TOKEN-9` stays silent rather than calling every token dead. A reader
  that cannot find the theme has no evidence, and no evidence is not a finding.
- **Product source only.** `TOKEN-3`, `TOKEN-4`, `TOKEN-5` and `TOKEN-9` read files under `src/`.
  Tooling and configuration are out of scope, because they render nothing.
- **Equal cascade strength.** Where a generic inset is enforced with `!important`, `TOKEN-1`'s
  preference for utilities yields to a semantic `data-component` selector — a utility cannot beat an
  important declaration, and the proof of the exception is computed padding on the rendered page.
- **State parity.** Holding across every code: skeleton and real content share every token. Changing
  an inset or a control size while loading is a lie about the relationship, and it makes the layout
  jump when the data arrives.

## Output

One block per file the accepted shape produces, and one block per value inside that file that this
pattern resolves.

```text
value: <the class or token as written>
tier: <entry | leaf>
code: <TOKEN-1 … TOKEN-9>
holder: <unrepresentable | enforced:<rule-name> | documented>
verdict: <member | replace with <member> | define <variable> | pair with <token>>
reason: <the fact that excludes the adjacent code>
```
