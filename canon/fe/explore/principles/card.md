# Card: never stack two bordered surfaces back to back

This is the rule about **when to build a card at all**, and how cards sit next to each other. What a
card looks like once it exists belongs to the card element's own documentation; this file is about
the decision.

## The rule

**Do not render two bordered blocks — a card, a list card, any bordered surface — directly against
each other vertically.** Two boxes stacked read as heavy, as a box joined to a box, and the eye
cannot tell where one group ends and the next begins. Gestalt's common-region principle is doing the
work here: a border says "these things belong together and those do not", so two borders touching
make a claim about a boundary that is not really there.

A card has to be a **bounded object that means something**. When the second thing is secondary, one
of three shapes is correct:

1. **A secondary action becomes a flat link, not a box** — text plus a caret, underlined on hover,
   in the accent colour. No border, no background.
2. **Secondary content in the same group merges into the card above**, separated by a top-border
   divider inside that one card rather than by a new card.
3. **Two genuinely peer groups** — both real cards — sit a full section gap apart, each with its own
   label or identity, so the page reads as two regions rather than two boxes touching.

**A card is only for something that deserves to be a bounded object**: one item, one content
section, one list of choices. A single action, a navigation link, one line of metadata — not a card.
Refactoring UI puts the same point negatively: reach for spacing before a border, and for a border
before a box.

## Splitting or merging cards is a per-screen decision

**"Split into several labelled cards" and "merge into one card" are both legal. Choose per screen;
there is no dogma of always-split or always-merge.** A configuration screen may split N sections
into N labelled cards to make each region legible, or collapse all of them into one card for
compactness. Reversing direction between rounds — split, then merge — is a deliberate response to a
changed screen, not a mistake.

**When splitting configuration cards, group controls by MEANING, never one card per control.** Each
card is one meaningful group: on a report builder, *what to measure* is the metric plus the range,
and *how it is delivered* is the format plus the recipients. A single dropdown alone in a card is
thin and unearned, and violates the "deserves to be a bounded object" rule above. A lone control
that must stand by itself gets a helper line under it to give the card a body.

**When merging into one card:** a section inside the card is a label plus whitespace, with **at most
one** divider separating two large meaning clusters — for example "where things stand" against
"configuration" — with tight spacing around the divider. Each cluster keeps its own internal rhythm.
The order that reads best is: **state and progress at the top** — where am I — then the divider,
then configuration, then the **primary call to action**, then the secondary control.

**A secondary control** — one that is on by default and rarely changed, such as a delivery mode left
on automatic — goes **below** the primary call to action, de-emphasised, and uses a self-labelling
control so the redundant "Mode: automatic" helper line can be dropped. Putting a rarely-touched
control above the primary action steals attention from the thing the screen is for.

**The meta-introduction** — what this screen is and what to expect, a one-line subtitle plus a few
chips — is a **flat strip under the page header**, not a card. It is an introductory caption, not a
group of controls. Remove it when it turns out to say nothing the heading did not.

**A single primary call to action stays flat.** Inside a merged card it sits in the card's flow;
when the screen is split, it sits flat outside the configuration cards. One action is never wrapped
in a card of its own.

## Do not confuse this with

- **A card inside a card.** The inner one drops its fill, or takes a border and inherits the
  surface. That is a different rule; this one is about **siblings** side by side.
- **A frameless card**, used when the content is itself already card-shaped.
- **A flat summary inside a modal**, which is not wrapped in a card because the modal is already a
  bounded surface.

## One worked example

A payment-method chooser lists domestic methods inside one bordered card. The escape hatch for
everyone else — "International payments" — is a flat link with a caret that opens a drawer, not a
second card underneath the first. As a card it would have claimed equal standing with the list it is
an exception to, and the two borders touching would have read as one heavy block with a seam in it.
The link also loses its leading icon: a caret already says "this goes somewhere", and a globe beside
it is decoration.
