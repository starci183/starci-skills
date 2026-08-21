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
    readonly children: JSX.Element
}) => JSX.Element

export const DashboardThemeTemplate = ({ children, tokens }: DashboardThemeProps) => (
    <ThemeBoundary tokens={tokens} selectedSurface="soft-profile-accent" allViewports={true}>
        {children}
    </ThemeBoundary>
)

export const invariants = {
    oneTheme: true,
    brandAccent: "profile-owned",
    selectedSurface: "soft-profile-accent",
    localAccentSubstitution: false,
    invariantAcross: ["expanded", "collapsed", "desktop", "mobile", "drawer"],
} as const
