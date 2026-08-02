# Card: never stack two bordered surfaces back to back

This is the rule about **when to build a card at all**, and how cards sit next to each other. The
variants of a card belong to the card element file; this file is about the decision.

## The rule

**Do not render two bordered blocks — a card, a list card, any bordered surface — directly against
each other vertically.** Two boxes stacked read as heavy, as a box joined to a box, and the eye
cannot tell where one group ends. A card has to be a **bounded object that means something**; two
of them touching is noise and destroys the hierarchy.

When the second thing is secondary, one of three shapes is correct:

1. **A secondary action becomes a flat link, not a box** — text plus a caret, underline on hover,
   `text-accent`. No border, no background. For instance "Thanh toán quốc tế ›" under the
   domestic-gateway list card is a link, not a second card.
2. **Secondary content in the same group merges into the card above**, separated by a `border-t`
   divider inside that one card rather than by a new card.
3. **Two genuinely peer groups** — both real cards — sit `gap-6` apart, each with its own label or
   identity (a `LabeledCard`), so the page reads as two regions rather than two boxes touching.

**A card is only for something that deserves to be a bounded object**: one item, one content
section, one list of choices. A single action, a navigation link, one line of metadata — not a card.
The continue block stays flat for exactly this reason, rather than being wrapped in a card it does
not need.

## Splitting or merging cards is a per-screen decision — ruled 2026-06-30

**"Split into several labelled cards" and "merge into one card" are both legal. Choose per screen;
there is no dogma of always-split or always-merge.** A setup screen may split N sections into N
`LabeledCard`s to make each region legible, or collapse all of them into one card for compactness.
Reversing direction between rounds — split, then merge — is deliberate, not a mistake; follow the
current requirement.

**When splitting configuration cards, group controls by MEANING, never one card per control.** Each
card is one meaningful group: *what to practise* is mode plus level; *how it is graded* is the
model. A single dropdown or one segmented control alone in a card is thin and unearned, and violates
the "deserves to be a bounded object" rule above. A lone control that must stand by itself gets a
helper line under it to give the card a body.

**When merging into one card:** a section inside the card is a `<Label>` plus whitespace, with **at
most one** `border-t` divider separating two large meaning clusters — for example "result / readiness"
against "configuration" — with `gap-3` around the divider. Each cluster keeps its own internal
rhythm, for example `gap-6` between controls. The suggested order is: **result and progress
("where am I") at the top**, then the divider, then configuration, then the **primary CTA**, then
the secondary control.

**A secondary control** — one that is on by default and rarely changed, such as the grading model
set to Auto — goes **below** the primary CTA, de-emphasised, and uses the shared self-labelling
dropdown (sparkle plus name), so the redundant "X = ..." helper can be dropped. Putting a secondary
control above the CTA steals attention from the main action.

**The meta-introduction** — what this screen is and what to expect: a one-line subtitle plus chips
like "N câu · giọng nói · AI chấm" — is a **flat strip under the page header**, not a card. It is an
introductory caption, not a group of controls. Remove it when it turns out to be superfluous.

**A single primary CTA stays flat.** Inside a merged card it sits in the card's flow; when the
screen is split, it sits flat outside the configuration cards. One action is never wrapped in its
own card.

## Do not confuse this with

- **Card inside a card** (nesting) — the inner one drops its fill or takes a border and inherits.
  That is a different rule; this one is about **siblings** side by side.
- **Frameless**, when the content is itself already card-shaped: `LabeledCard frameless`.
- **A flat summary inside a modal**, which is not wrapped in a card because the modal is already a
  surface.

## First applied 2026-06-24

`PaymentModal`: under the bordered "Thanh toán trong nước" list card, "Thanh toán quốc tế" became a
**flat link with a caret** opening a drawer, rather than a second card — the ruling was *"không có
card bọc ngoài, không render 2 card liên tiếp kiểu này"*. The globe icon on that link was dropped at
the same time.
