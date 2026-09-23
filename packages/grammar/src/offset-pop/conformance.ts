import { COMMON_UI_RULE_IDS, defineGrammarRuleConformance } from "../common/index.js"

/**
 * Offset Pop's rule conformance against the canonical Common catalogue.
 *
 * The family's CSS is `styles.css` plus the three component sheets it imports
 * (`components-forms.css`, `components-overlays.css`, `components-navigation.css`). A rule is
 * FAMILY-owned only when that CSS makes a decision inside the rule's concern; the evidence names the
 * mechanism. Every other rule is inherited: the family declares nothing in its concern, so Common's
 * realization stands unchanged (Core inherits all 150 the same way).
 *
 * Inherited on purpose, although the family is close to them:
 * - The spacing and size rules not listed below: the family's only geometry is the short allow-list
 *   `conformance.spec.ts` locks, each entry owned by a claim here.
 * - ACCENT-3 / COLOR-3: one pink fills the decision action, marks the selected or current state and
 *   draws the focus ring, so distinctness rests on Common's carriers (fill on an action, fill inside a
 *   control, outline, soft pairing, underline), not on hue.
 * - BOUNDARY-3: rows claim it, and the seam stays Common's one line between consecutive rows; the family
 *   only repaints that same edge in its 2px outline material (BOUNDARY-5) and adds no edge of its own.
 *
 * Each claim below is proved in `conformance.spec.ts`, which cites the matching assertion in
 * `styles.spec.ts`, the component `components-*.spec.ts` files or the render specs.
 */
export const OFFSET_POP_FAMILY_EVIDENCE = {
    "ACCENT-1": ["`--accent` binds the one pink. The family fills with it only the decision it marks: the dialog confirm, toast and alert action (the single action in each), a checked, selected or current state inside a control, and a real measurement (slider, meter, rating, spinner); it never paints text with it."],
    "BOUNDARY-1": ["Band edges are the ink line at `--offset-pop-outline-width`: NavigationFeatureNav and TopBar below, Footer and BottomNav above; `--border` and `--separator` resolve to the same ink in every theme and CanvasText under forced colours."],
    "BOUNDARY-4": ["Rail draws its inline-end column edge as the 2px `--offset-pop-outline-width` ink line in `--border`; Common draws none on Rail."],
    "BOUNDARY-5": ["Objects carry a `--offset-pop-outline-width` (2px) solid ink outline in place of Common's 1px: nested surfaces, Button, Badge, StateMark, field and choice controls, overlay surfaces, DataTable, Calendar, Avatar, tags and pagination; grouped Buttons overlap by one outline width so a shared edge draws once, and a row seam is Common's one between-rows edge repainted at the outline width (never a second edge)."],
    "BOUNDARY-6": ["Family-owned departure: a `depth=\"top\"` surface keeps `--shadow-surface` (the hard `0.25rem 0.5rem 0 --offset-pop-shadow-ink` offset) AND the 2px ink outline, the outline-plus-offset signature (overlay surfaces, DataTable and Calendar do the same); forced colours drop the shadow and keep only the outline."],
    "COLOR-5": ["Scoped light, `[data-grammar-theme=\"dark\"]`, `prefers-color-scheme` system and `forced-colors` token blocks, and every component sheet resets its edges, shadows and selected fills to system colours; every text pair measures at least 4.5:1 and the focus ring at least 3:1 in light and dark, error text included (critical mixed 65% with the ink)."],
    "CONTROL-STATE-2": ["`[data-grammar-state=\"unavailable\"]` reads in the muted ink (AA, unavailable is not disabled), drops shadow and transform and shows `not-allowed`; `[data-grammar-state=\"pending\"]` only removes pointer events at full paint. Two hooks, never derived from each other."],
    "CORE-BOUNDARY-1": ["Every family edge lands on a hook a Common owner emits (`data-component`, `data-grammar-*`, the HeroUI slot, or the vendor's own state attribute); the family adds no wrapper shell."],
    "CORE-BOUNDARY-4": ["Shadows stay material, not stacking: `--shadow-surface` and the overlay, drawer and chip offsets are hard ink copies of the outline, nested and forced-colour surfaces have none, and the family sets no `z-index` or `position`."],
    "CORE-BOUNDARY-5": ["Unlike Core, the family adds width queries, and they change shadow geometry only: below 40rem the offset shadow and the surface radius shorten, below 30rem DataTable and Calendar take a smaller hard shadow; every owner hook stays. State paint changes text colour, shadow and pointer only."],
    "CORE-SURFACE-2": ["Material (ink outline, radius, `--surface`, depth shadow) is painted on the bounded `[data-slot=\"card-content\"]` frame and `[data-grammar-surface]` shells; the HeroUI `[data-slot=\"card\"]` root is cleared to no edge, no background and no shadow."],
    "FLOW-2": ["The display Heading wraps with `text-wrap: balance`; `overflow-wrap` stays Common's."],
    "FONT-6": ["The display Heading keeps Common's `text-4xl` size; the family sets weight 900, tracking -.045em and line-height .96, tighter than Common's `leading-tight`."],
    "FOCUS-1": ["`--focus` binds the pink ring (3.22:1 on canvas light, 5.42:1 dark, Highlight under forced colours). It rings a focus-visible whole action's painted frame, a choice control and a slider thumb (2px, 0.25rem offset), and a keyboard-focused ListBox or Select/ComboBox option (2px on the row edge, offset 0, so the list's clip never cuts it); a field shows focus as the hard offset shadow over a transparent 2px outline that forced colours turn into a Highlight ring."],
    "GAP-4": ["Stacked toasts are spaced by `--offset-pop-shadow-y` + 0.5rem (1rem, and .75rem below 40rem) so each hard shadow clears the next toast."],
    "MARGIN-2": ["Accordion items are separated by `margin-block-start: var(--grammar-inline-gap)` (.5rem) because each item is its own outlined box."],
    "MEASURE-5": ["BottomNav items keep a 4rem minimum block size and their icon pill 3.25rem by 2rem, a thumb-sized target; the family also fixes the Meter track at .75rem and the Timeline rail at the outline width."],
    "MOTION-1": ["The family's only movement is press travel: a translate plus shadow collapse keyed on `:active` or the vendor's `data-pressed` / `data-dragging`, repeating a press Common already handles; no state or meaning rides on it."],
    "MOTION-2": ["`prefers-reduced-motion: reduce` zeroes `--offset-pop-motion-duration` and `--offset-pop-transition`, and every sheet that moves something sets its `transform` or `translate` to none (navigation zeroes its disclosure and dock transitions); the press itself still reaches Common."],
    "MOTION-3": ["Every family transition reads `--offset-pop-transition`, built from the DNA's `--offset-pop-motion-duration` (140ms) and `--offset-pop-motion-easing`."],
    "OVERFLOW-2": ["The family clips (`overflow: clip`) only non-scrolling shells to their radius: a list that is not the scroll region, the DataTable sheet (its rows scroll in the inner table scroll container) and the SegmentedControl unit; a list that is the scroll region keeps Common's OVERFLOW-3 `overflow-y: auto`."],
    "PADDING-2": ["The current Breadcrumb becomes an outlined pill with a .5rem inline inset."],
    "PADDING-3": ["The Calendar becomes an outlined sheet with a .75rem inset."],
    "PADDING-4": ["Disclosure and Accordion triggers take a 1rem inline inset inside their outlined box."],
    "RESPONSIVE-1": ["Narrow widths change only family shadow geometry: below 40rem `--offset-pop-shadow-y` (0.5rem to 0.25rem) and `--offset-pop-surface-radius` (1.5rem to 1.25rem), below 30rem the DataTable and Calendar shadow; no region, hook or content is removed."],
    "STATE-5": ["Surface press and focus treatments are keyed on `:has([data-grammar-whole-action]...)`, so a static surface never paints as pressable."],
    "SURFACE-1": ["The HeroUI card root stays no-surface around the painted frame (no edge, transparent, no shadow), and a frameless SurfaceCard carries no hook the family paints."],
    "SURFACE-2": ["Bounded frames and `[data-grammar-surface]` shells paint `--surface` with `--surface-foreground`, both bound to family tokens."],
    "SURFACE-3": ["A nested frame or shell paints `--surface-secondary`, drops the shadow, and keeps `--surface-foreground` (the same ink as `--foreground`)."],
    "SURFACE-4": ["`--accent-soft` binds the secondary surface and `--accent-soft-foreground` the text-safe `--offset-pop-accent-text` (5.09:1 light, 5.61:1 dark)."],
    "TONE-2": ["`Text tone=\"muted\"` reads `--muted` (#675f6c light, #c8bdca dark), at least 4.75:1 on every family surface."],
    "TONE-3": ["`Text tone=\"accent\"`, the SectionHeader eyebrow, the current tab label, a selected menu item and a selected ListBox option, Select/ComboBox option or DataTable row (on the `--accent-soft` fill) read `--offset-pop-accent-text`, never the fill pink."],
    "TRUTH-1": ["The inset state stripe is drawn only on rows whose state is not neutral (`:not([data-grammar-state=\"neutral\"])`), and toast and meter tones map each named outcome to its own semantic colour; no neutral tone is painted as success or danger."],
} as const satisfies Readonly<Record<string, ReadonlyArray<string>>>

export const offsetPopRuleConformance = defineGrammarRuleConformance({
    familyId: "offset-pop",
    inheritedCommonRules: COMMON_UI_RULE_IDS.filter((rule) => !(rule in OFFSET_POP_FAMILY_EVIDENCE)),
    familyEvidence: OFFSET_POP_FAMILY_EVIDENCE,
})
