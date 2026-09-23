import { COMMON_UI_RULE_IDS, defineGrammarRuleConformance } from "../common/index.js"

/**
 * Offset Pop's rule conformance against the canonical Common catalogue.
 *
 * A rule is FAMILY-owned only when `styles.css` makes a decision inside that rule's concern; the
 * evidence names the mechanism. Every other rule is inherited: the family declares nothing in its
 * concern, so Common's realization stands unchanged (Core inherits all 150 the same way).
 *
 * Inherited on purpose, although the family is close to them:
 * - PADDING, GAP, MARGIN, MEASURE, LAYOUT, FONT-1..5, FLOW-1/3/4/5: the family declares no inset,
 *   gap, margin, size, display or font-size; `conformance.spec.ts` locks that.
 * - ACCENT-3 / COLOR-3: the family uses one pink for the action fill and the focus ring, so
 *   distinctness rests on Common's carriers (fill, outline, soft pairing, underline), not on hue.
 * - BOUNDARY-3: rows claim it, and the family's trailing row edge (block-end border) currently doubles
 *   Common's adjacent-sibling seam; that known gap is an `it.fails` in `conformance.spec.ts`.
 *
 * Each claim below is proved in `conformance.spec.ts`, which cites the matching assertion in
 * `styles.spec.ts` or the render specs.
 */
export const OFFSET_POP_FAMILY_EVIDENCE = {
    "ACCENT-1": ["`--accent` binds the one pink `--offset-pop-accent`; no family rule paints a fill or text with it, so Common's primary action stays the only dominant accent."],
    "BOUNDARY-1": ["NavigationFeatureNav's band edge widens to `--offset-pop-outline-width` in `--border`, the same ink `--separator` resolves to in every theme and CanvasText under forced colours."],
    "BOUNDARY-4": ["Rail draws its inline-end column edge as the 2px `--offset-pop-outline-width` ink line in `--border`; Common draws none on Rail."],
    "BOUNDARY-5": ["Nested bounded surfaces, Button, Badge and StateMark draw a `--offset-pop-outline-width` (2px) solid `--border` ink outline in place of Common's 1px border."],
    "BOUNDARY-6": ["Family-owned departure: a `depth=\"top\"` surface keeps `--shadow-surface` (the hard `0.25rem 0.5rem 0 --offset-pop-shadow-ink` offset) AND the 2px ink outline, the outline-plus-offset signature; forced colours drop the shadow and keep only the outline."],
    "COLOR-5": ["Scoped light, `[data-grammar-theme=\"dark\"]`, `prefers-color-scheme` system and `forced-colors` token blocks; every text pair measures at least 4.5:1 and the focus ring at least 3:1 in light and dark."],
    "CONTROL-STATE-2": ["`[data-grammar-state=\"unavailable\"]` dims to .56 opacity, drops shadow and transform and shows `not-allowed`; `[data-grammar-state=\"pending\"]` only removes pointer events at full paint. Two hooks, never derived from each other."],
    "CORE-BOUNDARY-1": ["Every family edge lands on a hook a Common owner emits (surface, bounded card content, row, rail, feature nav, Button, Badge, StateMark); the family adds no wrapper shell."],
    "CORE-BOUNDARY-4": ["The top-surface shadow stays material, not stacking: `--shadow-surface` is the hard offset, nested and forced-colour surfaces have none, and the family sets no `z-index` or `position`."],
    "CORE-BOUNDARY-5": ["Unlike Core, the family adds one width query: below 40rem it only shortens the offset shadow and the surface radius, and every owner hook stays; state paint changes opacity, shadow and pointer only."],
    "CORE-SURFACE-2": ["Material (ink outline, radius, `--surface`, depth shadow) is painted on the bounded `[data-slot=\"card-content\"]` frame and `[data-grammar-surface]` shells; the HeroUI `[data-slot=\"card\"]` root is cleared to no border, no background and no shadow."],
    "FLOW-2": ["The display Heading wraps with `text-wrap: balance`; `overflow-wrap` stays Common's."],
    "FONT-6": ["The display Heading keeps Common's `text-4xl` size; the family sets weight 900, tracking -.045em and line-height .96, tighter than Common's `leading-tight`."],
    "FOCUS-1": ["`--focus` binds the pink ring (3.22:1 on canvas light, 5.42:1 dark, Highlight under forced colours); a focus-visible whole action also rings its painted frame (2px, 0.25rem offset) and a row rings on `:focus-within`."],
    "MOTION-1": ["The family's only movement, the press translate and shadow collapse on Button and whole-action surfaces, repeats an `:active` press Common already handles; no state or meaning rides on it."],
    "MOTION-2": ["`prefers-reduced-motion: reduce` zeroes `--offset-pop-motion-duration` and `--offset-pop-transition` and sets `transform: none` on Button, bounded frames, surfaces and rows; the press itself still reaches Common."],
    "MOTION-3": ["Every family transition reads `--offset-pop-transition`, built from the DNA's `--offset-pop-motion-duration` (140ms) and `--offset-pop-motion-easing`."],
    "OVERFLOW-2": ["A list that does not scroll is clipped (`overflow: clip`) to the surface radius minus the outline; a list that is the scroll region is excluded, so Common's OVERFLOW-3 `overflow-y: auto` stands."],
    "RESPONSIVE-1": ["Below 40rem only `--offset-pop-shadow-y` (0.5rem to 0.25rem) and `--offset-pop-surface-radius` (1.5rem to 1.25rem) change; no region, hook or content is removed."],
    "STATE-5": ["Surface press and focus treatments are keyed on `:has([data-grammar-whole-action]...)`, so a static surface never paints as pressable."],
    "SURFACE-1": ["The HeroUI card root stays no-surface around the painted frame (border 0, transparent, no shadow), and a frameless SurfaceCard carries no hook the family paints."],
    "SURFACE-2": ["Bounded frames and `[data-grammar-surface]` shells paint `--surface` with `--surface-foreground`, both bound to family tokens."],
    "SURFACE-3": ["A nested frame or shell paints `--surface-secondary`, drops the shadow, and keeps `--surface-foreground` (the same ink as `--foreground`)."],
    "SURFACE-4": ["`--accent-soft` binds the secondary surface and `--accent-soft-foreground` the text-safe `--offset-pop-accent-text` (5.09:1 light, 5.61:1 dark)."],
    "TONE-2": ["`Text tone=\"muted\"` reads `--muted` (#675f6c light, #c8bdca dark), at least 4.75:1 on every family surface."],
    "TONE-3": ["`Text tone=\"accent\"`, the SectionHeader eyebrow and the current tab label read `--offset-pop-accent-text`, never the fill pink."],
    "TRUTH-1": ["The inset state stripe is drawn only on rows whose state is not neutral (`:not([data-grammar-state=\"neutral\"])`); neutral rows stay unmarked."],
} as const satisfies Readonly<Record<string, ReadonlyArray<string>>>

export const offsetPopRuleConformance = defineGrammarRuleConformance({
    familyId: "offset-pop",
    inheritedCommonRules: COMMON_UI_RULE_IDS.filter((rule) => !(rule in OFFSET_POP_FAMILY_EVIDENCE)),
    familyEvidence: OFFSET_POP_FAMILY_EVIDENCE,
})
