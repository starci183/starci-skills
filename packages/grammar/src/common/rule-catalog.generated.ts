/*
 * GENERATED FILE - do not edit by hand.
 * Regenerate with node packages/grammar/scripts/generate-rule-catalog.mjs [knowledgeDir].
 * Canonical declarations are rules[].id in the YAML knowledge topics.
 * References, scale rows, cases and closed addresses contribute no additional rules.
 * 32 families, 170 rules.
 */

/** The number of declared rule ids in each family, never expanded into addresses. */
export const RULE_FAMILY_COUNTS = Object.freeze({
    "A11Y": 5, // ui/proof/accessibility.yaml
    "ACCENT": 6, // ui/composition/accent.yaml
    "ACTION": 3, // ui/composition/action.yaml
    "ANATOMY": 5, // ui/proof/anatomy-source.yaml
    "BOUNDARY": 6, // ui/presentation/boundary.yaml
    "BRAND": 3, // ui/proof/brand.yaml
    "COLLECTION": 2, // ui/composition/collection.yaml
    "COLOR": 2, // ui/proof/contrast.yaml
    "CONTRAST": 1, // ui/proof/contrast.yaml
    "COVERAGE": 1, // ui/composition/coverage.yaml
    "CTA": 5, // ui/composition/cta.yaml
    "DISCIPLINE": 3, // ui/composition/taste.yaml
    "FEEDBACK": 3, // ui/composition/feedback.yaml
    "FLOW": 5, // ui/presentation/text-flow.yaml
    "FOCUS": 6, // ui/proof/focus.yaml
    "FONT": 6, // ui/presentation/font.yaml
    "GAP": 7, // ui/presentation/gap.yaml
    "HIERARCHY": 6, // ui/composition/hierarchy.yaml
    "LAYOUT": 4, // ui/composition/layout.yaml
    "MARGIN": 8, // ui/presentation/margin.yaml
    "MEASURE": 7, // ui/presentation/measure.yaml
    "MOTION": 5, // ui/proof/motion.yaml
    "OVERFLOW": 5, // ui/presentation/overflow.yaml
    "PADDING": 10, // ui/presentation/padding.yaml
    "RADIUS": 6, // ui/presentation/radius.yaml
    "RESPONSIVE": 4, // ui/composition/responsive.yaml
    "STATE": 7, // ui/composition/state.yaml
    "SURFACE": 6, // ui/presentation/surface.yaml
    "TASTE": 13, // ui/proof/taste.yaml
    "TONE": 3, // ui/presentation/tone.yaml
    "TRUTH": 5, // ui/proof/render-truth.yaml
    "UX": 12, // ui/proof/ux.yaml
} as const)

/** Every declared canonical rule id, preserving each topic's authored order. */
export const CANONICAL_RULE_IDS: ReadonlyArray<string> = Object.freeze([
    // A11Y
    "A11Y-1",
    "A11Y-2",
    "A11Y-3",
    "A11Y-4",
    "A11Y-5",
    // ACCENT
    "ACCENT-1",
    "ACCENT-2",
    "ACCENT-3",
    "ACCENT-4",
    "ACCENT-5",
    "ACCENT-6",
    // ACTION
    "ACTION-1",
    "ACTION-2",
    "ACTION-3",
    // ANATOMY
    "ANATOMY-1",
    "ANATOMY-2",
    "ANATOMY-3",
    "ANATOMY-4",
    "ANATOMY-5",
    // BOUNDARY
    "BOUNDARY-1",
    "BOUNDARY-2",
    "BOUNDARY-3",
    "BOUNDARY-4",
    "BOUNDARY-5",
    "BOUNDARY-6",
    // BRAND
    "BRAND-1",
    "BRAND-2",
    "BRAND-3",
    // COLLECTION
    "COLLECTION-1",
    "COLLECTION-2",
    // COLOR
    "COLOR-3",
    "COLOR-5",
    // CONTRAST
    "CONTRAST-1",
    // COVERAGE
    "COVERAGE-1",
    // CTA
    "CTA-1",
    "CTA-2",
    "CTA-3",
    "CTA-4",
    "CTA-5",
    // DISCIPLINE
    "DISCIPLINE-1",
    "DISCIPLINE-2",
    "DISCIPLINE-3",
    // FEEDBACK
    "FEEDBACK-1",
    "FEEDBACK-2",
    "FEEDBACK-3",
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
    "FOCUS-6",
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
    "HIERARCHY-6",
    // LAYOUT
    "LAYOUT-1",
    "LAYOUT-2",
    "LAYOUT-3",
    "LAYOUT-4",
    // MARGIN
    "MARGIN-0",
    "MARGIN-1",
    "MARGIN-2",
    "MARGIN-3",
    "MARGIN-4",
    "MARGIN-5",
    "MARGIN-6",
    "MARGIN-AUTO",
    // MEASURE
    "MEASURE-1",
    "MEASURE-2",
    "MEASURE-3",
    "MEASURE-4",
    "MEASURE-5",
    "MEASURE-6",
    "MEASURE-7",
    // MOTION
    "MOTION-1",
    "MOTION-2",
    "MOTION-3",
    "MOTION-4",
    "MOTION-5",
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
    "PADDING-9",
    // RADIUS
    "RADIUS-2",
    "RADIUS-4",
    "RADIUS-5",
    "RADIUS-6",
    "RADIUS-7",
    "RADIUS-9",
    // RESPONSIVE
    "RESPONSIVE-1",
    "RESPONSIVE-2",
    "RESPONSIVE-3",
    "RESPONSIVE-4",
    // STATE
    "STATE-1",
    "STATE-2",
    "STATE-3",
    "STATE-5",
    "STATE-6",
    "STATE-7",
    "STATE-8",
    // SURFACE
    "SURFACE-1",
    "SURFACE-2",
    "SURFACE-3",
    "SURFACE-4",
    "SURFACE-5",
    "SURFACE-6",
    // TASTE
    "TASTE-1",
    "TASTE-2",
    "TASTE-3",
    "TASTE-4",
    "TASTE-5",
    "TASTE-6",
    "TASTE-7",
    "TASTE-8",
    "TASTE-9",
    "TASTE-10",
    "TASTE-11",
    "TASTE-12",
    "TASTE-13",
    // TONE
    "TONE-1",
    "TONE-2",
    "TONE-3",
    // TRUTH
    "TRUTH-1",
    "TRUTH-2",
    "TRUTH-3",
    "TRUTH-4",
    "TRUTH-5",
    // UX
    "UX-1",
    "UX-2",
    "UX-3",
    "UX-4",
    "UX-5",
    "UX-6",
    "UX-7",
    "UX-8",
    "UX-9",
    "UX-10",
    "UX-11",
    "UX-12",
])
