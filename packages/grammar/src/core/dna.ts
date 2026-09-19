/**
 * Stable visual identity shipped by Core Grammar.
 *
 * This is presentation data, not a registry of UI laws. Product rules remain
 * outside the package; consumers use these values to render the same StarCi
 * family without rebuilding its palette, geometry or motion from memory.
 */
export const STARCI_CORE_DNA = Object.freeze({
    id: "starci-core",
    version: 1,
    color: Object.freeze({
        accent: "#7547ff",
        accentForeground: "oklch(100% 0 0)",
        focus: "#7248ff",
        light: Object.freeze({
            canvas: "oklch(97.02% 0.0015 354.13)",
            surface: "oklch(100% 0.0008 354.13)",
            surfaceSecondary: "oklch(95.24% 0.0012 354.13)",
            foreground: "oklch(21.03% 0.0015 354.13)",
            muted: "oklch(55.17% 0.003 354.13)",
            border: "oklch(90% 0.0015 354.13)",
            separator: "oklch(92% 0.0015 354.13)",
            success: "oklch(73.29% 0.1941 162.85)",
            successForeground: "oklch(21.03% 0.0059 162.85)",
            warning: "oklch(78.19% 0.159 84.37)",
            warningForeground: "oklch(21.03% 0.0059 84.37)",
            danger: "oklch(65.32% 0.2335 37.78)",
            dangerForeground: "oklch(99.11% 0 0)",
            info: "oklch(72% 0.17 250)",
            infoForeground: "oklch(21.03% 0.0059 250)",
        }),
        dark: Object.freeze({
            canvas: "oklch(12% 0.0015 354.13)",
            surface: "oklch(21.03% 0.003 354.13)",
            surfaceSecondary: "oklch(25.7% 0.0023 354.13)",
            foreground: "oklch(99.11% 0.0015 354.13)",
            muted: "oklch(70.5% 0.003 354.13)",
            border: "oklch(28% 0.0015 354.13)",
            separator: "oklch(25% 0.0015 354.13)",
            success: "oklch(73.29% 0.1941 162.85)",
            successForeground: "oklch(21.03% 0.0059 162.85)",
            warning: "oklch(82.03% 0.1392 88.38)",
            warningForeground: "oklch(21.03% 0.0059 88.38)",
            danger: "oklch(59.4% 0.1973 36.67)",
            dangerForeground: "oklch(99.11% 0 0)",
            info: "oklch(72% 0.17 250)",
            infoForeground: "oklch(21.03% 0.0059 250)",
        }),
    }),
    geometry: Object.freeze({
        pageMeasure: "80rem",
        readingMeasure: "72ch",
        surfaceRadius: "1rem",
        controlRadius: "0.75rem",
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
        surface: "0 8px 28px oklch(21.03% 0.0059 354.13 / 0.07)",
    }),
    motion: Object.freeze({
        duration: "180ms",
        easing: "cubic-bezier(0.2, 0, 0, 1)",
    }),
} as const)

/** Canonical 4px spacing scale shared by Core components and host composition. */
export const STARCI_CORE_SPACING_SCALE = Object.freeze({
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

export type StarCiCoreSpacingStep = keyof typeof STARCI_CORE_SPACING_SCALE
export type StarCiCoreSpacingValue = (typeof STARCI_CORE_SPACING_SCALE)[StarCiCoreSpacingStep]

/** CSS custom-property contract for adapting Core without renaming its anatomy. */
export const STARCI_CORE_TOKEN_NAMES = Object.freeze({
    accent: "--starci-core-accent",
    accentForeground: "--starci-core-accent-foreground",
    focus: "--starci-core-focus",
    canvas: "--starci-core-canvas",
    surface: "--starci-core-surface",
    surfaceSecondary: "--starci-core-surface-secondary",
    foreground: "--starci-core-foreground",
    muted: "--starci-core-muted",
    border: "--starci-core-border",
    separator: "--starci-core-separator",
    success: "--starci-core-success",
    successForeground: "--starci-core-success-foreground",
    warning: "--starci-core-warning",
    warningForeground: "--starci-core-warning-foreground",
    danger: "--starci-core-danger",
    dangerForeground: "--starci-core-danger-foreground",
    info: "--starci-core-info",
    infoForeground: "--starci-core-info-foreground",
    pageMeasure: "--starci-core-page-measure",
    readingMeasure: "--starci-core-reading-measure",
    surfaceRadius: "--starci-core-surface-radius",
    controlRadius: "--starci-core-control-radius",
    pillRadius: "--starci-core-pill-radius",
    pageInset: "--starci-core-page-inset",
    inlineGap: "--starci-core-inline-gap",
    rowGap: "--starci-core-row-gap",
    sectionGap: "--starci-core-section-gap",
    regionGap: "--starci-core-region-gap",
    elevation: "--starci-core-surface-shadow",
    motionDuration: "--starci-core-motion-duration",
    motionEasing: "--starci-core-motion-easing",
} as const)

/**
 * Sticky-band geometry the package PUBLISHES rather than expects.
 *
 * These are not theme tokens and they are deliberately absent from `STARCI_CORE_TOKEN_NAMES`: a
 * theme token has one default the family always defines, while each of these is either derived from
 * what is actually on the page or supplied by a host that wants to override that. A consumer reads
 * them; only `railOffset` and `subnavOffset` are meant to be written.
 *
 * - `bandOffset` - where the sticky band stack stops. Defined only while a sticky
 *   `NavigationFeatureNav` or `Subnav` is present, so `var(--starci-core-band-offset, X)` keeps
 *   falling back to a page's own X when there is no band. A page pins to it with
 *   `top: var(--starci-core-band-offset)` and bounds itself with
 *   `max-height: calc(100dvh - var(--starci-core-band-offset))`.
 * - `bandHeight` - the navigation band alone: 4rem plus its separator, plus 2rem when a feature
 *   layer is stacked on it.
 * - `bandSubnavHeight` - a stacked sticky `Subnav`, which contributes nothing once a compact one is
 *   hidden at 70rem.
 * - `railOffset` / `subnavOffset` - the host overrides. Unset, each reads the published band.
 */
export const STARCI_CORE_BAND_TOKEN_NAMES = Object.freeze({
    bandOffset: "--starci-core-band-offset",
    bandHeight: "--starci-core-band-height",
    bandSubnavHeight: "--starci-core-band-subnav-height",
    railOffset: "--starci-core-rail-offset",
    subnavOffset: "--starci-core-subnav-offset",
} as const)

export type StarCiCoreBandTokenName = (typeof STARCI_CORE_BAND_TOKEN_NAMES)[keyof typeof STARCI_CORE_BAND_TOKEN_NAMES]

export type StarCiCoreDna = typeof STARCI_CORE_DNA
export type StarCiCoreTokenName = (typeof STARCI_CORE_TOKEN_NAMES)[keyof typeof STARCI_CORE_TOKEN_NAMES]

/** Portable light/default values keyed by the public CSS custom-property contract. */
export const STARCI_CORE_TOKEN_DEFAULTS = Object.freeze({
    "--starci-core-accent": STARCI_CORE_DNA.color.accent,
    "--starci-core-accent-foreground": STARCI_CORE_DNA.color.accentForeground,
    "--starci-core-focus": STARCI_CORE_DNA.color.focus,
    "--starci-core-canvas": STARCI_CORE_DNA.color.light.canvas,
    "--starci-core-surface": STARCI_CORE_DNA.color.light.surface,
    "--starci-core-surface-secondary": STARCI_CORE_DNA.color.light.surfaceSecondary,
    "--starci-core-foreground": STARCI_CORE_DNA.color.light.foreground,
    "--starci-core-muted": STARCI_CORE_DNA.color.light.muted,
    "--starci-core-border": STARCI_CORE_DNA.color.light.border,
    "--starci-core-separator": STARCI_CORE_DNA.color.light.separator,
    "--starci-core-success": STARCI_CORE_DNA.color.light.success,
    "--starci-core-success-foreground": STARCI_CORE_DNA.color.light.successForeground,
    "--starci-core-warning": STARCI_CORE_DNA.color.light.warning,
    "--starci-core-warning-foreground": STARCI_CORE_DNA.color.light.warningForeground,
    "--starci-core-danger": STARCI_CORE_DNA.color.light.danger,
    "--starci-core-danger-foreground": STARCI_CORE_DNA.color.light.dangerForeground,
    "--starci-core-info": STARCI_CORE_DNA.color.light.info,
    "--starci-core-info-foreground": STARCI_CORE_DNA.color.light.infoForeground,
    "--starci-core-page-measure": STARCI_CORE_DNA.geometry.pageMeasure,
    "--starci-core-reading-measure": STARCI_CORE_DNA.geometry.readingMeasure,
    "--starci-core-surface-radius": STARCI_CORE_DNA.geometry.surfaceRadius,
    "--starci-core-control-radius": STARCI_CORE_DNA.geometry.controlRadius,
    "--starci-core-pill-radius": STARCI_CORE_DNA.geometry.pillRadius,
    "--starci-core-page-inset": STARCI_CORE_DNA.rhythm.pageInset,
    "--starci-core-inline-gap": STARCI_CORE_DNA.rhythm.inlineGap,
    "--starci-core-row-gap": STARCI_CORE_DNA.rhythm.rowGap,
    "--starci-core-section-gap": STARCI_CORE_DNA.rhythm.sectionGap,
    "--starci-core-region-gap": STARCI_CORE_DNA.rhythm.regionGap,
    "--starci-core-surface-shadow": STARCI_CORE_DNA.elevation.surface,
    "--starci-core-motion-duration": STARCI_CORE_DNA.motion.duration,
    "--starci-core-motion-easing": STARCI_CORE_DNA.motion.easing,
} satisfies Readonly<Record<StarCiCoreTokenName, string>>)

/** Theme overrides layered on the default token set by `GrammarRoot` dark mode. */
export const STARCI_CORE_DARK_TOKEN_DEFAULTS = Object.freeze({
    "--starci-core-canvas": STARCI_CORE_DNA.color.dark.canvas,
    "--starci-core-surface": STARCI_CORE_DNA.color.dark.surface,
    "--starci-core-surface-secondary": STARCI_CORE_DNA.color.dark.surfaceSecondary,
    "--starci-core-foreground": STARCI_CORE_DNA.color.dark.foreground,
    "--starci-core-muted": STARCI_CORE_DNA.color.dark.muted,
    "--starci-core-border": STARCI_CORE_DNA.color.dark.border,
    "--starci-core-separator": STARCI_CORE_DNA.color.dark.separator,
    "--starci-core-success": STARCI_CORE_DNA.color.dark.success,
    "--starci-core-success-foreground": STARCI_CORE_DNA.color.dark.successForeground,
    "--starci-core-warning": STARCI_CORE_DNA.color.dark.warning,
    "--starci-core-warning-foreground": STARCI_CORE_DNA.color.dark.warningForeground,
    "--starci-core-danger": STARCI_CORE_DNA.color.dark.danger,
    "--starci-core-danger-foreground": STARCI_CORE_DNA.color.dark.dangerForeground,
    "--starci-core-info": STARCI_CORE_DNA.color.dark.info,
    "--starci-core-info-foreground": STARCI_CORE_DNA.color.dark.infoForeground,
} satisfies Readonly<Partial<Record<StarCiCoreTokenName, string>>>)

export type StarCiCoreTokenDefaults = typeof STARCI_CORE_TOKEN_DEFAULTS
