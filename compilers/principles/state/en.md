---
title: State
---

# State

You are given a plain request in prose — "a Save button that calls the server" — and you return, for
every element that request implies, the situation codes it owns and one className. The request never
lists the appearances an element should have and you never choose that number: it is DERIVED from
what the element can do.

## Law

An element does not have one appearance. It has as many appearances as the conditions it can enter,
and that number is derived from its capability. It is not chosen, and it is not a matter of how many
variants somebody had time to draw.

Count twice. First count the states the element CAN enter, from its own capability: it is pointed
at, it receives the keyboard, it is being pressed, it is turned off, it is the current one, it is
working, the value it holds has been rejected, the value it holds is frozen. Then count the states
it actually DRAWS. If the second number is smaller than the first, the element is incomplete, and
the missing states are precisely the ones nobody reports — because the person who needs them is not
the person looking at the screen.

**This is binding, not advisory.** Every rendered element carries a state situation, and every state
situation has a code below. There is no element too small to be exempt: a text link inside a
sentence owns `STATE-3` for exactly the same reason a submit button does, and a row in a list owns
`STATE-6` for the same reason a navigation tab does. "It is only a link" is not an exemption — it is
the most common place this rule is skipped.

Completeness is the law, and completeness is INVISIBLE. A control that draws hover but not
focus-visible looks finished in every screenshot ever taken of it, and cannot be operated by anyone
driving the page from a keyboard. No review that consists of looking at a picture will ever catch
it, because the defect is defined by the absence of something the picture had no reason to contain.
That is why the count is written down instead of eyeballed.

## Situation codes

Every situation this module governs carries a code, `STATE-<index>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing, and two codes
emit no variant at all — because having exactly one appearance is a decision, not the absence of
one.

| Code | Situation | className |
|---|---|---|
| `STATE-0` | Non-interactive content; the element cannot change appearance because nothing can act on it | *no state variant* |
| `STATE-1` | Rest — the baseline every other layer is measured against | base classes, no variant prefix |
| `STATE-2` | A pointer is over an operable element | `hover:bg-muted` |
| `STATE-3` | Keyboard focus has landed on it | `outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| `STATE-4` | The press is happening right now | `active:bg-muted/80` |
| `STATE-5` | Not operable in this context | `disabled:pointer-events-none disabled:opacity-50` + the `disabled` attribute |
| `STATE-6` | Persistently the chosen, current, checked or open one | `aria-[current=page]:bg-muted` · `aria-selected:bg-muted` |
| `STATE-7` | The element's own work is in flight | `aria-busy:cursor-progress` + `disabled` + a visible progress indicator |
| `STATE-8` | The value the element holds has been rejected | `aria-invalid:border-danger aria-invalid:ring-danger` + a linked message |
| `STATE-9` | The value is readable and focusable but frozen | `read-only:bg-muted read-only:cursor-default` |

`STATE-0` AND `STATE-1` ARE NOT THE SAME CODE. `STATE-0` says no state axis exists — nothing can
point at this paragraph, focus it, press it or reject it, so it has one appearance and that is
complete. `STATE-1` says a state axis DOES exist and this is its origin: the appearance the element
returns to when the pointer leaves, the keyboard moves on and the press ends. They fail differently.
An element wrongly called `STATE-0` is an interactive element with no states at all. An element with
`STATE-1` missing is a control that has a hover appearance and no defined appearance to go back to,
which is how a button ends up permanently highlighted after a click on a touch screen.

The indices are ordered, and the order carries two facts. `STATE-2`, `STATE-3` and `STATE-4` are the
TRANSIENT layers, driven by the input device, and they are numbered in the sequence the user meets
them: the pointer arrives, the keyboard lands, the press commits. That is also the order they must
be declared in, because a later declaration of equal specificity wins and a press must be able to
override a hover. `STATE-5` through `STATE-9` are the DECLARED layers, carried by data, permission
or validation rather than by the momentary position of an input device, and they outrank the
transient ones: a disabled control does not draw hover, whatever the pointer is doing.

**Mandatory floor.** An element that responds to a pointer or a key owns `STATE-1`, `STATE-2`,
`STATE-3` and `STATE-4` — all four, always, with no exception for size, importance or how obvious
the control seems. Each declared code is then mandatory the moment the element has the matching
capability.

| The element can… | …then it must also draw |
|---|---|
| be unavailable, by permission, quota, prerequisite or context | `STATE-5` |
| be the current, chosen, checked or open one among peers | `STATE-6` |
| start work that does not complete in the same frame | `STATE-7` |
| hold a value a validator can reject | `STATE-8` |
| show a value that is deliberately not editable here | `STATE-9` |

`STATE-3` is the one that is mandatory without condition and skipped most often. Any element that
can receive focus draws a focus indicator that is visible against whatever it sits on, at 3:1
contrast against its adjacent colours. Removing the browser default without replacing it is not a
style decision; it deletes the only signal a keyboard user has about where they are.

## Reading a request

1. **List the elements the request states.** "A Save button that calls the server" states one
   element: a button whose work goes over the network.
2. **Do not invent capability the request never states.** A permission rule, a selected condition or
   a validator is not in that request. Resolve the capability that is stated; resolve the rest when
   it arrives.
3. **Resolve outermost first.** A row and the controls inside it are separate elements with separate
   code sets; an element never inherits its child's codes, and never restates its ancestor's.
4. **For each element, name what can act on it and ask each code's question** in the section for
   that code. Unlike a single-answer scale, an element owns EVERY code whose situation matches — the
   answer is a set, not one code.
5. **Write the two counts.** List what the element CAN enter, then what it DRAWS. The difference is
   the defect; it must be empty.
6. **If two codes both match, keep both and prefer the declared one.** A control that is both
   hovered and disabled is disabled; a field that is both focused and invalid keeps its invalid
   boundary underneath the ring. If one element seems to mix ownership — the region is busy but the
   button started the work — split the ownership first, then choose.

## `STATE-0` — no state axis exists

**Situation.** Nothing can act on this element. It does not take a pointer, does not take the
keyboard, and holds no value that could be rejected. It has ONE appearance and that is complete.

**Recognition signs**

- Not clickable, not reachable by Tab, no `tabindex`, not inside an `<a>` or a `<button>`.
- Delete every handler and the content still means the same thing.
- Nothing in the data makes this element change appearance.

**Ask yourself.** Is there anything — pointer, keyboard, data, validator — that makes this element
change appearance? If there is nothing at all, it is `STATE-0`.

**Boundary**

- `STATE-1`: `STATE-0` says the state axis DOES NOT EXIST. `STATE-1` says the axis exists and this
  is its origin. A paragraph is `STATE-0`; an untouched button is `STATE-1`.
- `STATE-6`: a list row can look like plain content, but if it CAN be the selected row it is not
  `STATE-0`.
- `STATE-2`: a card with `hover:shadow` is a control in disguise. Once it draws hover it has
  declared itself operable, and it owes `STATE-3` and `STATE-4` in full.

**Write no variant class at all.** `STATE-0` is a situation code, not an empty layer. Writing
`hover:bg-transparent` on a paragraph lies about it being operable.

**Common business situations.** Description paragraph · static label · read-only figure · timestamp
· decorative `aria-hidden` icon · breadcrumb segment that is not a link · summary line under a
heading · status chip that only classifies and cannot filter.

## `STATE-1` — rest, the origin of every other layer

**Situation.** The element is operable and nothing is happening to it right now. This is the
appearance it returns to after the pointer leaves, the keyboard moves on and the press ends.

**Recognition signs**

- At least one other layer exists; if none does, this is `STATE-0`.
- Every geometric property of the element — height, border, padding — is decided in this layer, not
  in the hover layer.
- Read this layer alone and you can still tell what kind of element it is: button, link, input,
  selectable row.

**Ask yourself.** When everything lets go of this element, what appearance does it return to?

**Boundary**

- `STATE-0`: see above.
- `STATE-2`: `STATE-1` is the DEFAULT appearance; `STATE-2` is a TEMPORARY appearance laid over it.
  Setting a background only in `hover:` and leaving the default empty is backwards, and on a touch
  device the pointer never leaves, so the element stays STUCK highlighted after the tap.

**The rest layer holds all the geometry.** Border, height, width and font weight belong to
`STATE-1`. Other layers may change colour, shadow and ring only — things that do NOT push neighbours.

**Common business situations.** Untouched button · link inside a paragraph · empty input · unselected
tab · unselected list row · unchecked checkbox · clickable card in its ordinary condition.

## `STATE-2` — a pointer is over the element

**Situation.** The pointer sits on an operable element, and the element must ACKNOWLEDGE that before
the user clicks.

**Recognition signs**

- The element has a handler, or is an `<a>`, `<button>`, `<label>`, or a selectable row.
- Something will happen if the user clicks right now.
- `cursor-pointer` is present — setting the hand cursor is already a promise that it can be clicked.

**Ask yourself.** If the user clicked while the pointer is here, would anything happen?

**Boundary**

- `STATE-3`: hover is the POINTING DEVICE; focus-visible is the KEYBOARD. Two different layers, two
  different groups of users, and they do NOT substitute for each other. This is the single most
  common defect in the whole module.
- `STATE-4`: hover is "the pointer is here"; `STATE-4` is "the button is being held down".
- `STATE-6`: hover is TEMPORARY and decided by the pointer; `STATE-6` is PERSISTENT and decided by
  data. A selected tab can still be hovered, so the two layers must be distinguishable.

**Hover never stands alone.** Writing `hover:` without `focus-visible:` builds a control that can
only be used with a mouse. It still looks fine in a screenshot.

**Hover is never the only place information lives.** On a touch device there is no hover. Anything
revealed only by hover DOES NOT EXIST on a phone — if it matters, it is not a hover.

**Common business situations.** Button · link · clickable list row · card that opens a detail · menu
item · calendar day cell · filter chip · icon-button in a toolbar · clickable table row.

## `STATE-3` — keyboard focus has landed on the element

**Situation.** The user is driving the page from the keyboard and needs to know WHERE THEY ARE. This
is the unconditionally mandatory layer of every focusable element.

**Recognition signs**

- Reachable by Tab: `<a href>`, `<button>`, `<input>`, `<select>`, `<textarea>`, or `tabindex="0"`.
- Take the mouse off the desk and the user must still be able to finish the flow.
- Someone in the codebase has written `outline-none` — that is the sign this layer was deleted.

**Ask yourself.** With the mouse unplugged, can the user see where they are standing?

**Boundary**

- `STATE-2`: see above. There is no such thing as "it already has hover, so that is enough".
- `STATE-1`: `focus-visible` draws only when the browser decides the user is on a keyboard. Using
  `focus:` instead of `focus-visible:` leaves a ring stuck after every mouse click, and then someone
  deletes it to make it look right — that is exactly how this layer disappears.
- `STATE-8`: a field that is both focused and invalid KEEPS BOTH: the focus ring sits above, the
  error border stays underneath. The ring must not swallow the error border.

**The focus indicator must be visible against whatever it sits on.** A graphical object that conveys
state meets 3:1 contrast against its adjacent colours. A pale grey ring on a pale grey background is
NO RING.

**`outline-none` is not a style decision.** It deletes the only signal a keyboard user has. It is
legal only in the SAME class list as its replacement.

**Common business situations.** Button · link · input · select · checkbox and radio · tab · menu row
· dialog close button · icon-only button · clickable list row · pagination button · skip link.

## `STATE-4` — the press is happening

**Situation.** The mouse button is held down, or a finger is touching. The element must CONFIRM IT
RECEIVED the press, immediately, before any result can come back.

**Recognition signs**

- Clicking commits an action rather than merely opening a transient menu.
- On a slow network, the gap between "clicked" and "result" is long enough for the user to click a
  second time.
- On touch this is the ONLY feedback layer the user receives, because there is no hover.

**Ask yourself.** Does the user know the press registered, before the result arrives?

**Boundary**

- `STATE-2`: hover is "the pointer is here"; `STATE-4` is "being held down". On touch there is only
  `STATE-4`.
- `STATE-7`: `STATE-4` lasts exactly as long as the press — tens of milliseconds. `STATE-7` begins
  AFTER the press is released and lasts as long as the work. A submit button passes through both, in
  that order.

**`STATE-4` must be declared after `STATE-2`.** At equal specificity the later declaration wins, and
the press must be able to override the hover, not the other way round.

**Do not change geometry.** Changing font weight or border width on press pushes neighbours, and a
control that MOVES UNDER THE FINGER makes the second press land somewhere else. Change colour,
shadow, or `scale` — `scale` runs at paint time and does not recompute layout.

**Common business situations.** Submit button · checkout button · add-to-cart button · clickable list
row · quantity stepper button · key on an on-screen keyboard · press-and-hold record button · page
navigation button.

## `STATE-5` — not operable in this context

**Situation.** The element exists, the user can see it, but RIGHT NOW it cannot be used: insufficient
permission, an unfinished prior step, an exhausted quota, the wrong context.

**Recognition signs**

- A business condition decides whether this element is on or off.
- If it could be clicked, the server would refuse anyway.
- It does not disappear — meaning the intent is to LET THE USER KNOW IT EXISTS.

**Ask yourself.** Is there a business condition — permission, quota, prior step, context — that
decides whether this element is on or off?

**Boundary**

- `STATE-9`: `STATE-5` says "this is not for you right now". `STATE-9` says "this value is real,
  readable, copyable, it just is not edited here". A verified email field on a profile page is
  `STATE-9`, not `STATE-5`.
- `STATE-7`: `STATE-5` is an EXTERNAL condition; `STATE-7` is the element's OWN work. A button that
  is submitting is fundamentally `STATE-7`; it is *also* unclickable, but the reason lives elsewhere
  and so does the message.
- `STATE-0`: an element that is disabled PERMANENTLY IN EVERY CONTEXT should not be rendered as a
  control at all.

**Declared codes outrank transient ones.** Disabled draws no hover and no active. A disabled button
that still lights up under the pointer is promising that a click will register.

**Disabled is not an explanation.** A user looking at a grey button does not know why. If the reason
matters, use the `aria-disabled` exception so the element stays reachable by Tab and can state the
reason in text.

**Common business situations.** Submit button while the form is invalid · an action needing higher
permission · a "Previous" button on the first page · a seat that is sold out · a feature that needs a
paid plan · the next step while the previous one is unfinished · a delete button with no row
selected · resend-code while a countdown runs.

## `STATE-6` — the chosen, open, or current one

**Situation.** Among a set of peers, this element carries a PERSISTENT condition: selected, current
page, checked, expanded. That condition is decided by DATA, not by the pointer.

**Recognition signs**

- Move the pointer away, close the page and reopen it, and it is still there.
- One element — usually exactly one — in the group carries this condition.
- A matching ARIA attribute exists: `aria-current`, `aria-selected`, `aria-checked`,
  `aria-expanded`, `aria-pressed`.

**Ask yourself.** Let go of the pointer and reload the page: is this condition still there? If it is,
`STATE-6`.

**Boundary**

- `STATE-2`: hover is temporary and follows the pointer; `STATE-6` is persistent and follows data. A
  selected tab can still be hovered, so the two layers must be DISTINGUISHABLE — they may not share
  the same background colour.
- `STATE-1`: an unselected tab is `STATE-1`, not a faded variant of `STATE-6`.
- `STATE-5`: selected and disabled are independent facts; a row can be both the selected one and not
  operable.

**Do not encode with colour alone.** Users who cannot distinguish colours, and browsers in
forced-colour mode, lose this layer entirely. Pair it with a second cue: an indicator bar, a check
mark, a word.

**The state must live in the DOM, not only in CSS.** Without `aria-current` / `aria-selected`, a
screen reader cannot report what the eye is seeing.

**Common business situations.** Open tab · navigation item for the current page · checked row in a
table · selected day on a calendar · active filter · current plan · expanded accordion section ·
toggle that is on · current step in a stepper · selected language.

## `STATE-7` — the element's own work is in flight

**Situation.** The user has clicked, the press registered, and THE RESULT HAS NOT COME BACK. The
element must say the work is running, and must block a second click.

**Recognition signs**

- The action crosses the network, or a computation that does not finish in the same frame.
- Clicking twice would create two records, two charges, two emails.
- There is a stretch of time where the interface has nothing new to say but is not yet allowed to be
  silent.

**Ask yourself.** Between the click and the result, where does the user look to know the system
heard them?

**Boundary**

- `STATE-4`: see above. `STATE-4` lasts as long as the press; `STATE-7` lasts as long as the work.
- `STATE-5`: see above. Off because of an external condition is not the same as busy with its own
  work.
- Loading CONTENT: if a WHOLE REGION is waiting for data to render for the first time, that is the
  content of the region, not a state layer of an element. That belongs to a neighbouring module.

**Do not let the layout jump.** Replacing the word "Save" with a spinner shrinks the button and every
neighbour shifts. Keep the text, add the indicator, or reserve the space for it in advance.

**Busy draws no hover and no active.** And the second click must ACTUALLY be blocked, not merely
drawn against.

**Common business situations.** Form submit button · checkout button · file upload button ·
resend-code button · apply-discount button · sync button · search field awaiting results · grade-
submission button.

## `STATE-8` — the value it holds has been rejected

**Situation.** The element holds a value, and a validator — on the client or the server — has
REJECTED it. The element must say the fault is IN ITSELF, and say what the fault is.

**Recognition signs**

- There is a rule this value can break: required, format, length, uniqueness, range.
- There is a message that must attach to THIS element, not to the form as a whole.
- The user must be able to FIX it — meaning the element stays operable.

**Ask yourself.** Is there a rule this element's value can break?

**Boundary**

- `STATE-5`: an invalid field IS NOT DISABLED. Disabling an invalid field locks the user out of the
  one thing they need to correct.
- `STATE-3`: see above; the two layers coexist.
- Form-level error: a banner at the top of the form does NOT replace `STATE-8` on each field. The
  banner says "there is an error"; `STATE-8` says "the error is here".

**Do not encode with border colour alone.** A red border on its own is not enough. There must be
text, and the text must be LINKED to the field with `aria-describedby` so a screen reader announces
it on focus.

**Reserve space for the message.** A message appearing pushes everything below it down, and the user
who was aiming at the submit button hits something else.

**Common business situations.** Wrongly formatted email · password not strong enough · required field
left empty · discount code that does not exist · quantity above stock · end date before start date ·
username already taken · file over the size limit · invalid card number.

## `STATE-9` — the value is readable but frozen

**Situation.** The value is REAL, must be readable, must be selectable, must be reachable by Tab —
but must not be edited HERE. This is not disabled; this is a value on display.

**Recognition signs**

- The user has a legitimate reason to select and copy this value.
- The value is editable SOMEWHERE ELSE, or is generated by the system.
- It is still submitted with the form, or still needs to be read by a screen reader.

**Ask yourself.** Does the user need to read and copy this value? If yes, `STATE-9`; if no, consider
`STATE-5`.

**Boundary**

- `STATE-5`: see above. This is the most frequently mistaken boundary in the declared group:
  `disabled` makes the value DIMMED, UNCOPYABLE AND UNREACHABLE BY TAB — three losses, just to
  express one thing that `readOnly` expresses correctly.
- `STATE-0`: if the value is read-only and IS NOT a field, do not render an `<input>`. A line of text
  is `STATE-0` and more honest.

**`STATE-3` is still owed.** Read-only is still reachable by Tab, so focus must still be visible.

**Common business situations.** System-generated order number · verified email on a profile · an API
key already created · a balance computed from transactions · a cart total · a public slug generated
from a title · an invite code · finalised invoice details.

## Inputs

| Input | Evidence required |
|---|---|
| element | The rendered node and whether anything can act on it |
| capability | Whether it is pointer-operable, focusable, pressable, selectable, value-holding |
| availability | Whether permission, quota, prerequisite or context can withhold it |
| duration | Whether the work it starts finishes in the same frame |
| validation | Whether a validator can reject the value it holds |
| ownership | Whether this element or an ancestor owns the selection, busy or invalid condition |

## Rules

1. Every rendered element resolves to `STATE-0`, or to `STATE-1` plus every code its capability
   admits.
2. The state count is derived from capability, never from how many variants were drawn.
3. `STATE-2` never appears without `STATE-3`. A hover-only control is unusable from a keyboard.
4. `outline-none` is only legal in the same class list as a replacement focus indicator.
5. `focus-visible` is the focus layer, not `focus`; a pointer press must not leave a ring behind.
6. No state may be carried by hue alone. Every declared state pairs its colour with a second cue —
   text, icon, border, weight of indicator — that survives greyscale and forced-colour rendering.
7. A state indicator, and the boundary of a state-changed control, meets 3:1 contrast against what is
   adjacent to it.
8. No state may change layout. A state that alters size, font weight, border width or position moves
   the element's neighbours, and a control that moves under the pointer cannot be clicked reliably.
9. Declared codes outrank transient ones. `STATE-5` and `STATE-7` neutralise `STATE-2` and `STATE-4`.
10. Declaration order in the class list follows index order: hover, then focus-visible, then active.
11. Information revealed only by `STATE-2` does not exist on a touch device; if it matters, it is not
    a hover.
12. The state must be present in the DOM (`disabled`, `aria-*`, `readOnly`), not only in CSS.
13. A situation code maps to exactly one class group, and no class group serves two codes.
14. Skeleton, empty and error CONTENT are not this module's codes; only the element's own layers are.

## Exceptions

Exceptions are PART of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Explained unavailability.** `STATE-5` normally removes the element from the tab order, which also
  removes the explanation attached to it. When the user must be told WHY, keep the element focusable
  and mark it `aria-disabled="true"` instead of `disabled`, block the action in the handler, and give
  the reason in text. The code is still `STATE-5`; only its mechanism changes.
- **Whole-region busy.** When work belongs to a region rather than to the control that started it,
  `STATE-7` is carried by the region and the control inside it draws `STATE-5`. Two elements do not
  both claim the same in-flight work.
- **Selection owned by an ancestor.** A row that is selected draws `STATE-6` on the row. Controls
  inside it keep their own layers and do not restate the selection.
- **Native focus ring already sufficient.** An element that never sets `outline-none` and passes the
  3:1 check on its platform default satisfies `STATE-3` without a `focus-visible:` class. The code
  is still owed and still recorded; it simply emits nothing new.
- **Read-only versus disabled.** `STATE-9` is chosen only when the value must remain readable,
  selectable and reachable by keyboard. If the control is genuinely not part of this task, it is
  `STATE-5`.
- **Two codes both match.** Prefer the DECLARED code. A control that is both hovered and disabled is
  disabled; a field that is both focused and invalid keeps its invalid boundary underneath the ring.
- **Parity across viewports.** Changing the viewport, the theme or the language does not remove a
  layer. On touch `STATE-2` never fires, but it is still declared — the same component still runs on
  a machine with a mouse.

## Output

One block per element, outermost first:

```text
element: <the element and what can act on it>
can enter: <every code its capability admits>
draws: <every code it emits>
missing: <can enter minus draws — must be empty>
className: <base classes + one class group per drawn code>
reason: <the capability that makes each declared code mandatory>
```

## Worked example

**Request.** "A course settings form with a slug the system generates and the user cannot edit, a
title field the server can reject, and a Save button that calls the server."

The request states three elements: the slug field, the title field, and the Save button. It states no
permission rule, no selected condition and no busy region, so `STATE-6` is not resolved anywhere and
`STATE-7` is resolved on the button only, where the request says the work crosses the network.

```text
element: slug field — system-generated, focusable, not editable here
can enter: STATE-1, STATE-3, STATE-9
draws: STATE-1, STATE-3, STATE-9
missing: none
className: h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring read-only:bg-muted read-only:cursor-default
reason: the value must stay readable and copyable, which excludes STATE-5; it is a field the user can Tab into, and there is no press that commits an action, so STATE-2 and STATE-4 are not owed
```

```text
element: title field — holds a value a validator can reject
can enter: STATE-1, STATE-3, STATE-8
draws: STATE-1, STATE-3, STATE-8
missing: none
className: h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-danger aria-invalid:ring-danger
reason: the user must be able to correct the rejected value, which excludes STATE-5, and the linked message says the error is here rather than somewhere in the form
```

```text
element: Save button — pointer-operable, pressable, starts work that crosses the network
can enter: STATE-1, STATE-2, STATE-3, STATE-4, STATE-7
draws: STATE-1, STATE-2, STATE-3, STATE-4, STATE-7
missing: none
className: inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-primary/80 disabled:pointer-events-none aria-busy:cursor-progress
reason: the work belongs to the button itself and outlives the press, which excludes STATE-4 standing alone and excludes STATE-5, whose condition would come from outside the element
```

The request does not state that Save can be withheld by permission, quota or an unfinished
prerequisite, so `STATE-5` is not resolved; if it is later stated, the button gains
`disabled:pointer-events-none disabled:opacity-50` and the `disabled` attribute. It does not state
that the form area itself reloads, so the whole-region busy exception does not apply.

## Scope

This module decides WHICH STATES EXIST and which are mandatory. It does not decide which hue a state
is painted in, which is the neighbouring colour module's question, nor how much space a state
indicator occupies, which belongs to the spacing modules. It does not govern the content a region
shows while it has no data — skeleton, empty and failed-fetch renderings are region content, not an
element's own state layers.

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.
