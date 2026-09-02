> Awaiting relocation into knowledge/grammars/<family>/. This file describes Grammar component
> mechanics, not an application decision. It has no successor under composition, presentation, or
> proof. Do not load it as runtime authority.

# Icon

`ui.icon` owns reusable icon roles, measured boxes, placement, motion limits, and accessible identity.
Classify findings with the [canonical verdict model](INDEX.md#canonical-verdict-model). Keep semantic
glyph mapping, Common role source, runtime computed box, final pixels, and accessibility output as
separate evidence. Common owns role geometry and behavior; a family may change paint but not metrics
or meaning. The application owns product meaning, reviewed glyph source, visible labels, state truth,
page canvas, and placement.

## ICON-1 — Source priority and measured roles

### When

A semantic meaning benefits from a standalone icon or an icon paired with text. Decoration with no
meaning still needs a role box but no accessible name.

### Apply

- Resolve product meaning once through the application's reviewed glyph registry, then pass the real Common `Icon source`.
- Use closed roles `heading`, `leading`, and `chip`; at a 16 px root their nominal boxes are 24×24, 20×20, and 16×16 CSS px.
- Prove registry mapping, role prop, computed width/height, peer alignment, and named-versus-hidden accessibility output separately.
- Families may recolor the glyph; applications may choose and place it but may not import vendor icons into reusable anatomy or size SVGs locally.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A labelled workspace row uses a decorative `Icon role="leading"` computed at 20×20 px. | `PASS` | The text owns identity and Common owns the stable box. |
| An app imports a Heroicon and adds `size-5` beside a reusable row. | `APP_REIMPLEMENTATION` · `VENDOR_LEAK` | Route the meaning through the reviewed registry and Common `Icon`. |
| Equal peers compute mixed 16 px and 20 px icon boxes. | `APP_OVERRIDE` · `VALUE_DRIFT` | Select one shared role and remove local sizing. |

## ICON-2 — Compact chip and explicit status

### When

A compact attribute or verified state benefits from a glyph beside short text. A heading, decorative
dot, or unresolved state does not qualify.

### Apply

- Use Common `Badge` with visible words and Common `Icon role="chip"` in its public `startContent`.
- Keep the chip icon at the 16×16 nominal role and select a `Badge` tone that matches verified state.
- Prove explicit text, tone, glyph shape, computed box, and one accessible status identity; remove color and confirm meaning remains.
- Families may repaint badge/icon; applications own the state words and glyph source, not chip anatomy.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| “Healthy” uses a success `Badge` with a 16 px chip icon and visible text. | `PASS` | Word, tone, and glyph support the same verified state. |
| A green check icon appears alone for success. | `APP_REIMPLEMENTATION` · `WRONG_OWNER` | Add explicit state text through Common `Badge`; glyph/color are insufficient. |
| Pending data is shown with a success chip before resolution. | `APP_OVERRIDE` · `STATE_OR_VIEWPORT_DRIFT` | Keep wording/tone neutral or pending until evidence exists. |

## ICON-3 — Every tab keeps icon and label identity

### When

Peer destinations use an icon-led Common tab set. A text-only tab design chosen consistently for all
peers is a different pattern, not permission to mix identities.

### Apply

- Give every Common `Tabs` item a stable `label` and a `leading` Common `Icon role="leading"`; use `labelVisibility="responsive|always"` deliberately.
- Preserve the 20×20 nominal leading box, accessible tab name, and Common's non-color 2 px selected indicator.
- Prove icon/label presence for every peer, equal computed boxes, compact/wide output, and selected/focus states.
- `TabItem.leading` is currently optional, so reusable enforcement is a Common capability gap; families may paint but applications must not hide unfamiliar identity.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| Every profile tab has a 20 px leading icon, stable label, and selected indicator. | `PASS` | Peer identity and selection remain consistent. |
| A reusable icon-led tab contract must prevent one missing icon. | `COMMON_CAPABILITY_MISSING` | `leading` is optional today; make the required pattern representable in Common. |
| Compact CSS hides labels while one tab has no recognizable icon. | `APP_OVERRIDE` · `STATE_OR_VIEWPORT_DRIFT` | Keep labels visible or supply the complete Common identity before compacting. |
| A family removes the selected indicator and keeps only accent text. | `FAMILY_OVERRIDE_GLITCH` · `WRONG_OWNER` | Restore the inherited non-color selection anatomy. |

## ICON-4 — Directional action arrow

### When

A labelled action moves forward/next/continue or returns to a previous context. Identity marks and
physical-direction symbols do not mirror merely because text direction changes.

### Apply

- Put an app-selected arrow source in Common `Icon role="chip"`; use `endContent` for forward and `startContent` for back on Common actions.
- Keep the arrow nominally 16×16 px; logical navigation may mirror, while physical direction and brand identity stay literal.
- If motion is used, prove only the arrow translates, the action outer box stays fixed, and reduced motion computes to exactly 0 px translation.
- Common exposes content slots but no arrow-motion anchor; requested reusable arrow motion is a capability gap, while a static arrow can pass.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| “Continue” has a static 16 px arrow in `endContent`; pending removes the adornment. | `PASS` | Direction supports a labelled Common action and state remains truthful. |
| A family wants a moving arrow but Common has no motion wrapper/anchor. | `COMMON_CAPABILITY_MISSING` | Add a reusable Common motion owner before animation. |
| App CSS moves the whole button 4 px on hover. | `APP_OVERRIDE` · `WRONG_OWNER` | The target and label must stay fixed; remove the local choreography. |
| Reduced-motion mode still translates the arrow 2 px. | `FAMILY_OVERRIDE_GLITCH` · `STATE_OR_VIEWPORT_DRIFT` | Set computed translation to 0 and retest. |

## ICON-5 — Utility icon-only action

### When

A universally familiar utility remains clear without a persistent text label. A primary decision or
unfamiliar product command must stay text-labelled.

### Apply

- Use Common `IconButton`; its required `label` owns the accessible name and its Common `Icon role="leading"` owns the glyph box.
- Require a computed target of at least 24×24 CSS px where WCAG 2.2 target size applies; prefer 44×44 px for coarse-pointer quality.
- Compose Common `Tooltip` with resolved words when recognition is uncertain; prove keyboard/pointer reveal without replacing the accessible name.
- Families may repaint the control; applications choose label, glyph, handler, and placement without rebuilding the circular button.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A close utility uses `IconButton` with label “Close” and a 40×40 px computed target. | `PASS` | The action is named and clears the normative target floor. |
| An icon-only primary “Submit” action has no visible words. | `APP_OVERRIDE` · `WRONG_OWNER` | Primary decisions stay text-labelled; use Common `Button`. |
| An unfamiliar utility has an accessible name but no visible explanation on focus. | `PROOF_MISSING` | Add/verify a Common `Tooltip` when the audience cannot reliably recognize it. |
| App builds a circular button around Common `Icon`. | `APP_REIMPLEMENTATION` | Common `IconButton` already owns control semantics and geometry. |

## ICON-6 — Accessibility, fallback, and state truth

### When

An icon is meaningful alone, accompanies named content, is decorative or loading, fails source
resolution, or changes with product state.

### Apply

- Give standalone meaningful Common `Icon` one concise `ariaLabel`; omit it beside equivalent visible text so Common emits `aria-hidden`.
- Keep decorative and skeleton icons silent; pair state glyphs with explicit words and verified state.
- Prove exact accessibility names, no duplicate announcements, stable computed box, forced-color visibility, and honest fallback identity.
- The application registry may choose an approved fallback glyph or visible text; if reusable failure behavior needs more than `source`, record a Common capability gap.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A standalone warning icon has `ariaLabel="Warning"` and stable role geometry. | `PASS` | The icon itself owns one concise identity. |
| A labelled row's companion icon repeats the same accessible name. | `APP_OVERRIDE` · `DOUBLE_OWNER` | Omit `ariaLabel` so Common hides the decorative companion. |
| A missing registry mapping collapses the icon slot. | `PROOF_MISSING` · `STATE_OR_VIEWPORT_DRIFT` | Supply an approved registry fallback or visible text and remeasure. |
| A reusable source-error state is required but Common only accepts `source`. | `COMMON_CAPABILITY_MISSING` | Add a typed fallback/state contract instead of app error CSS. |
| A status glyph changes to success while the visible word still says pending. | `APP_OVERRIDE` · `VALUE_DRIFT` | Keep glyph, word, and verified state synchronized. |
