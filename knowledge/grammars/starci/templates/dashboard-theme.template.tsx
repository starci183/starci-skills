/** Durable StarCi template: authenticated dashboards use exact tokens from their routed profile. */
type DashboardThemeTokens = Readonly<Record<`--${string}`, string>>
type DashboardThemeProps = {
    readonly children: JSX.Element
    readonly tokens: DashboardThemeTokens
}
declare const ThemeBoundary: (props: {
    readonly tokens: DashboardThemeTokens
    readonly selectedSurface: "soft-profile-accent"
    readonly allViewports: true
    readonly allThemeModes: true
    readonly rendererReach: "document-and-portals"
    readonly children: JSX.Element
}) => JSX.Element

export const DashboardThemeTemplate = ({ children, tokens }: DashboardThemeProps) => (
    <ThemeBoundary
        tokens={tokens}
        selectedSurface="soft-profile-accent"
        allViewports={true}
        allThemeModes={true}
        rendererReach="document-and-portals"
    >
        {children}
    </ThemeBoundary>
)

export const invariants = {
    oneTheme: true,
    brandAccent: "profile-owned",
    selectedSurface: "soft-profile-accent",
    localAccentSubstitution: false,
    invariantAcross: ["expanded", "collapsed", "desktop", "mobile", "drawer", "light", "dark", "portal"],
    rendererReach: "document-and-portals",
} as const
