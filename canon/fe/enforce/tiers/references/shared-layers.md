# Which tiers are shared, and which belong to one app

The tiers are not all the same kind of thing. Some belong to no app and are shared by every app
that reads the book; the rest live under an app's own name. Where that line falls is the single
decision that makes one storybook serve several products instead of one.

**This file explains the boundary. It does not record where any particular repo drew it** — ask
the repo:

```bash
node .claude/scripts/scan-storybook-architecture.mjs <path-to-repo>
```

It reports the tiers it found at the top level (shared) and the app namespaces beneath them
(per app), because a book is the source of truth for its own architecture. A description written
here would be a copy, and a copy drifts.

## The shape

```
components/
  <lower tiers>        at the top level — shared, belong to no app
  <app>/               a namespace per app
    <upper tiers>      only these live inside it
```

A new app does not start a design system. It gets a namespace for its upper tiers and **inherits**
the lower ones.

## Where the line falls, and why it holds

Exactly where **domain knowledge** starts.

A composite takes shapes — `items`, `title`, `onPress`. A block takes an entity. That one
difference decides everything: a component that knows no domain can serve any product, and a
component that knows one cannot serve a second without dragging that domain along.

So the boundary is not a filing convention someone chose. It is the point past which a component
stops being reusable, and the folder layout only makes it visible.

## The rule this produces

**A shared tier has exactly one home.** Adding an atom means adding it once, at the top level —
never a copy under an app namespace.

The copy is what to watch for, because it is invisible at the moment it happens: the code compiles,
the story renders, the app looks right. What changed is that two apps now hold two atoms with one
name, and from that point their vocabularies drift apart with nothing announcing it. Months later
two products disagree about what a "chip" is and nobody can say when it started.

`scan-storybook-architecture.mjs` reports it when a shared tier appears under an app namespace, precisely because nothing
else in the tree will.

## What must match across repos, and what must not

| Must match | Must not be copied |
|---|---|
| which tiers are shared and which are per app | how many files each tier has |
| the import direction, downward only | which app namespaces exist |
| the one legal exception, frame → atom for its own chrome | any particular repo's leak count |

A smaller product with a tenth of the components is not behind — it is smaller. Reading a
reference measurement as a target is how a team invents components to reach a number.

See `references/how-to-read-a-scan.md` for what the scan output means, and the warning that goes with
them. See `references/tier-boundaries.md` for why each individual boundary sits where it does.
