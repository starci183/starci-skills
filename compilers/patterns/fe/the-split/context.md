# The-split

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |

## Record

The input to this pattern is a shape someone already accepted: a layout, a block, a capability or a
contract that has been agreed. The design decision is closed here and is never re-opened. What this
pattern produces is source architecture — how many files the accepted surface becomes, which file
holds the request, which file holds the tree, what crosses between them, what the second file is
named and what each file may import.

## Law

A surface that owns a request is two files. `index.tsx` fetches, settles which situation the reader
is in, and resolves the words. `component.tsx` takes an already-settled situation and draws it.

The split is not organisational tidiness. It is a line drawn so that **everything that can be wrong
about DATA lives in one file and everything that can be wrong about DRAWING lives in the other** —
and neither review has to read the other file.

One question settles which half a line belongs to: **could this be wrong while the network is
fine?** A wrong tree, a wrong seam, a missing state: drawing. A wrong request, a wrong situation,
the wrong word chosen: data.

**This is binding, not advisory.** Every surface that reads the world resolves to the six codes
below, and each code is either held or broken — there is no size at which a surface is too thin to
carry them. "It is one leaf" and "it has no state yet" are not exemptions; they are the two places
the line is most often crossed, because they are the two places where crossing it costs nothing
today.

## Situation codes

Every situation this module governs carries a code, `SPLIT-<n>`. The code names the SITUATION; the
last column names what that situation obliges the source to look like.

| Code | Situation | What the source must look like |
|---|---|---|
| `SPLIT-1` | The drawing half receives everything already decided and asks no one | The drawing half receives every value already decided, so it renders from a fixture. Forbidden: any request, store read, locale read or translation call inside `component.tsx` |
| `SPLIT-2` | The connected half settles the situation, not how it looks | The connected half decides WHICH named situation this is, and hands it down. Forbidden: the connected half deciding how a situation looks, how far apart things sit, or which element draws what |
| `SPLIT-3` | The situation crosses the line as one name, not a handful of flags | The situation crosses as one value from a closed set. Forbidden: a bag of booleans crossing the line — `isLoading`, `hasError`, `isEmpty` as incoming props |
| `SPLIT-4` | Copy is resolved before it crosses | Copy crosses resolved: the drawing half receives words. Forbidden: a translation key, a message id or a locale crossing the line |
| `SPLIT-5` | The connected half draws nothing of its own | The connected half imports exact `_${FolderName}` from `./component` and renders that one component on every JSX path. Forbidden: a connected file rendering a leaf, a branch or an alternate tree of its own |
| `SPLIT-6` | A surface with no request is not split | A surface with no request stays one file. Forbidden: a second file created for a component that fetches nothing |

`SPLIT-6` IS A LIMIT, NOT AN OPT-OUT. It states where the law stops applying, which is what keeps
the other five from becoming ceremony. The split exists because a request exists; where there is no
request there is no data half, so the second file would hold nothing the first could get wrong.

`SPLIT-5` HAS NO THIN-BLOCK EXCEPTION. One leaf, one tree in every state, no local domain state, or
a presentational twin that only forwards props are the cases most likely to grow a second situation
later. They cross the same exact twin.

## Reading an accepted shape

1. **Read what the shape states.** It states the surface: which folder owns this piece of the
   screen, what it shows, and which situations the reader can be in.
2. **Read what the shape does not state, and therefore does not resolve.** An accepted shape never
   says how many files it becomes, whether the words arrive as keys or as sentences, whether the
   lifecycle crosses as one name or as several booleans, or what the twin is called. Those are not
   gaps in the decision; they are this pattern's output, and only the codes below resolve them.
3. **Resolve outermost first.** Take the outermost surface in the shape, ask `SPLIT-6` of it, and
   only then descend. A parent whose children each own a request owns none itself, so resolving it
   first stops you from inventing a data half for a file that reads nothing.
4. **Ask each code's question of every surface, in order.** Does this file read the world
   (`SPLIT-6`)? Does the drawing half ask anyone anything (`SPLIT-1`)? Does the connected half decide
   appearance (`SPLIT-2`)? Does the lifecycle cross as one name (`SPLIT-3`)? Do the words cross
   resolved (`SPLIT-4`)? Does every JSX path go through `XBase` (`SPLIT-5`)? Each answer is *holds* or
   *breaks*; there is no third answer.
5. **When two codes both match, record both.** Calling a translation hook inside `component.tsx`
   breaks `SPLIT-1` because the drawing half asked the world, and breaks `SPLIT-4` because the words
   should have been resolved one file earlier. Codes are not mutually exclusive and the second one is
   not absorbed by the first — the discriminator is which side of the line the fault is on, not which
   code you noticed first. Where the two codes describe the same file from opposite directions
   (`SPLIT-2` is a presentation decision leaking through props; `SPLIT-5` is markup sitting in the
   connected file), the fact that decides is the form of the leak: passing `variant="compact"` breaks
   `SPLIT-2`, writing a `<div>` breaks `SPLIT-5`.

## `SPLIT-1` — the drawing half receives everything and asks nothing

**Situation.** `component.tsx` must render from a fixture: hand it a props object and it draws
exactly what it should draw, with no request stood up, no store stood up, no translation runtime
stood up.

The reason is not tidiness. A component that cannot render from a fixture cannot be tested, because
testing it means standing up the whole world first. That cost is not paid at the first writing; it is
paid every time afterwards, each time someone wants to check one state.

**What it emits in source.** A `component.tsx` whose imports are components, types and pure helpers
only, and whose props carry every value it draws.

**Recognition signs.**

- `component.tsx` calls a request hook, a store hook, a translation hook, a locale hook or a
  formatter.
- Writing a test for it requires mocking something that is not props.
- The file has an `if` branching on data that has not been given a name — it is settling a situation
  of its own.

Ask: hand this file a plain props object; does it draw every state without anything else?

**Boundary.** It is not `SPLIT-2`: `SPLIT-1` says the drawing half may not ask, `SPLIT-2` says the
connected half may not draw — two directions of the same line, and one file can break exactly one of
them. It is not only `SPLIT-4`: calling `useTranslations` in the drawing half breaks both, `SPLIT-1`
because it asked the world and `SPLIT-4` because the words should have been resolved a file earlier.

## `SPLIT-2` — the connected half settles the situation, not the appearance

**Situation.** The connected half knows one thing nobody below it knows: whether the data has
arrived, whether it is empty or full, whether it is broken or sound. It settles the situation and
hands it down. It does not decide how that state looks, how far apart things sit, or which element
draws what.

The reason: the connected half cannot see the consequences of a presentation decision it makes. It
does not know what sits beside it and does not know how the other state looks, so it is choosing a
spacing or a variant blind. The drawing half sees the whole tree.

**What it emits in source.** An `index.tsx` carrying the request and the situation, with no
`className`, no spacing value and no element choice anywhere in it.

**Recognition signs.**

- `index.tsx` contains a `className`, a spacing value or an appearance variant name.
- It passes down a `size`, `tone` or `compact` prop that is not a business fact.
- It passes down a pre-formatted string chosen to fit a space, rather than because that is the real
  number.

Ask: could this decision be wrong while the network is fine? If yes, it belongs to the drawing half.

**Boundary.** It is not `SPLIT-1`, which governs the opposite direction of the same line. It is not
`SPLIT-5`: `SPLIT-2` is a presentation decision leaking through props, `SPLIT-5` is markup sitting
directly in the connected file. Passing `variant="compact"` breaks `SPLIT-2`; writing a `<div>`
breaks `SPLIT-5`.

## `SPLIT-3` — the situation crosses as one name

**Situation.** What crosses the line is one value drawn from a closed set: `state="pending"`,
`state="failed"`, `state="settled"`. Not `isLoading`, `hasError`, `isEmpty` travelling as three
parallel props.

The reason is arithmetic. Four booleans open sixteen combinations, most of which nobody has ever
seen: loading and failed and empty at once is a state that does not exist, yet the type still permits
writing it. One name from a union does two things at once: every situation that is real must be
drawn, and every situation that is not real cannot be written.

**What it emits in source.** An exported props type in `component.tsx` that is a union of members
discriminated by a literal `state`.

**Recognition signs.**

- The drawing half's props carry two or more independent booleans describing the same lifecycle.
- The drawing half contains `if (isLoading) … else if (hasError) …` — the order of the branches is
  standing in for a closed set.
- There is a combination of flags nobody can say what it draws.

Ask: is there a writable combination of props that corresponds to no real situation?

**Boundary.** It is not `SPLIT-2`: `SPLIT-2` asks *who* settles the situation, `SPLIT-3` asks what
shape that situation takes as it crosses. A correctly settled situation can still be sent across as a
handful of flags.

## `SPLIT-4` — copy is resolved before it crosses

**Situation.** The drawing half receives words, not keys. A translated string is a value like any
other; a key is not — it is a promise that somewhere there is a translation runtime that will turn it
into words.

The reason: a component that looks a key up has taken on a dependency on the whole translation
runtime, for work that was finished one file earlier. The price shows up in tests: to check one line
of copy you must stand up the whole translation layer, and at that point `SPLIT-1` breaks with it.

**What it emits in source.** Copy-carrying boundary props declared in `component.tsx` typed `string`
and holding sentences, filled by the JSX in `index.tsx`.

**Recognition signs.**

- A prop named `*Key`, or an `*Id` carrying the meaning of copy, or a string with dotted namespacing
  like `quest.failed`.
- The drawing half imports anything from the translation layer.
- There is a string that does not read as human language.

Ask: is this string readable the moment it reaches the reader, or does it still need one more lookup?

**Boundary.** It is not `SPLIT-1`: calling a translation hook in the drawing half is `SPLIT-1`, and
passing a key down for the drawing half to look up is also `SPLIT-1`; but passing a key down which is
then passed further down is caught only by `SPLIT-4`. Identity strings are not copy — an `id`, a
`slug` or a selection key crossing the line is data, and crosses freely.

## `SPLIT-5` — the connected half draws nothing of its own

**Situation.** The connected file imports exactly `_${FolderName}` from `./component`, and every one
of its JSX paths renders that component. No branch veers off to another leaf, another branch or an
alternate tree.

The reason: a connected file that renders a tree of its own has become both halves, and the line
loses its meaning the first time it is crossed. After that nobody can say "reviewing this half does
not require opening the other file", because something might be sitting on the other side.

**What it emits in source.** `import { XBase } from "./component"` in `index.tsx`, where `X` is the
folder name, and `XBase` is the only JSX identifier the file renders.

**No thin-block exception.** One leaf, one tree in every state, no local domain state, or a twin that
only forwards props — those are precisely the cases most likely to grow a second situation. They
cross the same exact twin.

**Recognition signs.**

- The connected file has a JSX identifier other than `XBase`.
- The connected file imports `XBase` but has a `return` branch that does not go through it.
- There is an early branch like `if (error) return null` — that branch has drawn something (drawing
  nothing is also a presentation decision) without crossing the twin.

Ask: does every render path of this file go through exactly one component?

**Boundary.** It is not `SPLIT-2`, which is a presentation decision leaking through props rather than
markup in the file. It is not `SPLIT-6`: `SPLIT-5` applies only to a surface that *has* a request, and
demanding a twin from a file that reads nothing contradicts `SPLIT-6`.

## `SPLIT-6` — no request means no split

**Situation.** For a component that fetches nothing, two files are ceremony: there is no data half,
so the second file holds nothing the first one could get wrong.

This is where the law stops, and that stop is what keeps the other five from turning into procedure.
The line is worth its cost because it separates two kinds of fault; where there is only one kind of
fault, drawing another line only creates another file to open.

**What it emits in source.** A folder holding `index.tsx` and no `component.tsx`.

**Recognition signs.**

- `index.tsx` makes no request, reads no store, reads no locale — it only takes props from its
  parent, or composes other connected surfaces.
- `component.tsx` does nothing but receive props and pass them straight down.
- Changing one line means opening two files, and those two files have never yet been wrong for two
  different reasons.

Ask: does this file ask the world anything? If not — one file.

**Boundary.** It is not `SPLIT-5`: the moment this surface *adds* a request, `SPLIT-6` stops applying
and `SPLIT-5` turns on, and that is a real file split rather than a rename. Local UI state is not a
request: holding which overlay is open or which tab is selected reads nothing and settles nothing, so
it creates no data half. A surface composed of connected surfaces is not itself connected: each child
settles its own situation, and the parent has nothing to resolve, so it has no twin.

## Layer held

Which tier actually holds each code. `enforced` names the rule from `@canon-fe` that
catches it; `documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | Held by |
|---|---|---|
| `SPLIT-1` | `enforced` | `presentational-purity` — reports any call whose callee matches the request, store, locale and formatter families, in any file named `component.tsx` |
| `SPLIT-2` | `documented` | Nothing. A file that settles the wrong situation and a file that settles the right one have the same syntax tree |
| `SPLIT-3` | `documented` | Nothing at the point of authorship. Once a discriminated union IS written, the type makes the sixteen-combination props object unwritable at every call site — but no rule requires the union to be written |
| `SPLIT-4` | `documented` | Nothing for the half that matters. `presentational-purity` catches the translation CALL in the drawing half, which is already `SPLIT-1`; a key crossing as a `string` prop is invisible to a syntax tree |
| `SPLIT-5` | `enforced` | `connected-block-has-presentational-twin` — three messages for the three failures: `missing` (no twin imported), `bypass` (something else rendered), `unused` (twin imported, never rendered) |
| `SPLIT-6` | `documented` | Nothing. A folder with two files where one would do is a correct program; only a reader can see the second file holds nothing |

Two of six are enforced. That gap is the honest state of this law. The lint layer owns `SPLIT-1` and
`SPLIT-5`; the reviewer owns `SPLIT-2`, `SPLIT-3`, `SPLIT-4` and `SPLIT-6`, and no other layer may be
credited with holding them.

## Inputs

| Input | Evidence required |
|---|---|
| surface | The folder that owns the request |
| request | Whether this surface reads the world at all, or receives everything from a caller |
| situations | The closed set of named states that request can produce |
| copy | Where each visible string is resolved |
| twin | The `_${FolderName}` the folder fixes |

## Rules

1. Everything that can be wrong about data lives in `index.tsx`; everything that can be wrong about
   drawing lives in `component.tsx`.
2. The discriminator is one question: could this be wrong while the network is fine?
3. The drawing half renders from a fixture, with no world stood up first.
4. A situation crosses the line as one value from a closed set, never as several independent
   booleans.
5. Copy crosses the line resolved.
6. A connected file renders exactly one JSX identifier of its own: its `XBase` twin.
7. A surface with no request is one file.
8. Neither review has to read the other file.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Flags below the line.** `SPLIT-3` bans flags CROSSING. Deriving `isLoading` from `state` inside
  the drawing half, and passing that boolean further down to something presentational, is the
  drawing half doing its own job.
- **Local UI state is not a request.** `SPLIT-6` turns on a request. Holding which overlay is open,
  or which tab is selected, reads nothing and settles nothing, so it does not create a data half.
- **A surface composed of connected surfaces.** Under `SPLIT-6`, a file whose children each own
  their own request owns none itself: it has no twin, because it has nothing to resolve.
- **A twin that only forwards.** Not an exception to `SPLIT-5`. A twin whose whole body forwards its
  props is still the crossing point, and it is the file the first added state will land in.
- **Identity strings are not copy.** Under `SPLIT-4`, an id, a slug or a selection key crossing the
  line is a value like any other. What is banned is a string the drawing half would have to look up.
- **There is no "this block is thin" exception.** For `SPLIT-5`, thin is a reason to split, not a
  reason to skip.

## Output

One block per surface folder the accepted shape produces.

```text
surface: <folder>
request: <yes | no>
files: <index.tsx + component.tsx | index.tsx only>
twin: <XBase | none>
situations: <closed set of state names | none>
codes: <SPLIT-1..SPLIT-6, each holds | breaks>
reason: <which half could be wrong while the network is fine>
```
