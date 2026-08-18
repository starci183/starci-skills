---
title: Typography
runtime: true
source: en.md
sourceHash: 3facef03a385bc963023f6c8bc600ae6000630159a738ed0cbb5a05e5a4f9c46
contextVersion: 1
---

# Typography

## LOADS

None.

## Record

You are given a plain request in prose — "a course page with a curriculum section listing modules" —
and you return, for every line of text that request implies, one situation code, one element and one
className. The request never states a size and you never estimate one: the size, the weight and the
tone follow from what the line OWNS.

## Law

A line of text states what it OWNS. Choose its size, weight and tone from that ownership, never from
how prominent it should look.

Two facts decide, and only two: **outline depth** — whether the line is a rung of the document
outline — and **content ownership** — whether the line names an object, states a fact, qualifies
another line, partitions a stream, or belongs to a control that already owns its own text.

Visual preference, numeric shape, label length, hover, available space, breakpoint and screenshot
geometry select nothing.

**This is binding, not advisory.** Every rendered line of text falls under exactly one code below.
There is no line too small to have one: a twelve-character caption under a metric is `TYPOGRAPHY-9`
for the same reason a route name at the top of a page is `TYPOGRAPHY-1`. "It is only one word" is not
an exemption — it is the most common place the rule gets skipped, because a single word is exactly
where a writer reaches for whatever size looks right.

## Situation codes

Every situation this module governs carries a code, `TYPOGRAPHY-<index>`. The code names the
SITUATION; the element and className columns name what that situation emits. They are not the same
thing, and one of them emits nothing.

| Code | Situation | Element | className |
|---|---|---|---|
| `TYPOGRAPHY-1` | Root name of the page or route | `h1` | `text-xl font-semibold tracking-tight` |
| `TYPOGRAPHY-2` | First outline depth under the page | `h2` | `text-base font-semibold` |
| `TYPOGRAPHY-3` | Local subsection inside a section | `h3` | `text-sm font-medium` |
| `TYPOGRAPHY-4` | Final admitted outline depth | `h4` | `text-xs font-medium text-muted-foreground` |
| `TYPOGRAPHY-5` | One short title for the single dominant object of a region | `div` | `text-base font-medium text-foreground` |
| `TYPOGRAPHY-6` | Title of a repeated, compact, long or localizable peer object | `div` | `text-sm font-medium text-foreground` |
| `TYPOGRAPHY-7` | Ordinary UI copy: a description, a metadata line, a value | `p` | `text-sm leading-5 font-normal text-foreground` |
| `TYPOGRAPHY-8` | Prose whose job is sustained reading | `p` | `text-base leading-6 font-normal text-foreground` |
| `TYPOGRAPHY-9` | Copy that only qualifies a primary line or surface | `p` | `text-xs leading-4 font-normal text-muted-foreground` |
| `TYPOGRAPHY-10` | A marker that partitions a result stream without creating a section | `div` | `text-sm leading-5 font-normal text-muted-foreground` |
| `TYPOGRAPHY-11` | Text a control already owns | *the control's own element* | *no typography class* |
| `TYPOGRAPHY-12` | No outline depth and no declared owner | `p` | `text-base font-normal text-foreground` |

`TYPOGRAPHY-11` IS A SITUATION, NOT A RECIPE. A button label, a badge, a link, a field placeholder
and a status chip carry typography that the control itself settled. Re-declaring a size on that text
from the outside claims an ownership the caller does not have, and the claim is invisible until the
control changes and one call site stops matching every other. The code exists because "the control
already decided" is a case a reader must be able to recognise, cite and be corrected against — a
situation with no name is a situation nobody can be shown to have got wrong.

`TYPOGRAPHY-12` IS A FLOOR, NOT AN ESCAPE. It is the readable answer when a request genuinely
declares no owner, so that a public table never returns a refusal. It is not permission to skip the
ownership question when the answer is available in the request.

The outline stops at four. There is no fifth heading depth, and adding one is a rule change rather
than a shortcut: a content structure that needs depth five is a content structure that has to
flatten. A closed ladder forces an ownership decision; an open one invites inventing a rung, which is
taste re-entering through arithmetic.

## Reading a request

1. **List the lines the request states.** "A course page with a curriculum section listing modules,
   each module showing its title and its lesson count" states four kinds of line: the page name, the
   section name, each module title, and each lesson-count line.
2. **Do not invent a line the request never mentions.** A tagline, a breadcrumb or a footnote is not
   in that request. Resolve what is stated; resolve the rest when it arrives.
3. **Resolve outermost first** — page name, then section names, then the lines inside each section.
   A line never inherits the code of the line above it; ownership is decided one line at a time.
4. **For each line ask the outline question first.** Is this line a rung of the document outline, and
   which rung? If it is, the depth alone settles `TYPOGRAPHY-1` through `TYPOGRAPHY-4`.
5. **If it is not in the outline, ask the ownership question** in the section for each remaining
   code. The first code whose situation matches is the answer.
6. **If two adjacent codes both match, choose the code that claims LESS ownership** — the peer over
   the dominant, the support over the section, the UI copy over the reading prose. Ask one
   discriminating question only when the requester explicitly requires the larger claim.
7. **One region mixing several ownerships is normal.** A card holding an object name, a qualifying
   line and a description resolves to three codes, not to one averaged code. One line, one ownership.

## `TYPOGRAPHY-1` — root name of the page

**Situation.** This line answers "where am I?". It is the root of the document outline and each route
has exactly ONE of them.

**Ask yourself.** Is this line the outline root of the current route?

**Boundary**

- `TYPOGRAPHY-2`: an `h2` names a SECTION of the page; an `h1` names the WHOLE page. If any other
  line encloses it, it is not `TYPOGRAPHY-1`.
- `TYPOGRAPHY-5`: an object title does NOT enter the outline. The same string is `TYPOGRAPHY-1` on
  the detail route of that object and `TYPOGRAPHY-6` when listed among siblings on an index route.
  **The route decides, not the string.**

## `TYPOGRAPHY-2` — first outline depth under the page

**Situation.** A part of the page with its own purpose and its own content, which MUST appear in the
outline so a screen-reader user can jump to it.

**Ask yourself.** Is this a first-level part of the page a user needs to jump straight to?

**Boundary**

- `TYPOGRAPHY-1`: see above.
- `TYPOGRAPHY-3`: an `h3` sits INSIDE an `h2`. With no `h2` above it in the same tree, it is not yet
  an `h3`.
- `TYPOGRAPHY-5`: same `text-base` recipe but a different WEIGHT and a different ELEMENT. An `h2` is
  `font-semibold` and enters the outline; an object title is `font-medium` and does not. This is the
  most confused pair in the upper half of the scale.

## `TYPOGRAPHY-3` — local subsection

**Situation.** A small group INSIDE a section, independent enough to need a name, but not large
enough to be a first-level part of the page.

**Ask yourself.** Does this group sit inside an already-named section, and does it need a name of its
own?

**Boundary**

- `TYPOGRAPHY-2`: count the depth, not the size of the area. An `h3` inside a small section is still
  an `h3`.
- `TYPOGRAPHY-6`: same `text-sm` but a different weight and a different element. An `h3` is
  `font-medium` AND in the outline; a peer title is `font-medium` and NOT in the outline. If the name
  is the name of a DATA OBJECT — a course, a file, a person — it is `TYPOGRAPHY-6`, not an `h3`.

## `TYPOGRAPHY-4` — final outline depth

**Situation.** The fourth outline depth, and the last. At this depth the name is nearly a label: it
still has to be present in the outline, but it must no longer compete for the eye.

**Ask yourself.** Does this line truly need to be in the outline, or is it only qualifying copy?

**Boundary**

- `TYPOGRAPHY-9`: **this is the most dangerous boundary in the module.** Both are `text-xs` and both
  are muted. They differ in two places, and both are binding: `TYPOGRAPHY-4` is `font-medium` and a
  REAL `h4` in the outline; `TYPOGRAPHY-9` is `font-normal` and NOT a heading element. If the line
  does not need to appear in the page's list of headings, it is not an `h4`.
- Fifth depth: it does NOT exist. Needing depth five means the content structure has to flatten. This
  is the one request the module answers with a question rather than a class.

## `TYPOGRAPHY-5` — the single dominant object

**Situation.** A large region exists to talk about ONE object, and that object has a SHORT name. That
name leads the whole region but does NOT enter the document outline, because it is data, not
structure.

**Ask yourself.** Does this region hold exactly ONE object, and is its name stably short? Missing ONE
of the two facts drops it to `TYPOGRAPHY-6`.

**Boundary**

- `TYPOGRAPHY-2`: an object title does not enter the outline. Do not turn it into an `h2` merely
  because it is the largest line in the region.
- `TYPOGRAPHY-6`: BOTH facts — single and short — are required. Repeated, compact, long, or liable to
  grow under localization is always `TYPOGRAPHY-6`. The safe default is `TYPOGRAPHY-6`.

## `TYPOGRAPHY-6` — title of a peer object

**Situation.** The name of an object standing AMONG MANY OF ITS KIND, or a name that can grow long.
The scanning rhythm must be even across the lines, so no line may be larger than another.

**Ask yourself.** Is this name one of many peer names, or does it carry a length risk?

**Boundary**

- `TYPOGRAPHY-5`: see above. A wider layout does NOT promote a peer into a dominant.
- `TYPOGRAPHY-3`: a peer title names a DATA OBJECT; an `h3` names a STRUCTURAL item. Same
  `text-sm font-medium`, different element and different outline status.
- `TYPOGRAPHY-7`: a title NAMES (`font-medium`), copy STATES (`font-normal`). If the line is a
  sentence, it is not a title.

## `TYPOGRAPHY-7` — ordinary UI copy

**Situation.** A line that STATES A FACT: a short description, metadata, a value, a textual status.
The user SCANS it rather than READS it.

**Ask yourself.** Does this line stand on its own as a fact, and is the reader's job to scan rather
than to read continuously?

**Boundary**

- `TYPOGRAPHY-6`: see above.
- `TYPOGRAPHY-8`: they differ by the READER'S JOB, not by length. Three sentences in a card meant for
  glancing are still `TYPOGRAPHY-7`; one paragraph in an article meant for reading is
  `TYPOGRAPHY-8`.
- `TYPOGRAPHY-9`: `TYPOGRAPHY-9` LOSES ITS MEANING when detached from the line it qualifies;
  `TYPOGRAPHY-7` does not. This is the only test needed.

## `TYPOGRAPHY-8` — prose for sustained reading

**Situation.** Several sentences, several paragraphs, and the user's job is to READ FROM START TO
FINISH. The larger size and looser line height are not because the paragraph matters more, but
because the eye has to run the whole length of every line.

**Ask yourself.** Must the reader read continuously across many sentences to understand?

**Boundary**

- `TYPOGRAPHY-7`: see above. **Length is not the criterion** — the reading job is.
- `TYPOGRAPHY-5`: same `text-base` but a different weight. `font-medium` is a name, `font-normal` is
  content. A paragraph is never `font-medium` "for emphasis".

## `TYPOGRAPHY-9` — copy that only qualifies

**Situation.** This line EXISTS ONLY BECAUSE of another line or another surface. Pull it away from
the primary line and it says nothing.

**Ask yourself.** If the line above were deleted, would this line still say anything? If not —
`TYPOGRAPHY-9`.

**Boundary**

- `TYPOGRAPHY-7`: see above.
- `TYPOGRAPHY-4`: same `text-xs` and same muted tone. They differ in WEIGHT and in ELEMENT: an `h4`
  is `font-medium` and sits in the outline; supporting copy is `font-normal` and is not a heading.
- `TYPOGRAPHY-10`: supporting copy attaches to ONE line; a partition marker divides A STREAM and
  belongs to no single line.

**Inseparable pair.** `text-xs` and `text-muted-foreground` travel together. There is no
foreground-toned supporting copy, and no un-muted `text-xs` — except exactly `TYPOGRAPHY-4`.

## `TYPOGRAPHY-10` — result-stream partition marker

**Situation.** A continuous result stream needs landmarks for scanning — `Today`, `Yesterday`,
`August` — but those landmarks do NOT create additional sections in the document. They divide time,
not structure.

**Ask yourself.** Does this marker add an entry to the document outline? If not — `TYPOGRAPHY-10`.

**Boundary**

- `TYPOGRAPHY-2` / `TYPOGRAPHY-3`: this is where the mistake is made most often. The marker looks
  like a heading, so it gets written as an `h3`, and the page outline instantly fills with
  `Yesterday`, `July`. A marker is NEVER a heading element.
- `TYPOGRAPHY-9`: see above.

## `TYPOGRAPHY-11` — text a control already owns

**Situation.** The string lives INSIDE a control: a button label, badge text, link text, a field
placeholder, status chip text. That control already settled its own typography.

**Ask yourself.** Does this string sit inside a control that already set its own typography?

**Boundary**

- Every other code: `TYPOGRAPHY-11` WINS OVER ALL OF THEM. Even when the string reads exactly like
  `TYPOGRAPHY-7` copy, inside a control is inside a control.
- `TYPOGRAPHY-9`: a hint line OUTSIDE the field is `TYPOGRAPHY-9`. Placeholder text INSIDE the field
  is `TYPOGRAPHY-11`.

**No typography class is emitted.** This is the code that emits NO RECIPE. Writing a size over a
button label claims an ownership the call site does not have, and the mistake stays invisible until
the day the control changes and one call site drifts away from every other.

## `TYPOGRAPHY-12` — no owner declared

**Situation.** The request genuinely states NO outline depth and NO content owner, and no heading or
supporting semantics can be inferred either. A readable answer is needed rather than a refusal.

**Ask yourself.** Is the owner genuinely un-inferable, or has the question simply not been asked?

**Boundary**

- Every other code: `TYPOGRAPHY-12` is a FLOOR, not an escape. If the request declares an owner
  anywhere, use the correct code rather than dropping here for speed.

**No self-promotion by number.** A numeric value does NOT become the leading line merely because it
is a number. For it to lead, a content decision must say that it leads.

## Rules

1. Outline depth decides BOTH the semantic element AND the visible rank. An `h2` styled as body, or
   a `div` styled as a heading, is a violation in both directions.
2. Four heading depths are the whole outline. A fifth means the content must flatten.
3. One bounded region has exactly ONE typographic lead.
4. `TYPOGRAPHY-5` requires BOTH facts: a single object AND a stably short title. Missing one drops to
   `TYPOGRAPHY-6`.
5. A repeated, compact, long or localizable title ALWAYS takes the peer recipe.
6. `text-xs` always means muted supporting copy. There is no foreground `text-xs`, and no muted
   `text-xs` that is not support — except the `h4` of `TYPOGRAPHY-4`, which is `font-medium` and is
   in the outline.
7. Numbers, hover, label length, available space and breakpoints never promote rank.
8. Loading, empty, error, localization, responsive and theme preserve the settled code.
9. Rank is never manufactured with a border, background, badge or box. Those state a surface, not a
   rank.
10. Text a control owns takes no typography override from outside.
11. No unlisted size, weight or tone recipe is assembled. The vocabulary is closed.
12. If two adjacent codes both remain reasonable, choose the one that claims LESS ownership — the
    peer over the dominant, the support over the section, the UI copy over the reading prose. Ask
    only when the request requires the larger claim.

Beyond these: a situation code maps to exactly one recipe, no recipe serves two codes, and every
rendered line resolves to exactly one code. No text is out of scope.

## Exceptions

Exceptions are PART of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Control-owned text.** `TYPOGRAPHY-11` wins over every other code. If the string lives inside a
  button, badge, link, field or status control, the control's recipe stands and no free-text class is
  emitted, even when the string reads exactly like `TYPOGRAPHY-7` copy.
- **Page name that is also an object name.** On a detail route, the object's own name IS the page
  name and takes `TYPOGRAPHY-1`. The same string listed among siblings on an index route is
  `TYPOGRAPHY-6`. The route decides, not the string.
- **Fifth heading depth.** Do not emit anything. Ask the author to flatten the outline. This is the
  one request the module answers with a question rather than a class.
- **Numeric value with no declared owner.** A number does not promote itself. Emit `TYPOGRAPHY-12`
  and ask which line leads the region only when promotion is actually being requested.
- **State parity.** Skeleton, empty and error renderings of the same content keep the same code. A
  skeleton that changes rank is lying about ownership while it waits.
- **Long copy without a reachability policy.** Truncation versus wrapping is not a typography
  decision. Keep the settled code and ask whether the full value must remain reachable.
- **Two adjacent codes both match.** Choose the code that claims LESS ownership — the peer over the
  dominant, the support over the section, the UI copy over the reading prose. Ask one discriminating
  question only when the requester explicitly requires the larger claim.

## Output

One block per line of text, outermost first:

```text
line: <the text being classified>
outline: <none | 1 | 2 | 3 | 4>
owner: <page | section | dominant-object | repeated-peer | ui-copy | reading-prose | control | partition>
relationship: <independent | qualifies-primary | partitions-results>
situation: <TYPOGRAPHY-1 … TYPOGRAPHY-12>
element: <h1 | h2 | h3 | h4 | div | p | none — the control's own>
className: <exact closed recipe, or none>
reason: <business fact that excludes the adjacent code>
```
