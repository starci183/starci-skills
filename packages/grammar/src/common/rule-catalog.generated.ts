/*
 * GENERATED FILE - do not edit by hand.
 *
 * Regenerate with `node scripts/generate-rule-catalog.mjs [knowledgeDir]` from the package root.
 * The source of truth is the knowledge tree's `ui/composition`, `ui/presentation`, `ui/proof`
 * and `grammars/starci` topic files; a family that publishes no `PREFIX-n` heading contributes
 * no rules and therefore does not appear here.
 *
 * 29 families, 150 rules.
 */

/** How many rule ids each family publishes. Reported for coverage summaries, never expanded. */
export const RULE_FAMILY_COUNTS = Object.freeze({
    "A11Y": 4, // ui/proof/accessibility.md
    "ACCENT": 5, // ui/composition/accent.md
    "ACTION": 4, // ui/composition/action.md
    "BOUNDARY": 6, // ui/presentation/boundary.md
    "COLOR": 2, // ui/proof/contrast.md
    "CONTROL-STATE": 4, // grammars/starci/control-state.md
    "CORE-BOUNDARY": 5, // grammars/starci/boundary.md
    "CORE-SURFACE": 5, // grammars/starci/surface.md
    "CTA": 5, // ui/composition/cta.md
    "FEEDBACK": 4, // ui/composition/feedback.md
    "FIELD": 4, // grammars/starci/field.md
    "FLOW": 5, // ui/presentation/text-flow.md
    "FOCUS": 5, // ui/proof/focus.md
    "FONT": 6, // ui/presentation/font.md
    "GAP": 7, // ui/presentation/gap.md
    "HIERARCHY": 5, // ui/composition/hierarchy.md
    "ICON": 6, // grammars/starci/icon.md
    "LAYOUT": 5, // ui/composition/layout.md
    "MARGIN": 7, // ui/presentation/margin.md
    "MEASURE": 7, // ui/presentation/measure.md
    "MEDIA": 6, // grammars/starci/media.md
    "MOTION": 4, // ui/proof/motion.md
    "OVERFLOW": 5, // ui/presentation/overflow.md
    "PADDING": 9, // ui/presentation/padding.md
    "RESPONSIVE": 5, // ui/composition/responsive.md
    "STATE": 7, // ui/composition/state.md
    "SURFACE": 6, // ui/presentation/surface.md
    "TONE": 3, // ui/presentation/tone.md
    "TRUTH": 4, // ui/proof/render-truth.md
} as const)

/**
 * Every canonical rule id, exactly as the tree spells it.
 *
 * The ids are listed rather than expanded from the counts above: the spacing families start at
 * `-0`, so a `1..count` expansion would both invent `PADDING-9` and lose `PADDING-0`.
 */
export const CANONICAL_RULE_IDS: ReadonlyArray<string> = Object.freeze([
    // A11Y
    "A11Y-1",
    "A11Y-2",
    "A11Y-3",
    "A11Y-4",
    // ACCENT
    "ACCENT-1",
    "ACCENT-2",
    "ACCENT-3",
    "ACCENT-4",
    "ACCENT-5",
    // ACTION
    "ACTION-1",
    "ACTION-2",
    "ACTION-3",
    "ACTION-4",
    // BOUNDARY
    "BOUNDARY-1",
    "BOUNDARY-2",
    "BOUNDARY-3",
    "BOUNDARY-4",
    "BOUNDARY-5",
    "BOUNDARY-6",
    // COLOR
    "COLOR-3",
    "COLOR-5",
    // CONTROL-STATE
    "CONTROL-STATE-1",
    "CONTROL-STATE-2",
    "CONTROL-STATE-3",
    "CONTROL-STATE-4",
    // CORE-BOUNDARY
    "CORE-BOUNDARY-1",
    "CORE-BOUNDARY-2",
    "CORE-BOUNDARY-3",
    "CORE-BOUNDARY-4",
    "CORE-BOUNDARY-5",
    // CORE-SURFACE
    "CORE-SURFACE-1",
    "CORE-SURFACE-2",
    "CORE-SURFACE-3",
    "CORE-SURFACE-4",
    "CORE-SURFACE-5",
    // CTA
    "CTA-1",
    "CTA-2",
    "CTA-3",
    "CTA-4",
    "CTA-5",
    // FEEDBACK
    "FEEDBACK-1",
    "FEEDBACK-2",
    "FEEDBACK-3",
    "FEEDBACK-4",
    // FIELD
    "FIELD-1",
    "FIELD-2",
    "FIELD-3",
    "FIELD-4",
    // FLOW
    "FLOW-1",
    "FLOW-2",
    "FLOW-3",
    "FLOW-4",
    "FLOW-5",
    // FOCUS
    "FOCUS-1",
    "FOCUS-2",
    "FOCUS-3",
    "FOCUS-4",
    "FOCUS-5",
    // FONT
    "FONT-1",
    "FONT-2",
    "FONT-3",
    "FONT-4",
    "FONT-5",
    "FONT-6",
    // GAP
    "GAP-0",
    "GAP-1",
    "GAP-2",
    "GAP-3",
    "GAP-4",
    "GAP-5",
    "GAP-6",
    // HIERARCHY
    "HIERARCHY-1",
    "HIERARCHY-2",
    "HIERARCHY-3",
    "HIERARCHY-4",
    "HIERARCHY-5",
    // ICON
    "ICON-1",
    "ICON-2",
    "ICON-3",
    "ICON-4",
    "ICON-5",
    "ICON-6",
    // LAYOUT
    "LAYOUT-1",
    "LAYOUT-2",
    "LAYOUT-3",
    "LAYOUT-4",
    "LAYOUT-5",
    // MARGIN
    "MARGIN-0",
    "MARGIN-1",
    "MARGIN-2",
    "MARGIN-3",
    "MARGIN-4",
    "MARGIN-5",
    "MARGIN-6",
    // MEASURE
    "MEASURE-1",
    "MEASURE-2",
    "MEASURE-3",
    "MEASURE-4",
    "MEASURE-5",
    "MEASURE-6",
    "MEASURE-7",
    // MEDIA
    "MEDIA-1",
    "MEDIA-2",
    "MEDIA-3",
    "MEDIA-4",
    "MEDIA-5",
    "MEDIA-6",
    // MOTION
    "MOTION-1",
    "MOTION-2",
    "MOTION-3",
    "MOTION-4",
    // OVERFLOW
    "OVERFLOW-1",
    "OVERFLOW-2",
    "OVERFLOW-3",
    "OVERFLOW-4",
    "OVERFLOW-5",
    // PADDING
    "PADDING-0",
    "PADDING-1",
    "PADDING-2",
    "PADDING-3",
    "PADDING-4",
    "PADDING-5",
    "PADDING-6",
    "PADDING-7",
    "PADDING-8",
    // RESPONSIVE
    "RESPONSIVE-1",
    "RESPONSIVE-2",
    "RESPONSIVE-3",
    "RESPONSIVE-4",
    "RESPONSIVE-5",
    // STATE
    "STATE-1",
    "STATE-2",
    "STATE-3",
    "STATE-4",
    "STATE-5",
    "STATE-6",
    "STATE-7",
    // SURFACE
    "SURFACE-1",
    "SURFACE-2",
    "SURFACE-3",
    "SURFACE-4",
    "SURFACE-5",
    "SURFACE-6",
    // TONE
    "TONE-1",
    "TONE-2",
    "TONE-3",
    // TRUTH
    "TRUTH-1",
    "TRUTH-2",
    "TRUTH-3",
    "TRUTH-4",
])
