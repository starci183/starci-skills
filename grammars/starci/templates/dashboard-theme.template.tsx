/** Durable StarCi template: authenticated dashboards share one exact semantic visual theme. */
type DashboardThemeProps = { readonly children: JSX.Element }
declare const ThemeBoundary: (props: {
    readonly tokens: typeof starciDashboardTokens
    readonly selectedSurface: "soft-rose"
    readonly allViewports: true
    readonly children: JSX.Element
}) => JSX.Element

export const starciDashboardTokens = {
    "--starci-background": "oklch(97.02% 0.0015 354.13)",
    "--starci-surface": "oklch(100% 0.0008 354.13)",
    "--starci-surface-secondary": "oklch(95.24% 0.0012 354.13)",
    "--starci-foreground": "oklch(21.03% 0.0015 354.13)",
    "--starci-muted": "oklch(55.17% 0.0030 354.13)",
    "--starci-accent": "oklch(70.03% 0.2092 354.13)",
    "--starci-accent-foreground": "oklch(100% 0 0)",
    "--starci-accent-soft": "color-mix(in oklab, var(--starci-accent) 15%, transparent)",
    "--starci-separator": "oklch(92% 0.0015 354.13)",
    "--starci-border": "oklch(90% 0.0015 354.13)",
    "--starci-success": "oklch(73.29% 0.1941 162.85)",
    "--starci-success-soft": "color-mix(in oklab, var(--starci-success) 15%, transparent)",
    "--starci-warning": "oklch(78.19% 0.1590 84.37)",
    "--starci-warning-soft": "color-mix(in oklab, var(--starci-warning) 18%, transparent)",
    "--starci-danger": "oklch(65.32% 0.2335 37.78)",
    "--starci-danger-soft": "color-mix(in oklab, var(--starci-danger) 15%, transparent)",
    "--starci-scrim": "oklch(21.03% 0.0015 354.13 / 48%)",
    "--starci-font-sans": "Open Sans, ui-sans-serif, system-ui, sans-serif",
    "--starci-radius-3xl": "1.5rem",
    "--starci-surface-shadow": "0 2px 4px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.06), 0 0 1px 0 rgba(0, 0, 0, 0.06)",
    "--starci-duration": "150ms",
    "--starci-easing": "cubic-bezier(0.4, 0, 0.2, 1)",
} as const

export const DashboardThemeTemplate = ({ children }: DashboardThemeProps) => (
    <ThemeBoundary tokens={starciDashboardTokens} selectedSurface="soft-rose" allViewports={true}>
        {children}
    </ThemeBoundary>
)

export const invariants = {
    oneTheme: true,
    brandAccent: "rose",
    selectedSurface: "soft-rose",
    localAccentSubstitution: false,
    invariantAcross: ["expanded", "collapsed", "desktop", "mobile", "drawer"],
} as const
