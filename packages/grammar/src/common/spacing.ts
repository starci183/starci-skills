/** Universal spacing vocabulary consumed by every visual family. */
export const COMMON_SPACING_SCALE = Object.freeze({
    0: "0",
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    6: "1.5rem",
    8: "2rem",
} as const)

export type CommonSpacingStep = keyof typeof COMMON_SPACING_SCALE
export type CommonSpacingValue = (typeof COMMON_SPACING_SCALE)[CommonSpacingStep]

export const COMMON_SPACING_TOKENS = Object.freeze({
    inline: "--grammar-inline-gap",
    row: "--grammar-row-gap",
    section: "--grammar-section-gap",
    region: "--grammar-region-gap",
    pageInset: "--grammar-page-inset",
} as const)
