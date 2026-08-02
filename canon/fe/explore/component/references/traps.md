# Traps, per section

Not a lookup table. Open a section only when a row has already been picked and something still feels
off, or when auditing a screen someone else built. Read one section at a time; nothing here is worth
loading whole.

Every entry is a trap that survives the type checker and the linter. The render looks right, the
gates stay green, and the defect is in what the component CLAIMS rather than in what it draws — a
list that is always one item long, a title that is not a title, a state the interface asserts and the
data cannot produce. Those are the ones worth writing down, because nothing else will catch them.


---

## surface-card

> Surfaces WITH A LABEL — the labelled card family. Section 1 of the table.

**A card sitting INSIDE another surface** — a dialog, a drawer, a panel, another card — does not
change component. Turn on the nested variant: a border STANDS IN for the shadow, because on a
non-page surface the resting shadow is either invisible or meaningless. See [[elevation]] for the
mechanism; the point here is that "nested" is an AXIS of the same component, not a different one.

**Highlighting something on the screen** is a prop of the card itself, not another layer wrapped
around it.

- **An items array whose length is ALWAYS one means the wrong family was chosen.** A paragraph is
  not a one-element list. The mistake drags in a between-row divider that separates nothing and a
  key that identifies nothing, and it is invisible in the render — which is why it is worth catching
  at the data-shape level. A single hint travelling through three shapes in one afternoon
  (accordion, then list, then a plain card with a label) is the normal course of discovering this.
- **If the frame already draws a label, do not build a second label inside it.** Same case as above:
  keeping an accordion for a single item and also setting the frame's label makes the label appear
  TWICE, because an accordion item is REQUIRED to have a title of its own.
- **An accordion item's title is a plain string.** No markdown, not even inline code. A coloured icon
  goes in a leading or trailing slot instead, because an icon placed inside the title inherits
  `currentColor` — one failed row turns its entire heading red, following the icon, and the colour
  then reads as a claim about the whole line.
- **A REPEATING frame takes an items array and FORBIDS children.** Children stay legal only on
  WRAPPING frames. This is the frame contract, and the reason is that a repeating frame owns the
  seam between its rows; a children API hands that seam to the caller, who will fill it differently
  at every call site.
- **Do not put a block that already has its own card surface into a list's free-form content slot.**
  The slot already brings padding, hover and a separator; adding a radius and a shadow on top DOUBLES
  the chrome, and the result reads as a rendering mistake rather than as emphasis.
- **Skeleton trap:** a list's skeleton flag flows down the FIXED row path only. The free-form content
  path is skipped entirely, so a caller who takes that route must build its own mirror. Nothing
  reports this; the region simply does not shimmer.
- The skeleton of a PRESSABLE card means something different from the skeleton of a regular one:
  pressable fully REPLACES its children with a generic mirror tile, while a regular card only
  shimmers the parts it draws itself. Two components in one family, two contracts, same prop name.
- Old comments may still spell a component with a namespace that has since been flattened. Read the
  comment for intent, write code against the real export.

---

## list

> Rows and lists WITHOUT a card surface. Section 2 of the table — the same shapes as the card family,
> differing on exactly one axis: whether there is a surface underneath.

- **An array of rows is DATA.** With a card surface it takes the labelled card list; without one it
  takes the bare labelled list. Never a hand-rolled map over the row primitive — that row has
  different padding, no surface, and no full-bleed separator, so the hand-rolled version is a
  slightly wrong copy of something that already exists.
- **Do not hand-roll a pressable row from a button, a flex container, an icon and a chevron.** This
  is the general failure of reaching for the bare atom instead of the composite the system already
  owns, and it costs the hover language, the press target size, and the skeleton, all of which the
  composite already settled.
- **Do not hand-build a two-verdict list from an icon plus a text renderer inside a horizontal stack
  and a map.** The composite exists, down to the divider rule and the number of skeleton rows.
- **Watch for two exports with the SAME name** — a public row component and an internal row of the
  same name inside the card list. Different padding, different separator, different element, one
  name. A name collision inside a single design system is a real trap, and the import path is the
  only thing that distinguishes them at the call site.
- **A component with zero call sites, where every real case chose its sibling, deserves a second
  look before you become the first caller.** The question to re-ask is the section's deciding test:
  does this location have a real outer surface or not?
- **A gap decision made before seeing the render is provisional.** A confident first call — "all
  three seams are tight" — was revised after the real render put an avatar next to a column of text.
  Confidence in the review is not the same as having looked at it.

---

## disclosure

> Hide and show on click. Section 3 of the table — choose by the NUMBER of collapsible regions, then
> by whether there is an outer surface.

- **Do not nest an accordion inside itself to obtain a single trigger.** It produces two nested card
  layers for one job. A single collapsible region with no surface of its own is the bare disclosure,
  and the question worth asking out loud is whether this content needs to be a card at all.
- **Do not rebuild the house disclosure out of a headless compound.** The headless default is a
  space-between trigger with a trailing caret; a leading caret at hug width is a different component
  with a different reading order, and it is hand-rolled deliberately rather than by accident.
- **A disclosure is a PRESENTATION decision, not a fabricated field.** What sits behind the click is
  still exactly one real field, put behind a click because it is secondary. The way to arrive at that
  shape is a chain of REMOVALS, measured against real data rather than imagined data: one record
  reaching eight sub-items of three fields each buries the form under two dozen lines, so the
  per-line list goes; recursive accordions and colour-coded severity text go with it, having been
  built before there was an anchor for them.
- An accordion opens and closes as ONE group identity, not as N autonomous panels. If each panel
  needs its own independent state, that is a different component, and cutting the scope for exactly
  that reason is a correct decision rather than a misuse.

---

## text

> Text. Section 4 of the table — THREE steps by STRING SHAPE, not by length. The hard boundary is
> block-level: a markdown renderer emits block markup and drives its own vertical rhythm, so it cannot
> legally nest inside a button, a trigger or an inline label; an inline rich-text renderer can nest
> anywhere.

- **A title or headline field is always at step one.** Inline code at most; never bold, italic or a
  link. The test: strip all formatting, and if the reader can still tell what they are looking at, it
  is a title; if the formatting CARRIES information, it is small rich text and belongs in the other
  step.
- **THE TYPE MUST MATCH THE INTENT.** A prop named `title` declared as `ReactNode` is an invitation
  to stuff markdown or JSX into it, and a scan for that invitation will find more callers accepting
  it than anyone expected — the worst shape being a full markdown renderer rendered inside a trigger
  button, which is invalid HTML as well as a design error. Tighten the type to a string and add a
  slot for the icon that the callers actually wanted.
- **A free scalar is never a chip.** A chip is a pill for a value from a CLOSED SET; a score, a
  count, a raw number is not a classification of anything, so it is text. The symptom to look for is
  one information type rendered two ways on two screens — a number as a chip here and as bare text
  there — which means nobody decided, twice.
- **The boundary between plain text and rich body is decided at the CONTENT layer, not by eye.** If
  the authoring schema gives one field a title and a body and gives its neighbour only a string, then
  the neighbour is plain, however tempting it is to match a nearby screen that renders markdown.
  Enforce it by stripping formatting at the render boundary, because authors will keep typing
  backticks out of habit and no gate downstream will care.
- **Do not pass JSX into an icon prop that takes a COMPONENT REFERENCE.** The atom forces its own
  size and weight onto the icon it renders; a pre-rendered element arrives with neither, and the call
  site is not allowed to set its own size.
- **Do not wrap a text component inside something that already wraps text.** Text inside text, and
  some libraries throw rather than nest.
- **The skeleton branch must be checked BEFORE any size branch.** Otherwise a heading in its skeleton
  state renders an EMPTY heading: no error, no warning, nothing in the type system, and an accessible
  tree with an empty heading in it.
- **A text component must own its values defensively.** Fall back to an explicit weight and an
  explicit colour in EVERY branch, because ancestor CSS from a component library leaks through any
  gap where the value is not declared — an accordion trigger setting a medium weight, an accordion
  body setting a muted colour. Measure it on the rendered DOM rather than reasoning about it; the
  computed value is the only thing that settles it.
- **If a mode has not been ported yet, do not pick the component and assume it is there.** A raw-text
  mode, a live-render fence, a sectioning feature: none of the gates will report the absence, and the
  call site will simply render nothing.

---

## viewer

> Payload authored by a WRITER or decided by DATA. Section 5 of the table — the shape is decided by
> the payload, and the component does not know it in advance.

- **The renderer map is the ONE place where hand-written spacing is CORRECT.** A viewer never sees
  its children as nodes — it only sees what the parser returns — so there is no seam for a frame to
  own. This is the same exemption the atom layer gets, granted for the same reason.
- **Parser glue is NOT a door for screen builders:** the renderer builder, the table node components,
  the header-row predicates. Touch them only when editing the markdown grammar itself. A real data
  table is a different section entirely.
- **Do not hand-build a parallel renderer with its own separate map.** It splits one grammar into two
  versions, and the second one is always the one that misses the next fix.
- **Two skeleton layers, and they are not the same thing.** "The whole payload has not arrived yet"
  means shimmer the full footprint and do not mount the heavy runtime. A partial internal shimmer — a
  PDF page not yet scrolled to, a code block not yet highlighted — is the viewer's own business and
  the caller cannot see it.
- **A viewer with no skeleton of its own forces the caller to build a mirror**, and the mirror must
  NOT borrow the real component's anatomy identifiers. Borrowing them produces a broken link in any
  tooling that maps identifiers back to components.
- Operational notes that only bite in an isolated environment: a PDF viewer that loads its worker
  from a CDN needs network access, so only a story with an empty source runs offline. A viewer with
  no runtime internationalisation takes its UI labels by prop, which is a deliberate boundary rather
  than an oversight.

---

## label

> Classification labels, chips and tokens. Section 6 of the table — four doors, chosen by DATA SHAPE.

- **An icon selector that is a CLOSED string union is not a weaker API than an icon reference; it is
  the point.** Narrowing to a curated set is the whole value of a house-wide symbol vocabulary. Open
  the union when a third symbol genuinely meets the bar, and never by loosening the type.
- **Do not place two chips side by side stating the SAME fact.** If a callout's tone and icon already
  say "failed", a chip repeating it is two signals competing for the same meaning. Make the chip
  state a DIFFERENT fact, or drop it.
- **Do not pass a size to a chip.** There is one size. Stepping it down to fix the look at a single
  call site is exactly how a closed scale dies — one exception, invisible in review, and then the
  next author has a precedent.
- **Design-layer chips do not fold into the house chip family.** A difficulty chip, a language chip,
  a platform chip live one layer up: they carry product meaning, and the house chip carries none.
  Filing them together makes the family unreadable.
- **A colour vocabulary is an ALIAS, not a re-declaration.** Two hand-copied colour tables with a
  translation function between them is a bug waiting to happen; once the second becomes an alias of
  the first, the translator is a no-op and should be deleted. But an alias must SPLIT the moment the
  two genuinely diverge — when one family gains a neutral informational tone that the vendor's chip
  has no value for, they are no longer the same type and pretending otherwise pushes an impossible
  value down to the vendor.
- The canonical name of a component is its file name and its own story name. Aliases that exist only
  in a merged gallery are not names, and code written against them will not be findable.
- A component that only hardcoded one prop value and added no behaviour is a VARIANT, not a
  component, and deleting it is a simplification rather than a loss.

---

## measure

> Measurements — bars, rings, stat tiles. Section 7 of the table.

- **A segmented bar's slice widths are a REAL ratio** — grow by value, basis zero — never
  relative-to-max. Slices sit flush against each other with no gap, so the bar reads as ONE
  continuous line rather than as a row of blocks. A bar that is secretly relative-to-max lies about
  every comparison the reader makes across two bars.
- **Do not duplicate the legend.** The bar renders its own; turn it off with a prop if the surface
  already has one. And a legend is not a chip group: it is a colour dot with muted text explaining a
  COLOUR, not a row of pills.
- **A target mark is a thin rule, flush with the track, square-cornered, with its label attached
  directly and no offset.** Every one of those was learned by getting it wrong: a mark five times
  taller than the thing it marks reads as a separate element, and a mark in the same tone as the fill
  makes one colour carry two meanings at once — "achieved" and "required". Keep the mark deliberately
  outside the success, warning and danger set so that the FILL alone answers "pass or not".
- The target mark is absolutely positioned against the bar's containing block and drifts if used
  standing alone. Let the bar build it when a target is passed.
- **Skeleton is its own axis, not a variant.** A discriminated union — skeleton true with optional
  data, or skeleton absent with data required — means building the resting state needs no fabricated
  fake data, which is the thing that quietly poisons a component set: placeholder numbers that
  eventually ship.
- **A component with no skeleton of its own will be REJECTED by the block that needs one**, and
  rightly: building a mirror right next to the real thing means maintaining two shapes for one
  number. Going straight to the text primitive for both states is the smaller cost.

---

## pair

> Label-value pairs and tables. Section 8 of the table — enter by whether the pairs are a fixed set
> of fields or rows of the same record.

- **The composite API law:** a composite does NOT format money, dates, units or status. The consumer
  passes an already-formatted node — a currency string, a chip — because formatting is a locale and
  business concern and the composite has neither. A composite also does not COMPUTE totals; an
  emphasis prop is purely visual stress. And a table does not sort, filter, paginate or select.
- **A table's accessible name is REQUIRED**, because the underlying grid pattern has no implicit
  label. Without it the whole table is announced unnamed, which fails WCAG's name-role-value
  requirement and is exactly the class of defect no compiler and no linter will catch.
- **One seam, one owner:** the list owns the divider decision, the LAST row gets none, and the space
  around the divider comes from the list's own gap rather than from each row's margin.
- **Alignment trap:** right alignment must go on the WRAPPING span inside the cell, not on the cell
  element, when the component library sets column alignment in unlayered CSS. Unlayered rules beat
  anything inside a utilities layer regardless of specificity, so the utility on the cell is dead
  code that looks alive.

---

## frame

> Frames and rhythm. Section 9 of the table — the axis is something the caller chooses, not something
> the component guesses.

**The content contract, stated plainly.** A frame that WRAPS free-form content takes children. A
frame that REPEATS a list takes an items array and forbids children. A frame with MULTIPLE ROLES
takes NAMED slots and no children, so that "which child goes where" is not a question anyone has to
ask.

- **Exactly one frame is allowed to write raw flex, gap, alignment and justification**, and that
  frame is INTERNAL to the frame layer — exported only because its own siblings import it. Everything
  above the frame layer hand-writes no layout at all. The reason is worth quoting in full: a public
  frame that can do everything the constrained one can is not a second option, it is the way the
  constraint gets bypassed.
- **Container queries, not viewport queries**, wherever the shell can be split and a docked panel can
  squeeze the column. A viewport query answers a question about the window; the column does not care
  about the window. Beware that a framework's built-in container sizes are a DIFFERENT and roughly
  half-size scale from a named container's — reaching for the wrong one silently halves every
  breakpoint, and the layout merely looks conservative rather than broken.
- **Do not swap a token-derived max width for a numerically equal utility "to tidy up".** They match
  today and come from different sources; when the token moves, the width and the breakpoint that was
  meant to pair with it drift apart, and nothing errors.
- **Do not cram a third thing into a two-slot split.** The named slots exist to CLOSE the question of
  where each child goes. The payoff is concrete: the min-width-zero on the start slot and the
  no-shrink on the end slot are applied in ONE place instead of at every one of the dozens of call
  sites that use the pattern.
- **A workspace frame that hard-owns its measurements is correct.** Add a prop only when a real THIRD
  consumer disagrees with one of the numbers. And beware the fake version: a wrapping stack with
  wrapping enabled almost never actually wraps once the main slot has min-width zero and grows, so
  the split renders side by side at EVERY width, including a phone.
- **Do not let a child carry its own margin.** A seam has exactly one owner and the owner is the
  PARENT. Even the breathing room around a separator character comes from whitespace in the string
  itself, not from a margin someone typed onto the mark.
- **The enforcement mechanism, and the sole reason a frame owns the gap at all:** gap and padding are
  union literals and the gap is always REQUIRED, so an off-scale value is a COMPILE ERROR at the call
  site rather than a finding discovered in review. The caller picks a variant, not a step. A number
  lets the author choose whatever looks right and keeps the reasoning out of the code; a word forces
  them to answer for it — and it matters most at the steps nobody can tell apart by eye, which is
  where the great majority of call sites land.
- The easiest pair of gap words to confuse: swap the two items and if the meaning does not change,
  they are peers. If order carries meaning, or each line is a different kind of thing belonging to
  one facet, they are grouped rather than related.
- **A count that covers only ONE way of writing something will undercount, and any scale derived from
  it inherits the blind spot.** A scale built by counting a prop concluded that a step was unused,
  while dozens of call sites were writing the same value as a class and sailing straight past the
  gate built to catch them. A gate checking against the WRONG scale is worse than no gate at all,
  because its silence reads as agreement.

---

## page

> Page, region, overlay. Section 10 of the table — enter by what the thing covers: a whole route, a
> region inside one, or the screen itself.

The label row above a card is already a frame prop — label, trailing label, see-more, action — so the
header sub-component is almost never called directly.

- **Do not hand-roll a right-aligned button row inside a dialog's body.** That is what the footer
  slot is for, and it already carries the alignment and the gap. Pass bare buttons into it.
- **THE PARENT KEEPS THE RHYTHM.** The dialog's own gap decides the seam between its parts; the child
  only turns OFF the margin the library ships by default. One seam, one owner.
- **A FRAME MAY NOT ASK WHAT KIND OF CONTENT IS INSIDE IT.** A prop that made the caller declare "my
  body opens with a tab strip" so the frame could subtract four pixels was deleted: those four pixels
  are the tab strip's own geometry, and the tab strip has to own them. Any prop of that shape is a
  frame reaching into its children's business.
- **Do not hand-build a header node when all you have is a title, a description and an action.** Pass
  props and let the frame build it. The node slot is an ESCAPE HATCH for an unusual header — a
  toolbar row — not the main path, and using it as the main path means every page's header is built
  slightly differently.
- **Do not expect a confirmation dialog to close itself after confirming.** The caller closes it when
  the action resolves, because only the caller knows whether the action resolved. And such a dialog
  deliberately exposes no children: there is no door to stuff extra content through.
- **A part-name prop exists so the PARENT can name a child as ONE node.** Without it, the parent is
  forced to pass a flag down into the child, which cracks the child open and lets a grandchild leak
  out as if it were a sibling. That is the ROOT of an entire class of bug rather than a symptom of
  one.
- **A container query measures its own content box MINUS its own padding.** Putting padding on the
  same element that declares the container silently shrinks the measured width, and at the largest
  size the cap lands on exactly the token being tested, so the top breakpoint NEVER fires — confirmed
  live in a 1920px window, where a split workspace stayed stacked in a single column. The fix is two
  nested elements: the outer holds the container declaration and the max width, the inner holds the
  padding.
- A duplicate frame gets DELETED rather than kept as the weaker copy. Where two frames overlap, the
  correct answer is usually the constrained one composed inside the general one, not a third frame
  that does a bit of each.

---

## async

> Async, notifications, empty holes. Section 11 of the table — enter by the shape of the placement (a
> strip inside a surface, or a centred hole) and by whether the region has a height of its own.

- **The async switch is NOT used at the SCREEN layer.** A screen calls blocks and frames, never a
  composite directly. The evidence is stronger than the taste: if none of the blocks on a screen
  exposes an error prop, then wiring an error branch at the screen layer is FABRICATING a state that
  no part of the screen can express. Wiring a screen straight into a four-branch switch is the same
  failure as rebuilding a worse version from a bare part instead of reusing the whole thing.
- **The one documented exception:** the empty-state component is imported at the screen layer only
  when it replaces the ENTIRE BODY of the screen — not as a node for one phase of it.
- **Do not wrap the async switch around a frame that ALREADY has its own skeleton and empty axes.**
  The deciding test: does this region have one bounded surface that must persist through EVERY state?
  If yes, use the frame's own axis, so that the section reads as the same surface whether it is
  shimmering, empty, erroring or full. If no — a strip of chips has no frame to lose — use the switch.
  Two different answers on the same screen can both be right, provided the reasoning is written down
  beside each.
- **PARTIAL reuse is legitimate.** Passing the error-message component in as a frame's empty state,
  with an empty items array, renders the retry message BOUNDED inside the same surface — reusing the
  message frames without the switch, and preserving the priority order where an error outranks a
  pending load.
- **Do not hand-build a button for a callout's action.** Pass the label and the handler; the frame
  builds the button and applies the status-appropriate skin, which is precisely so the screen never
  has to touch an atom.
- **One gate down to the vendor's alert.** Before consolidation, each side of the product imported it
  independently and kept its own colour table and close logic, so every fix had to be made twice. And
  free-form content goes through a named slot rather than children.
- **The contract trap that is invisible unless you read the source:** leaving the error content empty
  means the error branch DOES NOT ACTIVATE and the frame falls through to loading, empty, then
  content. Leaving the empty content empty means the empty branch renders nothing and the region
  HIDES ITSELF — a silent empty branch, which looks exactly like a data bug from the outside.
- **A compact size that SILENTLY drops most of its props** — icon, description, body, action, code —
  will accept them all and render a dim title. Read what a size variant actually renders before
  choosing it.
- **The three message families form a COMPOSITION CHAIN, not three parallel choices.** The alert is
  the base; the callout is the alert plus a soft skin plus a button built from text; the toast is the
  alert plain. The empty state is the base for the async empty and error, which add only a default
  glyph and wrap a retry handler into a button. Knowing it is a chain stops you from adding a fourth
  parallel family.
- A status value the vendor's CLOSED union never had must be mapped down to a safe default at the
  boundary, with the wrapper's own tables deciding the real colour. Passing the new value straight
  through is a runtime failure the types were supposed to prevent.

---

## form

> Inputs and forms. Section 12 of the table — form atoms CARRY THEIR OWN label, hint, error message
> and required flag. There is no component whose job is wrapping a label around a field.

- **Do not wrap an extra label frame around a form atom.** The atom already carries one; wrapping
  gives two layers of label and two candidates for the accessible name.
- **Form layout components handle LAYOUT ONLY.** No validation, no values, no field errors: label,
  description and error belong to the atom, business rules belong to the block layer. A layout
  component that starts holding values is on its way to becoming a form library nobody chose.
- **A lone radio cannot stand alone.** Description, error and required are the GROUP's business, not
  the individual option's. Needing one radio usually means needing a group with one option, or
  needing a switch.
- **An autocomplete that does NOT filter locally says so in its prop documentation**, and the parent
  is responsible for fetching and filtering. That is the sole boundary between it and the combobox
  that does filter locally — one axis, and it decides which one you want.
- **An items array is required for every REPEATING list in this section.** Children stay valid only on
  the field wrapper and on the wrapping form frames.
- A prop that pins a drag-active state from the outside exists so a story can render a state that
  normally lives only inside a hook. Props of that kind are legitimate, and they are also the ones
  most likely to be mistaken for application state.

---

## button

> Buttons and actions. Section 13 of the table — enter by how many actions there are and where the
> row sits.

- **A radio-style button group absolutely forbids the primary variant.** Selected is a NEUTRAL tone,
  unselected is ghost. A configuration row usually sits on the same surface as the page's single
  accent action, and a selected option wearing the accent competes with the one thing on the screen
  that is meant to be obvious.
- **A button group is not a button radio group, and the difference is in the FORM, not in a prop.** A
  group is N separate stateless actions, each with its own handler. A radio group is ONE stateful
  control with a pressed state and group semantics. Picking the wrong one produces a control that
  announces itself wrongly to assistive technology while looking identical.
- **Do not hand-roll a row of suggestion chips again.** It was consolidated out of four nearly
  identical call sites; compose the composite wherever that shape is needed.
- **Do not let a "see more" link render its own anchor inside a card that is already pressable as a
  whole.** Nested press targets are ambiguous to a pointer and invalid to a screen reader. Use the
  decorative mode so the affordance is visible without being a second target.
- **A headless library's pending flag does NOT draw a spinner on its own.** The wrapper renders it by
  hand, and this is a recurring trap: the flag is set, the button is correctly disabled, and nothing
  visible happens.
- **Count before you design a variant set.** The most-used variant in real code turned out to be a
  secondary tone that the atom did not originally offer, while a variant everyone assumed was
  essential had a handful of call sites.
- Record outstanding debt in the open: components still importing a button from a legacy path are a
  known deviation, not a pattern to copy.

---

## nav

> Navigation. Section 14 of the table — four rungs of the same tab problem: pure-data items, then a
> caller-built tree when each tab needs its own chrome, then a row with two tab groups, then that row
> inside a surface.

- **A toolbar has NO background, border, radius or padding.** A name containing "card" was changed
  precisely because it was a lie — there is no card in it, and a name that misdescribes the component
  costs more than an awkward rename.
- **Do not force a tooltip into a label prop.** The accessibility library must attach the hover
  handlers and the describing relationship to the EXACT element the caller supplies; a string prop
  cannot carry that. This is one of the few cases where keeping a children API is correct.
- **Do not use tabs when the items are ordered STEPS or an ancestor PATH.** A stepper says "these
  happen in order", breadcrumbs say "this contains that", tabs say "these are peers, pick one".
  Picking the wrong one makes the navigation misstate the relationship between the items, and the
  reader believes it.
- **A named exception is not the same as debt.** Forcing an items API onto a component whose caller
  has three independent axes would cram all three into one prop — a violation in the opposite
  direction, and a worse one. Write down which it is.
- **A variant that depends on a GLOBAL class means changing its look requires editing the
  application's global stylesheet**, not the component. That is a boundary crossing, and it should be
  recorded at the component rather than discovered by the next person.
- **A case OPPOSITE the usual mistake:** a weight hardcoded across both sizes made the larger step
  bolder than every other glyph of that size. Scanning in the "something is missing" direction would
  never have found it — some audits have to be run in both directions.
- A markdown directive that used to go through the wrong primitive, one with no hook for surface
  chrome, is worth recording even after it is fixed, because the wrong primitive is still the
  obvious-looking choice.
- A wrapper that adds nothing but a default is removed in favour of using the atom directly; the
  convention it carried belongs at the design layer, as its own named component.

---

## identity

> Identity, images and small signifiers. Section 15 of the table — enter by what the image stands
> for: a person, an entity's cover, the brand, or a free image.

- **A SIGNAL FROM DATA and a DECORATION must never be swapped.** A coloured band on the leading edge
  of a row is a signal FROM DATA and means something specific. A sweeping highlight is purely
  decorative and must never be used to encode a state, because the reader will learn it means
  something and then be wrong.
- **Do not wrap a decorator around a card that already has a highlight prop.** Two layers for one
  job, and filing a decorator into the card family files it under the wrong family entirely. And do
  not highlight two cards on the same surface: two highlights cancel each other out and the surface
  is back to having no focal point.
- **Do not open a backdoor that lets a caller smear a class onto an atom's internal icon.** The icon
  is the atom's business; a class-name escape hatch into it is a public API onto a private part.
- **A skeleton TURNS OFF a highlight effect.** A skeleton has no verdict yet, so it must not read as
  highlighted. And the effect layer needs a positioned ancestor — without one it paints OVER the
  content and cuts across the action button, which looks like a compositing bug and is a missing
  `position: relative`.
- **An avatar must listen to the library's loading-status callback, not to an error handler.** Many
  avatar implementations mount the underlying image only AFTER loading finishes, so the error event
  never fires and the fallback never appears. This is the general shape of the trap: a callback that
  is correct in plain HTML and dead inside a component that defers mounting.
- **A tone type that is an ALIAS of the status type keeps the same names**, including calling the
  neutral case "default" rather than declaring a separate "neutral". A synonym is a second vocabulary
  to learn for no gain.
- Static lines have no skeleton, and a spinner has none either, because the spinner IS the loading
  indicator.
- **A link and an action are TWO DIFFERENT HOVER LANGUAGES.** A link gets an underline on group hover
  and no ripple and no press scale; an action gets the ripple and the press scale. Choosing by which
  looks nicer at one call site teaches the reader that the two are interchangeable, and then a link
  that scales under the finger reads as something that will change the current page.
