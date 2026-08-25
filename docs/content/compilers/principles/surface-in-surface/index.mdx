---
title: Surface-in-surface
---

# Surface-in-surface

## LOADS

None.


## Record

You are given a plain request in prose — "a card with a lesson list inside it" — and you return, for
every container that request implies, one situation code and one className. The request never states
a border, a shadow or a background, and you never choose one by eye: the boundary follows from what
already owns a boundary around the container and from whether the container owns a group of its own.

## Law

A boundary is a **membership claim**: it says "these things are one nameable group, and that group is
not the group around it". Draw a boundary only when such a claim is true, and draw it in the form the
host allows.

An independent page object may **elevate**. A distinct, nameable nested group may **outline**. A
duplicate, ordinary or unnameable nested claim stays **flat**.

A surface class states boundary ownership only. Spacing, inset and offset belong to other modules and
never appear in this module's output.

**This is binding, not advisory.** Every container that renders falls under exactly one code below —
including the ones that emit nothing. There is no composition too small to be exempt: a two-line
description inside a card is `SURFACE-IN-SURFACE-4` for the same reason a page-wide row set is
`SURFACE-IN-SURFACE-2`. "It is just a wrapper div" is not an exemption; it is the most common place
this rule gets skipped, and it is exactly how a page ends up with three boundaries saying the same
thing.

## Situation codes

Every situation this module governs carries a code, `SURFACE-IN-SURFACE-<index>`. The code names the
SITUATION; the className column names what that situation emits. They are not the same thing, and two
of them emit no visible boundary at all.

| Code | Situation | className |
|---|---|---|
| `SURFACE-IN-SURFACE-1` | An independent object sits directly on page ground | `rounded-2xl bg-card shadow-surface` |
| `SURFACE-IN-SURFACE-2` | One page-level set of comparable rows | `overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border` |
| `SURFACE-IN-SURFACE-3` | A section only names peers that already own boundaries | `bg-background shadow-none` |
| `SURFACE-IN-SURFACE-4` | Nested membership is the same as the host's, ordinary, or unnameable | `bg-transparent shadow-none` |
| `SURFACE-IN-SURFACE-5` | A distinct, nameable joined set lives inside an existing surface | `overflow-hidden rounded-xl border border-border bg-transparent shadow-none` |
| `SURFACE-IN-SURFACE-6` | An ordinary local action lives inside an existing surface | `border border-border bg-transparent text-foreground` |
| `SURFACE-IN-SURFACE-7` | A wide authored block owns its own scroll frame | on a surface `overflow-hidden rounded-xl border border-border bg-background shadow-none` · on page ground `overflow-hidden rounded-xl bg-card shadow-surface` |

The codes are ordered the way a reader meets them: from the page ground inward. Codes `1`–`3` decide
what the page itself may draw; codes `4`–`6` decide what may be drawn once a surface already exists
around you. Code `7` is the one situation that resolves against its host rather than in spite of it,
because the fact it answers — a block too wide for the column it sits in — is a fact about the
relationship between the two, not about either alone.

`SURFACE-IN-SURFACE-4` IS A SITUATION, NOT A DECORATION. `bg-transparent shadow-none` is the written
proof that the container was classified and found to own nothing — it is not a leftover, and it is
not the same fact as "no class was considered". A flat container that also carries a border has not
followed this code; it has silently switched to `SURFACE-IN-SURFACE-5` without proving the
membership that code requires.

There is no general code for "a nested non-list group". That absence is deliberate, not an oversight:
the only nested **membership** this vocabulary admits is a **joined set of comparable members**. A
nested group of unlike parts is `SURFACE-IN-SURFACE-4`.

`SURFACE-IN-SURFACE-7` is the single exception that rule always anticipated, and it is not a
membership claim at all. It is admitted because the repeated real cases arrived: an authored document
renders code fences, tables and diagrams that are **wider than the column holding them**, each one a
chrome row over a content region — unlike parts, so never a joined set. Their boundary does not say
"these things are one group"; it says **"the scroll stops here"**. A frame that contains overflow is
answering a different question from a frame that claims membership, and giving the first one the
second one's answer is what produced code `4` containers wearing borders they could not justify.

## Reading a request

1. **List the containers the request states.** "A card with a lesson list inside it" states two: the
   card that sits on the page, and the lesson list that sits inside the card.
2. **Do not invent a container the request never mentions.** A page section, a dialog or a footer
   action is not in that request. Resolve what is stated; resolve the rest when it arrives.
3. **Resolve outermost first**, then each nested container. The host of a container is whatever the
   previous step already gave a boundary to: `page`, `card`, `outlined-group` or `overlay`. A
   container never inherits its child's code.
4. **For each container, name its host, its child kind and its membership, then ask the question** in
   the section for each code. The first code whose situation matches is the answer. Membership is
   nameable only when you can state its name, its members, its own state and its own outcome; DOM
   nesting is not evidence of membership.
5. **If one container makes two boundary claims, nest before choosing.** One container makes at most
   one claim. If a decisive fact is missing, ask exactly one question and stop — but if the missing
   fact is the membership itself, do not ask: unknown membership is already
   `SURFACE-IN-SURFACE-4`.

## `SURFACE-IN-SURFACE-1` — an independent object on page ground

**Situation.** Something stands directly on page ground and is by itself a **complete business
object**: it can be named, its members listed, it has its own state and its own outcome. It takes a
page-level boundary, and that boundary is **elevation** — card ground plus shadow, **not** a border.

**Recognition signs**

- You can name it with a business noun, not with a position ("the block on the right").
- It can load, empty and fail on its own while the rest of the page keeps working.
- Its host is **page ground**, not another surface.
- Remove it from the page and the page loses a function, not a decoration.

**Ask yourself.** Does this object have its own name, members, state and outcome — and is its host
really page ground?

**Boundary**

- `SURFACE-IN-SURFACE-2`: if the content inside is a **set of comparable rows**, it is code `2`;
  code `2` is a closed variant of code `1` that adds `overflow-hidden` and `divide-y` because the
  rhythm lives in the row.
- `SURFACE-IN-SURFACE-3`: if the container **only** gathers things that already own boundaries, it
  owns nothing further — code `3`. A card wrapping cards is the classic failure of this boundary.
- `SURFACE-IN-SURFACE-5`: the same "distinct group", but a different host. On page ground it
  elevates; inside a surface it outlines.

**Common business situations.** Order summary card · standalone form panel · progress statistic
block · user profile card · checkout block · course card in a grid · filter panel in the left column
· the "start here" block of an empty page · invoice card · map block with place details.

## `SURFACE-IN-SURFACE-2` — one page-level set of comparable rows

**Situation.** Several rows of the **same kind**, read the same way, comparable with each other. The
whole set is **one** page-level object; the individual row is **not** its own object. A single
boundary holds the set, and the line between rows is stated by `divide-y`, not by whitespace.

**Recognition signs**

- Every row has the same structure: the same fields, in the same reading order.
- Adding or removing a row does not change what the set means.
- Users read them to **compare** or **scan**, not to read each one as its own story.
- `overflow-hidden` is required: without it the first and last row spill past the rounded corner of
  the set.

**Ask yourself.** Are the rows comparable through the same set of fields — and is the whole set a
page-level object?

**Boundary**

- `SURFACE-IN-SURFACE-1`: a single object whose content is not uniform is code `1`. Three blocks
  with entirely different structure are **not** a joined set.
- `SURFACE-IN-SURFACE-3`: if each row is already a card with its own boundary, the rows are peers
  and their parent is code `3`.
- `SURFACE-IN-SURFACE-5`: the same joined set, but hosted inside another surface, drops to an
  outline.

**Common business situations.** Leaderboard · transaction history · invoice list · list of signed-in
devices · settings list · notification feed · team member list · attachment list · activity history.

## `SURFACE-IN-SURFACE-3` — a section that only names peers that already own boundaries

**Situation.** A page region with a heading whose **children already own their boundaries**. The
section does one thing: it names. If it draws another boundary, one membership is claimed twice and
the reader has to guess which frame is the real one.

**Recognition signs**

- The direct children are cards, already-elevated objects, or joined sets.
- The section has no state of its own beyond the state of its children.
- Delete the section's boundary and no information is lost — only a frame.
- The section uses **page ground**, so its children rise above that ground.

**Ask yourself.** Do its children already own boundaries? If so, what is left for this section to
own?

**Boundary**

- `SURFACE-IN-SURFACE-1`: if the section is itself a complete business object — name, members,
  state, outcome — it is code `1`, and then its children may **not** elevate.
- `SURFACE-IN-SURFACE-4`: code `3` stands **on page ground** and uses page ground; code `4` stands
  **inside a surface** and uses transparent ground. Both "draw nothing", but they stand in two
  different places and say two different things.

**Common business situations.** "My courses" + a grid of course cards · "Devices" + device cards ·
"Plans" + three pricing cards · a tab panel holding peer cards · a dashboard region gathering
several statistic blocks · "Search results" + a result list that already has its own frame.

## `SURFACE-IN-SURFACE-4` — duplicate, ordinary, or unnameable membership

**Situation.** The container sits **inside** an existing surface (card, outlined group, overlay) and
owns no group other than the host's. Three paths lead here, and all three give the same result:

1. **Duplicate** — the content belongs to exactly the group the host already claimed.
2. **Ordinary** — it is just content, not a group.
3. **Unnameable** — it may be a group, but nobody has stated its name, members, state and outcome.

**Recognition signs**

- You cannot name the group without repeating the host's name.
- The container exists for a technical reason: to set `flex-col`, to wrap a map, to take a ref.
- The content inside has no loading state, no empty state and no error state of its own.
- An overlay already owns the boundary of the whole task; everything ordinary inside it lands here.

**Ask yourself.** Which group does this boundary own that the current host does not? If you cannot
state it — code `4`.

**Boundary**

- `SURFACE-IN-SURFACE-5`: code `5` requires a **nameable** membership with **comparable members**.
  If you cannot state it, you may not rise to code `5`; nested DOM is **not** evidence of
  membership.
- `SURFACE-IN-SURFACE-3`: code `3` is on page ground and uses page ground. Code `4` is inside a
  surface and uses transparent ground.
- `SURFACE-IN-SURFACE-6`: a single control is never wrapped in a surface; it goes straight to code
  `6` and produces no wrapper.

**This is the safe default.** When the facts are missing, code `4` is the answer. Adding an
unevidenced boundary invents a group that does not exist, and the cost falls on the reader, not on
the writer.

**Common business situations.** A description paragraph inside a card · ordinary dialog content · a
form field inside a panel · a result block inside an overlay · a wrapper that only sets a column ·
the caption region under a chart · the skeleton of any of the above · a text empty state inside an
existing card.

## `SURFACE-IN-SURFACE-5` — a distinct joined set inside another surface

**Situation.** Inside an existing surface, a **set of comparable rows** appears that belongs to a
membership **different** from the host's and **can be named**. That set needs a boundary, but it may
**not** have elevation: inside a surface, a second elevation is a lie about depth. It takes **one**
border, transparent ground, no shadow.

**Recognition signs**

- The rows inside are comparable with each other (same fields, same reading order).
- The group has its own name, different from the host's name.
- The group can be empty, fail and load on its own.
- The host still holds content other than this group — otherwise this group **is** the host.

**Ask yourself.** Can this set be named, and is that name different from the host's name?

**Boundary**

- `SURFACE-IN-SURFACE-4`: unnameable means flat. This is the most violated boundary of all.
- `SURFACE-IN-SURFACE-2`: the same joined set; on page ground it elevates, inside a surface it
  outlines. **Never both.**
- `SURFACE-IN-SURFACE-1`: code `1` does not exist inside a surface. A card inside a card is an
  error, not a choice.

**Only joined membership may nest a boundary.** A nested group of parts that are **not** uniform has
no membership code in this vocabulary; it is code `4`. If it is also **wider than its host column and
scrolls inside itself**, it is not a membership question at all — resolve it as
`SURFACE-IN-SURFACE-7`, whose boundary contains overflow rather than claiming a group.

**Common business situations.** A lesson list inside a course card · an attachment list inside a
dialog · order line items inside a checkout panel · a participant list inside an event card · a
change history inside a detail drawer · cost allocation lines inside an invoice card.

## `SURFACE-IN-SURFACE-6` — an ordinary action inside a surface

**Situation.** A control sits inside an existing surface, serves that host, and **nobody has proven**
it is the primary outcome. It takes the secondary presentation: one border, transparent ground,
foreground text — enough to be clickable, not enough to compete with the host.

**Recognition signs**

- The control's host is already a surface (card, outlined group, overlay).
- The control does one local job: retry, see more, copy, download, cancel.
- No record states it is the single primary outcome of the host.

**Ask yourself.** Has anyone proven this is the single primary outcome of the host? If not — it is
secondary.

**Boundary**

- `SURFACE-IN-SURFACE-4`: a control is **not** a group, so it produces no surface wrapper. Framing a
  button declares a membership with exactly one member.
- Promotion: only call-to-action intent may raise it to primary. Bottom-right position, large text,
  or being the only control are **none of them** evidence.

**Common business situations.** A "Retry" button in an error card · "See all" at the foot of a list
card · "Copy code" inside a panel · "Download invoice" in a transaction row · "Cancel" in a dialog
footer · "Change photo" in a profile card · "View details" in a summary card.

## `SURFACE-IN-SURFACE-7` — a wide authored block with its own scroll frame

**Situation.** Authored content renders a block that cannot be reflowed to fit the column reading it:
a code fence whose lines must stay whole, a data table whose columns must stay aligned, a diagram
drawn at a fixed measure. The block scrolls sideways inside itself so the reading column can stay
`min-w-0`, and that scroll needs a visible edge — a reader must be able to see where the moving
region begins and where the prose resumes.

This is the only code whose className depends on the host, and it depends on it for a physical reason
rather than a taxonomic one. Ground that recedes below a surface reads as an inset well; the same
ground on page ground reads as nothing at all, because it *is* the page. So the block takes the
treatment that keeps it legible against whatever is actually behind it:

- **Host is a surface** — recessed well: `overflow-hidden rounded-xl border border-border bg-background shadow-none`.
- **Host is page ground** — raised card: `overflow-hidden rounded-xl bg-card shadow-surface`.

**Recognition signs**

- The content has an intrinsic minimum width the column cannot honour.
- Wrapping it would destroy meaning: a broken command line loses its closing quote, a wrapped table
  row stops aligning with its header.
- The block is composed of unlike parts — a chrome row naming the language or the caption, over the
  content region itself.
- The overflow is local: the block scrolls, the page does not.

**Ask yourself.** Would wrapping this content destroy its meaning, and does it therefore have to
scroll inside its own frame?

**Boundary**

- `SURFACE-IN-SURFACE-5`: code `5` frames a **membership** — nameable, comparable members. Code `7`
  frames an **overflow**. A table qualifies under `7` because it is too wide, never because its rows
  are comparable; a lesson list that fits its column stays `5`.
- `SURFACE-IN-SURFACE-4`: content that fits, or that may wrap freely, owns no frame. Width alone is
  not the trigger — the content must be **unable** to reflow.
- `SURFACE-IN-SURFACE-1`: the raised form of code `7` is not code `1`. Code `1` is a complete business
  object with its own name, members, state and outcome; a code fence has none of those. They share a
  className and nothing else.
- Never both grounds. The host is resolved before this container, exactly as step `3` of **Reading a
  request** requires, and it decides which of the two forms applies.

**The frame is one decision with `OVERFLOW-5`.** That code emits `overflow-x-auto` for content that
"scrolls sideways in its own frame" and has always presumed a frame this module could not name. Code
`7` is that frame. Emit them together or neither: a scroll region with no edge hides its own
mechanism, and an edge with no scroll is a border claiming a membership it does not have.

**Common business situations.** A shell command in a lesson · a comparison table inside an article ·
a rendered diagram in documentation · a stack trace inside an error report · a wide result grid
inside a report surface · a schema listing inside a reference page.

## Inputs

| Input | Evidence required |
|---|---|
| `host` | `page` · `card` · `outlined-group` · `overlay` — what already owns a boundary around this container |
| `child` | `ordinary-content` · `independent-group` · `peer-surfaces` · `joined-rows` · `single-control` · `unreflowable-block` |
| `membership` | `same-as-host` · `distinct-and-nameable` · `unknown` · `not-a-membership` |
| `action-priority` | `ordinary-local` · `separately-proven-primary` · `unknown` |
| `reflow` | `wraps-freely` · `cannot-reflow` — whether wrapping the content would destroy its meaning |

`host`, `child` and `membership` decide the boundary. `action-priority` is consulted only for
`SURFACE-IN-SURFACE-6`, and only call-to-action intent may raise it. `reflow` is consulted only for
`SURFACE-IN-SURFACE-7`; `cannot-reflow` is what admits a frame that claims no membership, and `host`
then selects which of that code's two forms applies. No gap, padding, margin or inset value is an
input or an output of this module.

A membership is **nameable** when you can state its name, its members, its own state and its own
outcome. DOM nesting is not evidence of membership; a `div` that exists to hold a flex direction has
no members and no outcome.

## Rules

1. A boundary exists only for a nameable membership claim, or for content that cannot reflow and
   must therefore scroll inside its own frame — `SURFACE-IN-SURFACE-7`, the one non-membership edge.
2. Page elevation and nested outline are mutually exclusive. Elevation never carries a border, and
   an outline never carries a shadow.
3. A page surface uses `bg-card`; page ground uses `bg-background`.
4. A nested boundary uses one `border-border`, transparent ground and no shadow.
5. Duplicate membership and unknown membership both resolve to `SURFACE-IN-SURFACE-4`.
6. A section whose children already own boundaries claims none of its own.
7. An overlay already owns its task boundary; its ordinary content is flat.
8. A single control is never wrapped in a surface. A control is not a group.
9. An ordinary nested action stays secondary; only call-to-action intent may promote it.
10. Ready, loading, empty, error and responsive states preserve boundary ownership. The object count
    a skeleton draws equals the object count the settled content draws.
11. One container makes at most one boundary claim; two claims about one membership need nesting,
    not a longer className.
12. Spacing, inset and external offset are outside this module.
13. A scroll frame and its `OVERFLOW-5` scroll are one decision; neither is emitted without the other.

Beyond these: every rendered container resolves to exactly one code, and no composition is out of
scope.

## Exceptions

Exceptions are PART of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **The host already names the nested set.** Still `SURFACE-IN-SURFACE-5`; the duplicate visible
  label inside the outline may be suppressed. The boundary stays because the membership is still
  distinct — only the second label is redundant.
- **Membership cannot be named.** `SURFACE-IN-SURFACE-4`, always. If a boundary is still wanted, ask
  exactly one question — *which group does this boundary own that the host does not?* — and stop.
- **An ordinary action inside a surface.** `SURFACE-IN-SURFACE-6`, even when it is the only control
  present and even when it sits bottom-right.
- **Primary promotion requested.** Keep `SURFACE-IN-SURFACE-6` until call-to-action intent proves
  one host-level primary outcome.
- **Two bordered objects touch.** Keep the boundaries separate. Adjacency is not membership; only
  row comparability turns them into `SURFACE-IN-SURFACE-2`.
- **State change.** Loading, empty and error renders keep the code the settled render has. A
  skeleton that flattens a card, or an error state that promotes a flat block into a card, is lying
  about ownership while the user is least able to check.
- **Responsive.** Change the code only when the host ACTUALLY changes. A narrower screen does not
  turn an object into a section, nor a section into a card. A `SURFACE-IN-SURFACE-7` block keeps its
  code at every width: it is framed because its content cannot reflow, and a wider viewport does not
  make a command line wrappable. Only the scroll it contains comes and goes.
- **A wide block whose host is itself the page.** `SURFACE-IN-SURFACE-7` in its raised form, not
  `SURFACE-IN-SURFACE-1`. The two emit the same className and answer different questions; recording
  it as `1` claims a business object that does not exist and loses the reason the frame is there.

## Output

One block per container, outermost first:

```text
host: <page | card | outlined-group | overlay>
child: <ordinary-content | independent-group | peer-surfaces | joined-rows | single-control | unreflowable-block>
membership: <same-as-host | distinct-and-nameable | unknown | not-a-membership>
situation: <SURFACE-IN-SURFACE-1 … SURFACE-IN-SURFACE-7>
className: <exact className from the Situation codes table; for code 7, the form its host selects>
reason: <host and membership fact that excludes the adjacent code>
removed: <the duplicate boundary this decision deletes, or none>
```

## Worked example

**Request.** "A 'My courses' section with three course cards; each card shows the course name, a
short description, its lesson list, and a Continue button."

The request states five containers: the section, each course card, the description block inside the
card, the lesson list inside the card, and the Continue control. It states no dialog, no page-level
row set and no proof of a primary outcome, so none of those are resolved.

```text
host: page
child: peer-surfaces
membership: same-as-host
situation: SURFACE-IN-SURFACE-3
className: bg-background shadow-none
reason: the section only names three cards that already own their boundaries, which excludes SURFACE-IN-SURFACE-1
removed: the outer card that would have wrapped the three course cards
```

```text
host: page
child: independent-group
membership: distinct-and-nameable
situation: SURFACE-IN-SURFACE-1
className: rounded-2xl bg-card shadow-surface
reason: a course is a complete object with its own name, members, state and outcome, and its host is page ground, which excludes SURFACE-IN-SURFACE-5
removed: none
```

```text
host: card
child: ordinary-content
membership: same-as-host
situation: SURFACE-IN-SURFACE-4
className: bg-transparent shadow-none
reason: the description belongs to exactly the course the card already claimed, which excludes SURFACE-IN-SURFACE-5
removed: none
```

```text
host: card
child: joined-rows
membership: distinct-and-nameable
situation: SURFACE-IN-SURFACE-5
className: overflow-hidden rounded-xl border border-border bg-transparent shadow-none
reason: the lessons are comparable rows under a name of their own that is not the course name, and the host is a card rather than page ground, which excludes SURFACE-IN-SURFACE-2
removed: none
```

```text
host: card
child: single-control
membership: same-as-host
situation: SURFACE-IN-SURFACE-6
className: border border-border bg-transparent text-foreground
reason: Continue is an ordinary local action with no proven primary outcome, and a control is not a group, which excludes SURFACE-IN-SURFACE-4
removed: the bordered wrapper that would have framed the single button
```

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup. The
colour words `bg-card`, `bg-background`, `border-border` and `text-foreground`, and the elevation
word `shadow-surface`, are semantic tokens each front end defines for itself: a card ground, a page
ground, one boundary colour, one foreground colour and one surface elevation.
