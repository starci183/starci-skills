# frame

Direction, seam, alignment, and its own chrome between children.

> **Read the worked examples first:** [`../examples/frame.md`](../examples/frame.md) — real components
> at this tier, each with what it renders and why it sits here. The rules below are easier to judge
> once the examples are in front of you.

## At a glance

| | |
|---|---|
| group | vocabulary — a word any product can use |
| owns | direction, seam, alignment, and its own chrome between children |
| never | asks what its children are |
| may import | atoms, and only to place its own chrome |
| takes `className` | **no — `classNames: Array<AllowedClassName>`, the same closed union an atom takes** |
| composes classes (`cn`) | yes |
| names itself | no — it takes `anatPart` from the caller |
| tiers below | atom |

## Rules

**FRAME-1 · It owns direction, seam, alignment, and its own chrome between children.**

Anything outside that scope belongs to another tier, whatever the folder says.

**FRAME-2 · It never asks what its children are.**

This is the line that decides the tier, not a preference about style.

**FRAME-3 · It may import: atoms, and only to place its own chrome.**

Imports run downward only. A lower tier that reaches up stops being usable anywhere the upper tier is absent.

**FRAME-4 · The prop is `classNames: Array<AllowedClassName>` — the same closed union an atom takes, and nothing more.**

A frame decides how its children sit; where **it** sits is its parent's business, exactly as with an
atom. That is the same class of decision, so it gets the same closed list — see
[`atom.md`](atom.md) ATOM-5 for the union itself and the reasoning behind closing it.

Being one tier up buys nothing here. "It is vocabulary, so the caller adjusts it" is not an
argument: the caller adjusting **position** is the point, and the caller adjusting **appearance** is
the failure — and a `string` cannot tell the two apart at either tier.

The tempting exception is that a frame's own look — its gap, its padding, its alignment — feels like
something a caller should reach for. It is not passable. Every one of those is already a prop on a
named scale (`gap`, `padding`, `align`, `justify`), which is what makes two frames on two screens
land on the same rhythm. A caller writing `gap-6` has left the scale, and the scale is the product.

**FRAME-5 · It composes classes (`cn`): yes.**

Deciding appearance is exactly this tier's work.

**FRAME-6 · It belongs here when: every prop is about arrangement, none about content.**

Use this to confirm a placement, not to argue one.

**FRAME-7 · It is in the wrong tier when: a prop makes the caller describe its own content.**

This is the detection signal — the thing to look for in review.

**FRAME-8 · A frame may import an atom for chrome it owns — and when the chrome exists as an atom, it MUST import it rather than draw its own.**

A divider it places between children, decided by its own boolean. The test for whether the reach is
legal: is the imported thing something the caller handed in? If yes, the frame is doing a
composite's job.

The second half is the one that gets skipped. A frame that hand-draws a separator — a `·`, a
border, a thin span — has minted a piece of the design system that has no name, no props, no story
and no way to be changed system-wide. It also means two frames answer *the same question* two ways:
one asks the `Divider` atom, the other decides for itself, and no review comparing them will
mention it because both look reasonable alone.

If the chrome genuinely has no atom, that is a missing atom. Add it — do not inline it.

**FRAME-9 · A frame takes `items` or named slots. Never `children`.**

| What the frame does | Takes |
|---|---|
| repeats a list | `items` data |
| holds one region | one named slot — `body` |
| holds several roles | one named slot each — `start`/`end`, `rail`/`body`, `main`/`aside` |

**Why not `children`, even where it reads naturally.** `children: ReactNode` is a door that can
never be narrowed. It accepts anything, forever, and no future version of this component can say
otherwise without breaking every caller at once — because the thing it would have to constrain has
no name to constrain.

A named slot keeps that door open for the compiler. Today it is `ReactNode` and nothing is enforced.
Tomorrow it can become an array of a known element type, a union of the tiers allowed inside, a
count. Each of those is a one-line change to a type nobody has to rename. This is the same move as
`className: string` → `classNames: Array<AllowedClassName>`, one level up: the value did not change,
the *ability to say something about it* did.

> **Test:** if you later wanted the compiler to reject a wrong child here, where would you write the
> type? If the answer is "nowhere", the contract is `children` and it is wrong.

**The Fragment is not the cost.** `body={<>…</>}` looks like ceremony next to
`<Stack>…</Stack>`, and it is — three characters buying a named type. A frame arranging N unlike
children is exactly the case where a constraint will eventually be wanted, so it is the last place
to trade the name away for brevity.

**One door, not two.** A frame offering a slot *and* `children` as a shorthand has both problems at
once: `body ?? children` means half the call sites are unconstrainable, and the prop list no longer
says how the frame is called. A slot is also greppable — `body={` finds every caller — and it can
gain a sibling (`header`, `footer`) without touching anyone, because there is something to name the
new one against.

Where a frame has a `.Base` with named slots, the shorthand form uses **the same names**.

**FRAME-10 · A frame that changes shape names the width where it changes — as a prop, never buried in a class.**

```ts
at: "sm" | "md" | "lg"      // yes — the threshold has a name and a place to be read
wrap?: boolean              // no — a row whose child can shrink almost never wraps
stackOnMobile?: boolean     // no — "mobile" is not a width
className="@app-xl:flex-row"  // no — the threshold exists but nobody can find it
```

Two ways to break this, and the second is worse.

**A boolean threshold** says *that* the shape changes and refuses to say *where*. `wrap` is the
classic: it fires when the content happens to overflow, which depends on the string, the
translation, the font — so the same frame breaks at a different width on every screen, and none of
them is the one anybody designed.

**A threshold buried in a class string** is worse because it looks solved. The frame does change at
a real, deliberate width — but the width is inside `cn(...)`, so it is absent from the prop list,
absent from the type, and absent from every review that reads the API. Two frames doing the same job
drift to different breakpoints and nothing shows it. If a frame changes shape, that fact is part of
its contract, and a contract lives in the props.

**FRAME-11 · Every frame takes the part name. Only a frame with chrome of its own takes the switch.**

```ts
anatPart?: string       // ALWAYS — what to call this part; the caller decides
showAnatomy?: boolean   // ONLY if this frame draws chrome it must also name
```

Not optional decoration on the tier: a design system that cannot point at its own parts cannot be
reviewed, and a frame missing from that map is missing from every review of every screen it holds.

**The name always comes from the caller.** FRAME-2 says the frame never asks what its children are,
so it cannot know whether it is arranging a card header or a footer — both are the same stack. Only
the caller can tell them apart, and a frame hard-coding its own name labels every one of them
identically, which makes the overlay useless exactly where a screen is densest.

**The switch is not universal, and this is where it gets written wrong.** The switch does not turn
the frame's own badge on and off — the caller passing `anatPart` already decided that. Its one job
is naming **chrome the frame drew itself**: the divider a stack interleaves, the wrapper a grid adds
around each cell. That chrome has no caller to name it, so the frame must, and the switch is how it
knows the overlay is asking.

Which means: a frame with no chrome has nothing to name, and `showAnatomy` on it is a prop that
promises a behaviour and has none. A caller flips it and nothing happens. This follows straight from
FRAME-8 — chrome is the only thing a frame draws itself, so it is the only thing a frame names
itself.

> **Test:** does this frame render anything the caller did not hand it? No ⇒ it must not declare
> `showAnatomy`. Yes ⇒ it must declare it **and read it**.

A declared-but-never-read prop is the same failure as a comment claiming intent: it states a
contract the code does not keep, and it survives precisely because nothing checks it. The gate reads
usage, not declaration, for exactly this reason.

Contrast with [`atom.md`](atom.md) ATOM-10, which is the same rule read the other way: an atom
supplies its own name and must not accept one. Full reasoning in
[`../concept.md`](../concept.md) — *a name belongs to whoever knows it*.

## Notes

_Empty on purpose. Anchored rules for `frame` go here — each from something that actually broke,
with the case that proves it._

---

Examples: [`../examples/frame.md`](../examples/frame.md) · Architecture: [`concept.md`](../concept.md)
