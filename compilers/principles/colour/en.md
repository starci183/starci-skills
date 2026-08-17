---
title: Colour
---

# Colour

You are given a plain request in prose — "an order card showing the order number, the date and
whether it has been paid" — and you return, for every element that request implies, one situation
code and one className. The request never states a hue and you never pick one: the colour follows
from the role the element plays in the business.

## Law

Colour states what an element MEANS. Choose it from the role the element plays in the business —
content, interaction, state, surface, boundary — never from how the hue looks.

A colour decision must survive the loss of hue. If the meaning disappears when the screen is
greyscale, colour-blind or forced into a high-contrast theme, the meaning was never encoded; it was
only suggested.

**This is binding, not advisory.** Every rendered element falls under exactly one code below. There
is no element too small to have a role: a timestamp under a title is `COLOUR-2` for the same reason a
failed-payment line is `COLOUR-6`. "It is only a bit of grey text" is not an exemption — it is the
most common place this rule gets skipped.

One element expresses one role. A surface code emits its surface-and-content pair and stops there;
any other role — status, interaction, selection — belongs to a CHILD element. Codes nest; they never
merge onto one node.

## Situation codes

Every situation this module governs carries a code, `COLOUR-<index>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing.

| Code | Situation | className |
|---|---|---|
| `COLOUR-1` | Primary readable content — the sentence that carries the decision | `text-foreground` |
| `COLOUR-2` | Supporting content, metadata, provenance | `text-muted-foreground` |
| `COLOUR-3` | Interaction target or current selection | `text-primary` (selected region: `bg-primary/10 text-primary`) |
| `COLOUR-4` | A completed, successful outcome | `text-success-soft-foreground` + non-colour cue |
| `COLOUR-5` | A recoverable warning; nothing has failed yet | `text-warning-soft-foreground` + non-colour cue |
| `COLOUR-6` | Failure, invalid input or destructive action | `text-danger-soft-foreground` / `border-danger` + visible message |
| `COLOUR-7` | Keyboard focus | `focus-visible:ring-2 focus-visible:ring-ring` |
| `COLOUR-8` | Disabled or unavailable control | `text-muted-foreground opacity-50` |
| `COLOUR-9` | Base page surface | `bg-background text-foreground` |
| `COLOUR-10` | Raised surface standing above the page | `bg-card text-foreground` |
| `COLOUR-11` | Subtle nested region inside a surface | `bg-muted text-foreground` |
| `COLOUR-12` | Neutral boundary | `border-border` |
| `COLOUR-13` | Independent data categories | ordered categorical palette + label or pattern |
| `COLOUR-14` | Brand artwork | controlled brand palette |
| `COLOUR-15` | Text over media | contrast overlay |

The index is an ORDER OF ENCOUNTER, not a scale. `COLOUR-8` is not "more" than `COLOUR-4`; there is
nothing between `COLOUR-2` and `COLOUR-3` to split the difference with. This module has no numeric
class scale, so the numbers carry no arithmetic at all — they are names.

`COLOUR-13`, `COLOUR-14` and `COLOUR-15` are the three closed situations in which a palette outside
the semantic set is permitted. They are codes rather than loopholes: naming a situation is what makes
it possible to say a use of it is wrong.

## Reading a request

1. **List the elements the request states.** "An order card showing the order number, the date and
   whether it has been paid" states a card, a number, a date and a status label — four elements, each
   receiving its own class.
2. **Do not invent an element the request never mentions.** A delete button, a chart or a cover image
   is not in that request. Resolve what is stated; resolve the rest when it arrives.
3. **Resolve outermost first** — the page surface, then the raised surface, then the regions inside
   it, then the leaves. A surface never inherits the role of what it contains.
4. **For each element, name its role and ask the question** in the section for that code: is it
   content, interaction, state, surface or boundary; and if content, primary or supporting. The first
   code whose situation matches is the answer.
5. **If two codes both seem to match one node, it is carrying two roles.** One element expresses one
   role; the second role belongs to a child element, so nest before choosing. If the role is
   genuinely ambiguous, ask exactly ONE question about intended meaning and stop — the answer is a
   class string or a question, never both.

## `COLOUR-1` — primary content

**Situation.** This is the sentence the user must read to decide: the course title, the amount due,
the body of the question, the sender's name. Remove it and the screen loses its reason to exist.

**Recognition signs**

- If the user were allowed to read only ONE line on this screen, that is the line.
- It does not depend on another line to have meaning.
- It carries no success, warning or danger state.
- It is the safe default: when no other role has been established, this is the code.

**Ask yourself.** Does this sentence stand on its own and carry the decision of the screen?

**Boundary**

- `COLOUR-2`: `COLOUR-1` carries the decision; `COLOUR-2` EXPLAINS a `COLOUR-1` that is present.
  If there is no primary content nearby to support, it is not supporting content.
- `COLOUR-3`: static text that cannot be clicked is never `COLOUR-3`, however much you want it to
  stand out.
- `COLOUR-4/5/6`: change the code only when the DATA genuinely carries a state, not when the wording
  sounds positive or negative.

**Common business situations.** Course title · body of a question · sender name in a mailbox ·
the amount of an invoice · file name · the body of a comment · the label of an input field · an
instruction that must be followed · product name in a cart.

## `COLOUR-2` — supporting content

**Situation.** Content that is still useful but does NOT lead the reading: it says more about a piece
of primary content standing right beside it. Delete it and the screen still works, only less
precisely.

**Recognition signs**

- It answers "when", "how many", "where from", "what kind" for a piece of primary content.
- There is a clear `COLOUR-1` nearby for it to attach to.
- It contains no instruction and no deciding condition.

**Ask yourself.** If the user skipped this line, would they lose information required to act? If not
— `COLOUR-2`.

**Boundary**

- `COLOUR-1`: a sentence carrying a MAIN instruction or condition must not be muted. "Refunds within
  7 days of purchase" is a condition, not a footnote.
- `COLOUR-8`: de-emphasis is READING RANK; disabled is an INTERACTION STATE. Muted text is still
  readable and still clickable; a disabled control cannot be clicked and must carry an attribute
  saying so.
- `COLOUR-11`: grouping content is the job of a background (`bg-muted`), not of the text colour.

**Common business situations.** Updated time · "12 chapters · 36 lessons" · author name under an
article · unit of measure · placeholder text replaced by descriptive copy · a breadcrumb already
travelled · file size · view count · an informational "3 seats left" line.

## `COLOUR-3` — interaction and current selection

**Situation.** The element can be clicked or navigated to, or it is the CURRENT item in a set of
choices. The colour here says "something can be done here" or "you are here".

**Recognition signs**

- It has an `href`, an `onClick`, or an `aria-current` / `aria-selected`.
- Remove the colour and the user no longer knows where anything can be clicked.
- Selection PERSISTS; it does not vanish when the pointer leaves.

**Ask yourself.** Does this element lead to an action, or does it declare where the user currently
is?

**Boundary**

- `COLOUR-1`: this is the most violated boundary in the module. Painting a static heading primary so
  it looks "more important" is WRONG: reading rank is decided by typography.
- `COLOUR-7`: selection is a DATA state, focus is a KEYBOARD POSITION. A selected row is still
  selected after focus has moved away, so both must remain visible at once.
- hover: hover is temporary and must NOT look like selection. An item that was hovered and released
  has recorded nothing.
- `COLOUR-4`: a "Confirm" button is not a success colour. It is an action, not yet a result.

**Common business situations.** Inline link · open navigation item · selected tab · selected row in
a list · primary action button · current step of a wizard · active filter chip · "See all" at the
end of a section.

## `COLOUR-4` — a completed outcome

**Situation.** Something has ACTUALLY completed, and the system knows it. Not "the wording sounds
cheerful".

**Recognition signs**

- An event has happened: paid, published, submitted, synced.
- There is a state field in the data to point at.
- A word or an icon can be attached that states that very state.

**Ask yourself.** Is there a state in the data named "success" or "complete" for this code to point
at?

**Boundary**

- `COLOUR-1`: a good number, a discount, a compliment — none of these are success. They are content,
  not state.
- `COLOUR-3`: the button that CAUSES success is interaction; only the RESULT is `COLOUR-4`.
- `COLOUR-5`: if the work is done but a deadline still lies ahead, those are TWO elements with two
  codes, not one intermediate colour.

**Common business situations.** "Paid" · "Published" · "Submitted" · "Email verified" · "Sync
succeeded" · the completed label of a chapter · a passing test result.

## `COLOUR-5` — a recoverable warning

**Situation.** Nothing has broken yet, but it will break if the user does nothing. There is always a
preventive action alongside.

**Recognition signs**

- There is a deadline or a threshold being approached.
- The user still has a way to avoid the consequence.
- The current content is still valid, only about to stop being valid.

**Ask yourself.** Has this ALREADY broken, or is it only ABOUT to break if nobody intervenes?

**Boundary**

- `COLOUR-6`: "Card expires in 3 days" is `COLOUR-5`; "Card has expired" is `COLOUR-6`. The boundary
  is the tense of the verb, and it lives in the data, not in the feeling of urgency.
- `COLOUR-2`: a neutral note is not a warning. Use a warning only when there IS a consequence for
  ignoring it.

**Common business situations.** "Plan expires in 3 days" · "2 seats left" when they are running out
· "Draft not saved" · "90% of storage used" · "Two-factor authentication is off" · "Session about to
expire".

## `COLOUR-6` — failure and destruction

**Situation.** One of three things: an operation HAS failed, a piece of data IS invalid, or an
action WILL destroy something that cannot be recovered.

**Recognition signs**

- There is a real error to display, with a readable reason.
- Or the input is in an `aria-invalid` state AFTER validation has run.
- Or the button will delete, cancel, revoke or terminate.

**Ask yourself.** Has a failure already happened, or is an unrecoverable loss about to happen?

**Boundary**

- `COLOUR-5`: see above — already broken versus about to break.
- `COLOUR-2`: a REQUIRED FIELD NOT YET FILLED IN is not yet an error. Painting a form red the moment
  it opens is lying about the state.
- `COLOUR-3`: a "Delete account" button carries both roles — it is an action AND it is destructive.
  The destructive role wins, because the consequence of misreading it is larger.

**A border is not enough.** A red border says "something is wrong" but does not say WHAT is wrong.
Always keep a visible message.

**Common business situations.** "Payment failed" · a malformed email after submit · "Could not load
data" · a permanent-delete button · "Passwords do not match" · a deadline already passed ·
"Rejected".

## `COLOUR-7` — keyboard focus

**Situation.** Where the keyboard is standing. This is information about the INPUT DEVICE, not about
the data.

**Recognition signs**

- It appears only during keyboard navigation (`focus-visible`).
- It moves continuously as Tab is pressed; nothing is recorded.
- It must be visible on EVERY surface, including while the element is selected.

**Ask yourself.** Does this thing disappear when the user tabs away? If so — it is focus, not
selection.

**Boundary**

- `COLOUR-3`: selection remains after focus has left. If only one of the two is visible, the
  keyboard user gets lost.
- hover: hover cannot replace focus. Mouse and keyboard are two different ways in.

**It may not be removed.** Dropping `outline` without replacing it with a ring removes the keyboard
user's only path.

**Common business situations.** Form input · button · link · clickable row in a list · tab · item in
a menu command · checkbox and radio.

## `COLOUR-8` — disabled

**Situation.** The control is PRESENT but NOT YET USABLE, because a business condition has not been
met.

**Recognition signs**

- There is a real `disabled` or `aria-disabled` attribute, not merely a pale colour.
- There is a business reason that can be said out loud: selection incomplete, insufficient rights,
  processing.
- Clicking it does nothing.

**Ask yourself.** Is there a specific business condition making this control unusable, and has that
condition been stated anywhere?

**Boundary**

- `COLOUR-2`: this is the most dangerous boundary in the module, because THE TWO CODES SHARE A TOKEN.
  Only `opacity-50` TOGETHER WITH a real disabled state separates them. Descriptive text given
  `opacity-50` will be read as "broken", and a disabled button missing `opacity-50` will be clicked
  over and over with no explanation.
- `COLOUR-6`: disabled is NOT an error. Do not paint a button red merely because it cannot be
  clicked yet.

**Common business situations.** Submit button while the form is invalid · "Next step" before the
selection is complete · a feature outside the plan · a button while submitting · an out-of-stock
option · an action the user lacks permission for.

## `COLOUR-9` — the base plane

**Situation.** The background of the whole page. Everything else sits ON it.

**Recognition signs**

- There is no surface beneath it any more.
- It is where the theme decides "light or dark".

**Ask yourself.** Is there any surface underneath this element? If not — `COLOUR-9`.

**Boundary**

- `COLOUR-10`: the page background must NOT be written with `bg-card`. If everything is a card,
  nothing can rise above anything.

**Common business situations.** Page body · background of a full-screen layout · background of a
print page · background of an empty screen.

## `COLOUR-10` — raised surface

**Situation.** A SELF-CONTAINED block sitting on the page background: it gathers a group of content
into one unit with its own boundary.

**Recognition signs**

- It has its own boundary (border, shadow, rounded corner).
- The content inside belongs together and is separated from the rest of the page.
- Text inside DOES NOT change meaning on entering it — it is still `text-foreground`.

**Ask yourself.** Is this block a self-contained unit of content standing on the page background?

**Boundary**

- `COLOUR-9`: see above.
- `COLOUR-11`: `bg-card` RISES; `bg-muted` SINKS. A block inside a card that uses `bg-card` again
  produces no layer at all, only two patches of the same colour.

**Common business situations.** Course card · order summary panel · dialog · popover · a feed item
with its own boundary · dashboard widget.

## `COLOUR-11` — nested region

**Situation.** A region INSIDE a surface that needs to read as a sub-group but must NOT be promoted
into a self-contained block.

**Recognition signs**

- It always sits inside a `COLOUR-10` or a `COLOUR-9`.
- It has no page-level heading of its own and does not exist if pulled out.
- It only says "these things go together".

**Ask yourself.** Could this region stand on its own if taken out of its parent surface? If not —
`COLOUR-11`.

**Boundary**

- `COLOUR-10`: see above.
- `COLOUR-12`: if you only need to SEPARATE two regions rather than GATHER one, use a boundary, not
  a background.
- `COLOUR-3`: a nested-region background is NOT a selected-item background. A selected item uses
  `bg-primary/10`, because it states selection, not grouping.

**Common business situations.** Code block in an article · summary region inside a dialog · total
row under a list of products · nested quotation · preview region in an editor · group row in a
table.

## `COLOUR-12` — neutral boundary

**Situation.** You need to say "these two sides are different things", and NOTHING more.

**Recognition signs**

- The boundary carries no state.
- It must not read as a warning, as selection, or as an error.

**Ask yourself.** Is this line carrying any state? If not — `border-border`.

**Boundary**

- `COLOUR-6`: a border turns into `border-danger` only AFTER validation has run and the value is
  genuinely invalid.
- `COLOUR-3`: the border of a selected item states selection, and still needs a non-colour cue.
- `COLOUR-11`: gather with a background, separate with a border — never do both to say one thing.

**Common business situations.** Card border · divider between rows · input border in its normal
state · table border · the line between a header and its content.

## `COLOUR-13` — independent data categories

**Situation.** Several PEER data series, none of which is success, warning or danger. They only need
to be TELLABLE APART.

**Recognition signs**

- The number of series is decided by the data, not by the design.
- No series is better than another.
- A legend, a label or a value accompanies them.

**Ask yourself.** Are these several peer categories, or is this ONE state being drawn in several
colours?

**Boundary**

- `COLOUR-4/5/6`: if the three slices of the chart are really "passing / warning / broken", those
  are three STATES and must use the three state codes, not a categorical palette.

**Required.** The mapping of colour to category must be STABLE across renders, and every series must
also carry a label, a value or a pattern. A chart distinguished by hue alone is a chart nobody can
read in black and white.

**Common business situations.** Traffic-source share · study time split by topic · comparison of
several plans · several lines on one time chart · heatmap by category.

## `COLOUR-14` — brand artwork

**Situation.** The brand IMAGE itself: logo, mascot, illustration. Its palette is decided by the
brand, not by this module.

**Recognition signs**

- It is a graphic asset, not a control.
- It carries no state and cannot be clicked (if it can be clicked, the clickable area is `COLOUR-3`).

**Ask yourself.** Is this artwork, or is it the interface borrowing brand colour?

**Boundary**

- every remaining code: this exception stops AT THE EDGE OF THE ARTWORK. The interface around it
  still follows the semantic tokens. An orange logo does NOT permit an orange button.

**Common business situations.** Logo in a header · mascot in an empty state · error-page
illustration · hero background image · partner badge.

## `COLOUR-15` — text over media

**Situation.** Text must be readable over an image whose lightness is NOT known in advance.

**Recognition signs**

- What sits behind is decided by the user or by the data.
- No token can guarantee contrast, because the background is undetermined.

**Ask yourself.** Is this overlay GUARANTEEING CONTRAST, or is it making the image look nicer?

**Boundary**

- `COLOUR-10`: if the background is determined and theme-controlled, that is a surface and needs no
  overlay.
- decoration: an overlay chosen for aesthetics is a violation. This exception is open for legibility
  only.

**Common business situations.** Title over a course cover · caption over a video thumbnail · text
over a user-uploaded banner · label over a product photo.

## Inputs

| Input | Evidence required |
|---|---|
| element | The single node receiving the class |
| role | content, interaction, state, surface or boundary |
| rank | primary or supporting — for content only |
| state | neutral, selected, success, warning, danger or disabled |
| surface relationship | base, raised, nested or overlay |
| non-colour cue | text, icon, shape, pattern or accessible label |
| theme | light, dark and forced-colour must resolve the same role |

## Rules

1. Use semantic tokens. A component does not author raw hex, RGB or a palette shade.
2. Each code emits exactly one class expression. Two codes may share a token only where a second
   class separates them: `COLOUR-2` and `COLOUR-8` both reach for `text-muted-foreground`, and
   `opacity-50` plus a real `disabled` / `aria-disabled` state is what tells them apart.
3. Typography owns reading rank. Colour never promotes ordinary text into a heading.
4. Every `COLOUR-4`, `COLOUR-5` and `COLOUR-6` carries a matching text, icon or accessible label.
5. Selection (`COLOUR-3`) and focus (`COLOUR-7`) are different states and stay distinguishable when
   both are present on one element.
6. The same semantic role holds across light, dark and forced-colour themes. A theme changes token
   VALUES; it never changes which code applies.
7. The shared surface vocabulary is `bg-background`, `bg-card`, `bg-muted`, `border-border` and
   `ring-ring`. No module invents a parallel surface token name.
8. One element, one role. A surface node does not also carry a status colour.
9. A status tone is written as its FOREGROUND token: `text-success-soft-foreground`,
   `text-warning-soft-foreground`, `text-danger-soft-foreground`. The bare `-soft` token is a
   surface, not text, so `text-success-soft` states a tint where a legible tone was meant. When the
   element paints the soft surface, the pair is fixed: `bg-success-soft` takes
   `text-success-soft-foreground`, and the same holds for warning and danger.
10. Every rendered element resolves to exactly one code. No element is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Brand artwork (`COLOUR-14`).** A logo, mascot or illustration may use a controlled brand palette.
  This covers the artwork itself, never the interface around it.
- **Data visualisation (`COLOUR-13`).** A chart may use an ordered categorical palette when the
  mapping is stable and every series also carries a label, value or pattern.
- **Text over media (`COLOUR-15`).** An overlay may be chosen for measured contrast against an
  unpredictable image, never for decoration.
- **No role established.** Preserve the current class. For new readable content with no state, the
  safe default is `COLOUR-1`.
- **Role genuinely ambiguous.** Ask exactly ONE question about intended meaning, then stop. The
  answer is a class string or a question — never both.
- **State parity.** Skeleton, loading and real content keep the element's code. Changing colour while
  loading is lying about the role.

## Output

One block per element, outermost first:

```text
element: <the node receiving the class>
situation: <COLOUR-1 … COLOUR-15>
className: <semantic classes>
non-colour cue: <text | icon | shape | pattern | none>
reason: <business fact that excludes the adjacent code>
```

## Worked example

**Request.** "A page with an order card showing the order number, the date it was placed, that the
order has been paid, a total row, and a link to the order details."

The request states a page surface, a card, a card boundary, four pieces of content, one status and
one link. It states no failed payment, no unmet condition, no chart, no artwork and no image behind
text, so `COLOUR-5`, `COLOUR-6`, `COLOUR-8`, `COLOUR-13`, `COLOUR-14` and `COLOUR-15` do not resolve
here.

```text
element: page body
situation: COLOUR-9
className: bg-background text-foreground
non-colour cue: none
reason: nothing sits beneath it, which excludes COLOUR-10
```

```text
element: order card
situation: COLOUR-10
className: bg-card text-foreground
non-colour cue: none
reason: it is a self-contained unit on the page background, which excludes COLOUR-11
```

```text
element: card border
situation: COLOUR-12
className: border-border
non-colour cue: none
reason: the boundary carries no state, which excludes COLOUR-6
```

```text
element: order number
situation: COLOUR-1
className: text-foreground
non-colour cue: none
reason: it is the line that identifies the order, which excludes COLOUR-2
```

```text
element: date placed
situation: COLOUR-2
className: text-muted-foreground
non-colour cue: none
reason: it answers "when" for the order number and is not required to act, which excludes COLOUR-1
```

```text
element: paid status label
situation: COLOUR-4
className: text-success-soft-foreground
non-colour cue: text "Paid" + check icon
reason: the data carries a completed payment state rather than a pleasant-sounding value, which excludes COLOUR-1
```

```text
element: total row
situation: COLOUR-11
className: bg-muted text-foreground
non-colour cue: none
reason: it cannot stand outside the card, which excludes COLOUR-10
```

```text
element: total amount
situation: COLOUR-1
className: text-foreground
non-colour cue: none
reason: it is the figure the user decides on, which excludes COLOUR-2
```

```text
element: details link
situation: COLOUR-3
className: text-primary
non-colour cue: underline on hover
reason: it navigates somewhere rather than reporting the outcome, which excludes COLOUR-4
```

`COLOUR-7` is not something the prose can omit: the details link is keyboard-reachable, so it also
carries `focus-visible:ring-2 focus-visible:ring-ring`. Focus states where the input device is, not
what the business asked for. And the card itself stays `COLOUR-10` — it does not turn green because
the order was paid; that state belongs to the status label, a child element.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.
