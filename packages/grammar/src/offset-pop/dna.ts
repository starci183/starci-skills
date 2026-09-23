/**
 * Stable visual identity shipped by the Offset Pop Grammar family.
 *
 * Same shape as `STARCI_CORE_DNA`, key for key, plus two family groups: `offset` (the hard
 * offset shadow and ink outline that make the family recognisable) and `palette` (the named
 * inks the semantic colours are drawn from). This is presentation data, not a registry of UI
 * laws, and it is product-neutral. Every value equals the default in `./styles.css`; the
 * styles spec holds the two together.
 *
 * WCAG 2.x contrast, recorded here and asserted in `styles.spec.ts`:
 *
 * | pair                                   | light | dark  | need |
 * | -------------------------------------- | ----- | ----- | ---- |
 * | foreground on canvas                   | 16.86 | 17.47 | 4.5  |
 * | foreground on surface                  | 17.49 | 15.44 | 4.5  |
 * | foreground on surfaceSecondary         | 13.78 | 12.80 | 4.5  |
 * | muted on canvas                        |  5.81 | 10.16 | 4.5  |
 * | muted on surface                       |  6.03 |  8.98 | 4.5  |
 * | muted on surfaceSecondary              |  4.75 |  7.45 | 4.5  |
 * | accentForeground on accent             |  5.23 |  5.23 | 4.5  |
 * | successForeground on success           | 11.97 | 11.97 | 4.5  |
 * | warningForeground on warning           | 12.49 | 12.49 | 4.5  |
 * | dangerForeground on danger             |  4.72 |  4.72 | 4.5  |
 * | infoForeground on info                 | 13.50 | 13.50 | 4.5  |
 * | focus on canvas (non-text, 1.4.11)     |  3.22 |  5.42 | 3    |
 * | focus on surface (non-text, 1.4.11)    |  3.34 |  4.79 | 3    |
 * | accentText on canvas                   |  6.22 |  7.65 | 4.5  |
 * | accentText on surface                  |  6.45 |  6.76 | 4.5  |
 * | accentText on surfaceSecondary         |  5.09 |  5.61 | 4.5  |
 * | accentText on blush (palette/info)     |  4.98 |   -   | 4.5  |
 *
 * The accent foreground is the ink, not white: white on the family pink is 3.40:1, which fails
 * AA for button-size text. The same reasoning puts ink on the critical red (white is 3.77:1).
 * Pink as body-size TEXT on the light canvas is only 3.22:1, so `accent` stays the fill and the
 * focus ring and every place the accent paints text reads `accentText` instead: a deeper
 * raspberry in light, a lighter candy pink in dark. `accentText` and `accentSoft` (the selected
 * and soft tint, the blush secondary surface in light and the plum one in dark) mirror Core's
 * keys of the same names.
 */
export const OFFSET_POP_DNA = Object.freeze({
    id: "offset-pop",
    version: 1,
    color: Object.freeze({
        accent: "#ff3593",
        accentForeground: "#1c1524",
        focus: "#ff3593",
        light: Object.freeze({
            canvas: "#fff8ef",
            surface: "#fffdf9",
            surfaceSecondary: "#f8dbe8",
            foreground: "#1c1524",
            muted: "#675f6c",
            border: "#1c1524",
            separator: "#1c1524",
            success: "#91e4ca",
            successForeground: "#1c1524",
            warning: "#ffd447",
            warningForeground: "#1c1524",
            danger: "#e84a5f",
            dangerForeground: "#1c1524",
            info: "#f8d8e6",
            infoForeground: "#1c1524",
            accentText: "#b8005f",
            accentSoft: "#f8dbe8",
        }),
        dark: Object.freeze({
            canvas: "#17121d",
            surface: "#251d2c",
            surfaceSecondary: "#3b2936",
            foreground: "#fff8ef",
            muted: "#c8bdca",
            border: "#fff8ef",
            separator: "#fff8ef",
            success: "#91e4ca",
            successForeground: "#1c1524",
            warning: "#ffd447",
            warningForeground: "#1c1524",
            danger: "#e84a5f",
            dangerForeground: "#1c1524",
            info: "#f8d8e6",
            infoForeground: "#1c1524",
            accentText: "#ff7ab8",
            accentSoft: "#3b2936",
        }),
    }),
    geometry: Object.freeze({
        pageMeasure: "80rem",
        readingMeasure: "72ch",
        surfaceRadius: "1.5rem",
        controlRadius: "1rem",
        pillRadius: "999px",
    }),
    rhythm: Object.freeze({
        inlineGap: "0.5rem",
        rowGap: "0.75rem",
        sectionGap: "1rem",
        regionGap: "1.5rem",
        pageInset: "clamp(1rem, 3vw, 2rem)",
    }),
    elevation: Object.freeze({
        /** Composed from `offset`, so it follows the theme's shadow ink and the narrow-viewport drop. */
        surface: "var(--offset-pop-shadow-x) var(--offset-pop-shadow-y) 0 var(--offset-pop-shadow-ink)",
    }),
    motion: Object.freeze({
        duration: "140ms",
        easing: "cubic-bezier(.2, .8, .2, 1)",
    }),
    offset: Object.freeze({
        x: "0.25rem",
        y: "0.5rem",
        outlineWidth: "2px",
        ink: "#1c1524",
        shadowInk: "#1c1524",
        /** Dark ink is the outline and text colour (it flips to cream); the shadow stays near-black. */
        dark: Object.freeze({
            ink: "#fff8ef",
            shadowInk: "#050306",
        }),
    }),
    palette: Object.freeze({
        pink: "#ff3593",
        blush: "#f8d8e6",
        yellow: "#ffd447",
        mint: "#91e4ca",
        critical: "#e84a5f",
    }),
} as const)

/** Canonical 4px spacing scale; the same values as Common and Core, which the family does not re-space. */
export const OFFSET_POP_SPACING_SCALE = Object.freeze({
    "0": "0rem",
    "0.5": "0.125rem",
    "1": "0.25rem",
    "1.5": "0.375rem",
    "2": "0.5rem",
    "2.5": "0.625rem",
    "3": "0.75rem",
    "4": "1rem",
    "5": "1.25rem",
    "6": "1.5rem",
    "8": "2rem",
    "10": "2.5rem",
    "12": "3rem",
    "16": "4rem",
} as const)

export type OffsetPopSpacingStep = keyof typeof OFFSET_POP_SPACING_SCALE
export type OffsetPopSpacingValue = (typeof OFFSET_POP_SPACING_SCALE)[OffsetPopSpacingStep]

/** CSS custom-property contract for adapting Offset Pop without renaming its anatomy. */
export const OFFSET_POP_TOKEN_NAMES = Object.freeze({
    accent: "--offset-pop-accent",
    accentForeground: "--offset-pop-accent-foreground",
    focus: "--offset-pop-focus",
    canvas: "--offset-pop-canvas",
    surface: "--offset-pop-surface",
    surfaceSecondary: "--offset-pop-surface-secondary",
    foreground: "--offset-pop-foreground",
    muted: "--offset-pop-muted",
    border: "--offset-pop-border",
    separator: "--offset-pop-separator",
    success: "--offset-pop-success",
    successForeground: "--offset-pop-success-foreground",
    warning: "--offset-pop-warning",
    warningForeground: "--offset-pop-warning-foreground",
    danger: "--offset-pop-danger",
    dangerForeground: "--offset-pop-danger-foreground",
    info: "--offset-pop-info",
    infoForeground: "--offset-pop-info-foreground",
    accentText: "--offset-pop-accent-text",
    accentSoft: "--offset-pop-accent-soft",
    pageMeasure: "--offset-pop-page-measure",
    readingMeasure: "--offset-pop-reading-measure",
    surfaceRadius: "--offset-pop-surface-radius",
    controlRadius: "--offset-pop-control-radius",
    pillRadius: "--offset-pop-pill-radius",
    pageInset: "--offset-pop-page-inset",
    inlineGap: "--offset-pop-inline-gap",
    rowGap: "--offset-pop-row-gap",
    sectionGap: "--offset-pop-section-gap",
    regionGap: "--offset-pop-region-gap",
    elevation: "--offset-pop-surface-shadow",
    motionDuration: "--offset-pop-motion-duration",
    motionEasing: "--offset-pop-motion-easing",
    shadowX: "--offset-pop-shadow-x",
    shadowY: "--offset-pop-shadow-y",
    outlineWidth: "--offset-pop-outline-width",
    ink: "--offset-pop-ink",
    shadowInk: "--offset-pop-shadow-ink",
    pink: "--offset-pop-pink",
    blush: "--offset-pop-blush",
    yellow: "--offset-pop-yellow",
    mint: "--offset-pop-mint",
    critical: "--offset-pop-critical",
} as const)

/**
 * Sticky-band geometry published under an Offset Pop root.
 *
 * Common, not the family, publishes the band: `src/common/styles.css` defines these on every
 * `.grammar-common-root` that holds a sticky `NavigationFeatureNav` or `Subnav`, whatever its
 * family, and reads the two host overrides. So the names are Common's, shared with Core; the
 * family re-exports them so a consumer reads them from `@starci/grammar/offset-pop`. They are
 * not theme tokens and are absent from `OFFSET_POP_TOKEN_NAMES`; Offset Pop CSS never writes them.
 * See `STARCI_CORE_BAND_TOKEN_NAMES` for what each one means.
 */
export const OFFSET_POP_BAND_TOKEN_NAMES = Object.freeze({
    bandOffset: "--starci-core-band-offset",
    bandHeight: "--starci-core-band-height",
    bandSubnavHeight: "--starci-core-band-subnav-height",
    railOffset: "--starci-core-rail-offset",
    subnavOffset: "--starci-core-subnav-offset",
} as const)

export type OffsetPopBandTokenName = (typeof OFFSET_POP_BAND_TOKEN_NAMES)[keyof typeof OFFSET_POP_BAND_TOKEN_NAMES]

export type OffsetPopDna = typeof OFFSET_POP_DNA
export type OffsetPopTokenName = (typeof OFFSET_POP_TOKEN_NAMES)[keyof typeof OFFSET_POP_TOKEN_NAMES]

/** Portable light/default values keyed by the public CSS custom-property contract. */
export const OFFSET_POP_TOKEN_DEFAULTS = Object.freeze({
    "--offset-pop-accent": OFFSET_POP_DNA.color.accent,
    "--offset-pop-accent-foreground": OFFSET_POP_DNA.color.accentForeground,
    "--offset-pop-focus": OFFSET_POP_DNA.color.focus,
    "--offset-pop-canvas": OFFSET_POP_DNA.color.light.canvas,
    "--offset-pop-surface": OFFSET_POP_DNA.color.light.surface,
    "--offset-pop-surface-secondary": OFFSET_POP_DNA.color.light.surfaceSecondary,
    "--offset-pop-foreground": OFFSET_POP_DNA.color.light.foreground,
    "--offset-pop-muted": OFFSET_POP_DNA.color.light.muted,
    "--offset-pop-border": OFFSET_POP_DNA.color.light.border,
    "--offset-pop-separator": OFFSET_POP_DNA.color.light.separator,
    "--offset-pop-success": OFFSET_POP_DNA.color.light.success,
    "--offset-pop-success-foreground": OFFSET_POP_DNA.color.light.successForeground,
    "--offset-pop-warning": OFFSET_POP_DNA.color.light.warning,
    "--offset-pop-warning-foreground": OFFSET_POP_DNA.color.light.warningForeground,
    "--offset-pop-danger": OFFSET_POP_DNA.color.light.danger,
    "--offset-pop-danger-foreground": OFFSET_POP_DNA.color.light.dangerForeground,
    "--offset-pop-info": OFFSET_POP_DNA.color.light.info,
    "--offset-pop-info-foreground": OFFSET_POP_DNA.color.light.infoForeground,
    "--offset-pop-accent-text": OFFSET_POP_DNA.color.light.accentText,
    "--offset-pop-accent-soft": OFFSET_POP_DNA.color.light.accentSoft,
    "--offset-pop-page-measure": OFFSET_POP_DNA.geometry.pageMeasure,
    "--offset-pop-reading-measure": OFFSET_POP_DNA.geometry.readingMeasure,
    "--offset-pop-surface-radius": OFFSET_POP_DNA.geometry.surfaceRadius,
    "--offset-pop-control-radius": OFFSET_POP_DNA.geometry.controlRadius,
    "--offset-pop-pill-radius": OFFSET_POP_DNA.geometry.pillRadius,
    "--offset-pop-page-inset": OFFSET_POP_DNA.rhythm.pageInset,
    "--offset-pop-inline-gap": OFFSET_POP_DNA.rhythm.inlineGap,
    "--offset-pop-row-gap": OFFSET_POP_DNA.rhythm.rowGap,
    "--offset-pop-section-gap": OFFSET_POP_DNA.rhythm.sectionGap,
    "--offset-pop-region-gap": OFFSET_POP_DNA.rhythm.regionGap,
    "--offset-pop-surface-shadow": OFFSET_POP_DNA.elevation.surface,
    "--offset-pop-motion-duration": OFFSET_POP_DNA.motion.duration,
    "--offset-pop-motion-easing": OFFSET_POP_DNA.motion.easing,
    "--offset-pop-shadow-x": OFFSET_POP_DNA.offset.x,
    "--offset-pop-shadow-y": OFFSET_POP_DNA.offset.y,
    "--offset-pop-outline-width": OFFSET_POP_DNA.offset.outlineWidth,
    "--offset-pop-ink": OFFSET_POP_DNA.offset.ink,
    "--offset-pop-shadow-ink": OFFSET_POP_DNA.offset.shadowInk,
    "--offset-pop-pink": OFFSET_POP_DNA.palette.pink,
    "--offset-pop-blush": OFFSET_POP_DNA.palette.blush,
    "--offset-pop-yellow": OFFSET_POP_DNA.palette.yellow,
    "--offset-pop-mint": OFFSET_POP_DNA.palette.mint,
    "--offset-pop-critical": OFFSET_POP_DNA.palette.critical,
} satisfies Readonly<Record<OffsetPopTokenName, string>>)

/** Theme overrides layered on the default token set by `OffsetPopGrammarRoot` dark (and system-dark) mode. */
export const OFFSET_POP_DARK_TOKEN_DEFAULTS = Object.freeze({
    "--offset-pop-canvas": OFFSET_POP_DNA.color.dark.canvas,
    "--offset-pop-surface": OFFSET_POP_DNA.color.dark.surface,
    "--offset-pop-surface-secondary": OFFSET_POP_DNA.color.dark.surfaceSecondary,
    "--offset-pop-foreground": OFFSET_POP_DNA.color.dark.foreground,
    "--offset-pop-muted": OFFSET_POP_DNA.color.dark.muted,
    "--offset-pop-border": OFFSET_POP_DNA.color.dark.border,
    "--offset-pop-separator": OFFSET_POP_DNA.color.dark.separator,
    "--offset-pop-success": OFFSET_POP_DNA.color.dark.success,
    "--offset-pop-success-foreground": OFFSET_POP_DNA.color.dark.successForeground,
    "--offset-pop-warning": OFFSET_POP_DNA.color.dark.warning,
    "--offset-pop-warning-foreground": OFFSET_POP_DNA.color.dark.warningForeground,
    "--offset-pop-danger": OFFSET_POP_DNA.color.dark.danger,
    "--offset-pop-danger-foreground": OFFSET_POP_DNA.color.dark.dangerForeground,
    "--offset-pop-info": OFFSET_POP_DNA.color.dark.info,
    "--offset-pop-info-foreground": OFFSET_POP_DNA.color.dark.infoForeground,
    "--offset-pop-accent-text": OFFSET_POP_DNA.color.dark.accentText,
    "--offset-pop-accent-soft": OFFSET_POP_DNA.color.dark.accentSoft,
    "--offset-pop-ink": OFFSET_POP_DNA.offset.dark.ink,
    "--offset-pop-shadow-ink": OFFSET_POP_DNA.offset.dark.shadowInk,
} satisfies Readonly<Partial<Record<OffsetPopTokenName, string>>>)

export type OffsetPopTokenDefaults = typeof OFFSET_POP_TOKEN_DEFAULTS
