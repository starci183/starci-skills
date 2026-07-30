# PROMINENCE — how prominent should this thing be relative to what's around it

> This axis answers exactly one question: **which MECHANISM to use to make
> something stand out** — just change the text color (`accent`)? frame it into a
> token (`chip`)? or turn it into a clickable action (`button`)? It does not answer
> WHICH COLOR among the 6 semantic values (see `color/rationale.md` — that axis is
> exactly as wide as ONE prop, `color`, on `Typography`/`Alert`/`Chip`). It does not
> answer which `variant` among the 7 button values (see `button/rationale.md` — that
> axis takes the handoff AFTER this axis has already decided "this is genuinely a
> button"). This axis sits ABOVE both: it decides **the form** first, the other two
> axes decide **the value inside the form already chosen**.
> Real code anchor: [`example.html`](example.html).

---
# PART A · RECOGNITION — load this part when SCANNING
---

## 1. SCALE — four mechanisms, there is no fifth mechanism

| Step | Mechanism | Use when | Anchor |
|---|---|---|---|
| **`muted`** | TEXT, no frame, dimmed color (`text-muted`) | neutral context/meta, a standalone free-floating scalar (count, time, trivia) | `CourseCard.tsx:300-308` — `482 students` = `Typography color="muted"`, NOT a chip |
| **`accent`** (text, no frame) | TEXT, no frame, signal color (`text-accent-soft-foreground`) | a BRAND/INTERACTION signal flowing inline: link · "mine" · pinned · verified · active | `SurfaceCard.tsx:1372` (`metaText`) · `Typography.tsx:381` (`isLink` default) |
| **`chip`** | FRAMED — a soft-bounded token (`HeroChip variant="soft"`) | a fixed enum/category/status, a promo badge — meaningful even when NOT clickable | `PriceTag.tsx:141-145` (`Chip tone="success"` for `−X%`) · `DifficultyChip.tsx` (dot + text) |
| **`button`** | a REAL button shape — the `Button`/`HeroButton` atom, with its own button-specific background/border/padding | a real action actually happens on click, and the rendered shape is a button shape | `CourseCard.tsx:336-344` (`Button variant="primary"`) · `ReactionButton.tsx:153-163` (`HeroButton variant="tertiary"`) |

**`default` (primary text, neither dimmed nor colored) is NOT a step on this
scale** — it is the baseline level OUTSIDE the escalation, and choosing `muted` vs.
`default` is the job of `color/rationale.md` §2 (the two-layer question in §9a.1). This
axis only starts counting from the point where there is **intent to stand out above
the baseline, or a deliberate choice to sink below it**.

Scale SSOT: there is no dedicated TypeScript union for "prominence" (this decision
sits ABOVE the component level; once it's made, you then go into one of the three
atoms `Typography`/`Chip`/`Button`). Each mechanism has its own type: `TypographyColor`
(`Typography.tsx:33`), `ChipTone` (`ChipBase.tsx:57`, an alias of `AlertStatus`),
`ButtonVariant` (`button-tokens.ts:22`).

**A chip IS allowed an icon, but ONLY a STATE icon** (locked by the teacher
2026-07-29).

The old documentation declared "text-only, icon forbidden," which is wrong against
the code: `ChipBaseProps` allows the leading glyph slot to be `icon` OR
`dotColor`/`dotClassName` (mutually exclusive in the type, `ChipBase.tsx:115-130`),
and the atom's story already builds 4 canonical `icon={...}` cases. But a flat ban is
also wrong in the opposite direction — the correct rule sits in the MIDDLE, and the
boundary is **whether that icon speaks to STATE or to DOMAIN**:

| Icon type | Allowed? | Example |
|---|---|---|
| **Basic state** — anyone understands it instantly, no product knowledge required | | `Verified` · `Failed` · `Pending review` · `Locked` |
| **Domain icon** — only meaningful once you already know the business | | course icon, assignment icon, badge icon, document-type icon |

Why the line is drawn there: a chip is a **small label read at a glance**, and its
glyph slot is exactly one character wide. A checkmark or a lock reads instantly at
that size because its shape **already is the meaning**. A domain icon requires
looking up its meaning before understanding it, and a chip sits exactly where people
don't stop to look things up — so it just takes up space, adds noise, and **adds no
information the `text` hasn't already said**.

Same test as the "universally recognized" icon rule (`icon/rationale.md` §2a):
understood at a glance, or requires association. A chip accepts only the first.

The `text` label is STILL always required (except skeleton) — an icon can never
replace text.

---

## 2. DECISION TREE — ask top-down, stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Does clicking here **REALLY trigger an action** (submit, cancel, navigate) **AND** is the rendered shape a **button shape** (the `Button` atom's own background/border)? | `button` — go to `button/rationale.md` to pick a `variant` |
| 2 | (Not 1) Is this a **FRAMED TOKEN with a fixed meaning** — enum/category/status/promo badge — regardless of whether it's clickable? | `chip` — go to `color/rationale.md` §2 to pick a `tone` |
| 3 | (Not 2) Does this text carry a **brand/interaction signal** (link, "mine", active, pinned, verified) that **doesn't need a frame**? | `accent` (text) |
| 4 | Everything else — secondary/neutral text, a standalone count scalar | `muted` |

**Trap when answering question 1:** "clickable" is NOT enough to conclude
`button` — you must ask BOTH halves (a real action **AND** the shape is a button
shape). A `Chip` wrapped in a `Popover.Trigger` really is clickable (opens the
popover), but its shape is still a chip — it stops at question 2, it does not fall
through to question 1. See TRAP #1.

---

## 6. FORBIDDEN

| # | Forbidden | Gate |
|---|---|---|
| 1 | Adding `onClick`/`onPress` directly onto `Chip` to fake being a button (instead of wrapping `Popover.Trigger`/splitting out a real `Button`) | `tsc` — `ChipBaseProps` does not declare `onClick`/`onPress`, only `onRemove` |
| 2 | Multiple highlight points at once within one region (accent-flood, §2c) | cannot be gated — discipline, judged by REGION not by a single element |
| 3 | A left–right pair with a real hierarchy but rendered at the same color step (§2b), except peer-rows | cannot be gated — discipline, requires knowing whether this is a real hierarchy or a peer relationship |
| 4 | Changing the MECHANISM (element) of the same info-type across states instead of changing TONE (§2d) | cannot be gated — discipline, requires understanding the info-type's semantics across states |
| 5 | Copying the old wording from traps #6/#7 (§4 of this document) into new code/docs without re-grepping `ChipBase.tsx`/`chip.css` | cannot be gated — discipline |
| 6 | Writing a color class by hand (`text-accent`, `bg-*-soft`) outside the 3 atoms `Typography`/`Chip`/`Button` to fake one of the four mechanisms | NOT YET — overlaps the missing gate from `color/rationale.md` §6 row 1; no dedicated script for this axis has been written yet |

**Unfinished work, noted so it isn't lost:** row 6 needs an AST gate that counts by
REGION (how many `accent`/`chip`/`button` points appear together under one parent
node), more complex than a plain regex — the same reason `button/rationale.md` §6 rows
2/3 are still missing, for the same reason: "must be read as a cluster."

---
# PART B · LOOK UP WHEN DRIFT IS FOUND — only open when Part A returns a drift result
---

## 3. EXHAUSTING THE EASY-TO-CONFUSE CASES — all 6 pairs

A 4-value scale ⇒ `C(4,2) = 6` pairs. The order used to group them: `muted →
accent → chip → button` (most recessive → most prominent, matching the tree's 4
questions in order, read bottom-up).

### 3a. Three ADJACENT pairs — this is the entire battle

| Pair | THE DECIDING TEST | Anchor |
|---|---|---|
| **`muted` ↔ `accent`** | Does this text carry an **interaction/brand signal**, or is it just a neutral fact? Carries a signal ⇒ `accent`. Neutral, standalone ⇒ `muted`. | `CourseCard` "482 students" (`muted`, neutral) ↔ `SurfaceCard` `metaText` pinned/verified (`accent`, a signal) |
| **`accent` ↔ `chip`** *(the HEAVIEST pair — easiest to confuse)* | Is this meaning **BOUND to a fixed set of values** (enum/status/category) that needs to be SEPARATED from the running text so the eye instantly recognizes "this is a LABEL," or is it just ONE WORD read inline in the sentence? Bound + needs separation ⇒ `chip`. Reads inline in the sentence, not a category ⇒ `accent`. | `SurfaceCard.tsx:1398` `CheckCircleIcon` accent (a "selected" signal, NOT framed) ↔ `PriceTag.tsx:141` `Chip tone="success"` (a promo label, framed, the enum "has a discount") |
| **`chip` ↔ `button`** | Does clicking trigger a **REAL ACTION** (not just opening more detail about the token itself), and is the rendered shape a **button shape**? Both true ⇒ `button`. Only opens a popover to SEE MORE about itself, shape is still a soft pill ⇒ `chip`. | `PriceTag` `−X%` chip wrapped in `Popover.Trigger` (still a `chip`, see TRAP #1) ↔ `ReactionButton.tsx:153` `HeroButton variant="tertiary"` (a real state change, shape is a button) |

Pairs 2 or more steps apart (`muted` ↔ `chip` · `accent` ↔ `button` · `muted` ↔ `button`): hesitating there is a sign the tree was drawn wrong, not that the wrong value was picked (cross-axis rule 3 in INDEX.md). Go back to §2.

---

## 4. STRUCTURAL TRAPS — the right step chosen, still wrong, because the structure was misread

1. **A chip wrapped in a clickable control does NOT auto-promote to `button`.**
   Real anchor: `PriceTag.tsx:64-65,113-114,136-138` — *"the `−X%` chip is ALWAYS a
   button that opens the popover,"* but *"the pressable/focusable button role lives
   on the canonical `Popover.Trigger` wrapper... so there is exactly ONE interactive
   element."* This axis asks WHAT SHAPE IS RENDERED, not "does it have an onClick" —
   the chip still renders through the `Chip` atom (a soft pill), it does not switch
   to the `Button` atom.
2. **Multiple highlight points, each LOCALLY correct, but the WHOLE REGION loses
   its "stands out" effect (accent-flood, §2c).** Real anchor (`CourseCard`
   2026-07-22): 3 green checkmarks + a green `−55%` chip + a pink CTA = 4-5
   highlight points at once inside one card — no single point picked the WRONG value
   (each one, standing alone, is at the right step), but the whole cluster is noisy
   enough that the eye can't answer "which of these is actually the standout here."
   Fix: dial some of them down to `muted`, keep only 1-2 highlight points. This trap
   cannot be fixed with the §2 tree (the tree only decides one spot at a time); you
   have to look at the WHOLE REGION.
3. **A left–right pair in a hierarchical row must be at DIFFERENT steps, not the
   same step (§2b).** A row with a real hierarchy (title ↔ meta, label ↔ value): the
   side that CARRIES THE SIGNAL is more prominent, the other side must sink — you may
   not make both `accent`, or both `default`, "to balance them out." The ONLY
   exception: a peer-row (genuinely equal rank, e.g. a nav row, a tag row) — there,
   matching steps is CORRECT.
4. **The same TYPE of fact must escalate via the TONE of ONE mechanism, not by
   changing MECHANISM between states (§2d, LOCKED).** Real anchor (`ContinueCard`
   2026-07-22): `timeLeft` is a `Chip` in EVERY scenario; when urgent, only the tone
   escalates `neutral → warning`, the chip stays a chip. Wrong: "40 minutes left"
   renders as `muted` text in the normal state but "2 minutes left" renders as a
   `chip` in the urgent state — the same info-type using 2 different MECHANISMS,
   forcing the user to relearn how to read it every time the state changes.
5. **A `showAnatomy`/status icon does not automatically "borrow" the prominence of
   the element next to it.** Real anchor (`SurfaceCard.tsx:1359-1363`): `leadingIcon`
   FOLLOWS the label's color by default (it doesn't automatically fall to `muted`) —
   UNLESS `leadingIconColor` is declared separately because that icon carries a
   state meaning (done/pass-fail). Structural misreading: assuming an icon is
   always `muted` "because it's just a secondary icon" — wrong, it follows the
   CONTEXT of whatever it's standing next to.
6. **LOCKED 2026-07-29: a chip accepts a STATE icon, forbids a DOMAIN icon.** See
   §1 for the full rule and the deciding test.

   Both sides were half-wrong, and that's the real lesson. The old canon
   (`principles.md` §2a) wrote "STRICT — Chip = TEXT-ONLY, no icon/logo" — wrong,
   because `ChipBase.tsx:109-130` has `icon` on equal footing with `dotColor`, and
   `Chip.stories.tsx:150-169` builds 4 canonical cases with icons. But reading the
   code and swinging to the opposite conclusion, "a chip accepts icons," is also
   wrong, because the code only says **it CAN accept one**, it doesn't say **what it
   SHOULD accept**.

   General lesson: **code answers CAN IT BE DONE, not SHOULD IT BE DONE.** A prop
   existing is not a rule of permission. The boundary here (state vs. domain) does
   not live in the type, cannot be grepped, and cannot be inferred from a story — it
   has to be decided by a person.
7. **The old canon got both the VALUE and the LOCATION of the chip typography rule
   wrong.** `principles.md` §2a declared "`text-xs font-normal`, overridden in
   `globals.css` (`.chip {...!important}`)." Reading the real code: `chip.css:3`
   (vendor HeroUI) is `text-xs leading-5 font-medium` — the size is CORRECT
   (`text-xs` = .75rem) but the WEIGHT is `font-medium` (500), not "normal" (400);
   and **no file** in `.storybook/**` or `src/app/globals.css` contains an
   overriding `.chip {...}` rule — both were grepped, neither was found. This rule
   was NEVER baked into the code, or it was reverted without the documentation
   being updated.

---

## 5. REAL ANCHORS — priority order when two sources conflict

1. **The real `src` of the exact component being examined**
   (`ChipBase.tsx`/`PriceTag.tsx`/`SurfaceCard.tsx`/`ReactionButton.tsx`) — read the
   code, don't trust a description.
2. **Semantic rules already LOCKED by the teacher** (§2c restraint "one highlight
   per region," §2d "keep the element consistent, escalate via tone") — this is a
   BUSINESS decision about how users read a region, and it wins over the tree
   whenever the tree and a semantic rule conflict (e.g. the tree says "a fixed token
   ⇒ chip" but the region already has 4 highlight points, so §2c wins and it gets
   dialed down to `muted`).
3. **The §2 decision tree** — the fallback when (1) doesn't exist and (2) doesn't
   apply.
4. **Old wording quoted in TRAPS #6/#7** (§4 of this document) — **use ONLY after
   re-verifying against (1)**, since 2 real drifts were caught in exactly those two
   traps. Do not copy the old wording verbatim without re-grepping the code.

Specific anchors for each branch: [`example.html`](example.html).
