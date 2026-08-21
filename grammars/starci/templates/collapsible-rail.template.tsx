/** Durable StarCi template: exact collapsible sidebar anatomy, motion, glyph and state inset. */
type CollapsibleRailProps = {
    readonly collapsed: boolean
    readonly reduceMotion: boolean
    readonly title: string
    readonly toggle: () => void
}
declare const MotionRail: (props: {
    readonly width: 64 | 256
    readonly transition: "spring-420-38" | "instant"
    readonly inset: "p-6" | "px-3 py-6"
    readonly boundary: "border-r border-default"
    readonly height: "app-rail"
    readonly children: JSX.Element
}) => JSX.Element
declare const HeaderRow: (props: { readonly justify: "between" | "center"; readonly children: JSX.Element }) => JSX.Element
declare const TitlePresence: (props: { readonly visible: boolean; readonly transition: "fade-150" | "instant"; readonly children: string }) => JSX.Element
declare const ToggleControl: (props: {
    readonly glyph: "sidebar-simple"
    readonly label: "Collapse navigation" | "Expand navigation"
    readonly pressed: boolean
    readonly activate: () => void
}) => JSX.Element
declare const PinnedTopSlot: () => JSX.Element
declare const ScrollViewport: (props: { readonly owner: "destination-groups"; readonly children: JSX.Element }) => JSX.Element
declare const Destinations: (props: { readonly presentation: "expanded" | "compact" }) => JSX.Element

export const CollapsibleRailTemplate = (props: CollapsibleRailProps) => (
    <MotionRail
        width={props.collapsed ? 64 : 256}
        transition={props.reduceMotion ? "instant" : "spring-420-38"}
        inset={props.collapsed ? "px-3 py-6" : "p-6"}
        boundary="border-r border-default"
        height="app-rail"
    >
        <HeaderRow justify={props.collapsed ? "center" : "between"}>
            <TitlePresence visible={!props.collapsed} transition={props.reduceMotion ? "instant" : "fade-150"}>
                {props.title}
            </TitlePresence>
            <ToggleControl
                glyph="sidebar-simple"
                label={props.collapsed ? "Expand navigation" : "Collapse navigation"}
                pressed={props.collapsed}
                activate={props.toggle}
            />
        </HeaderRow>
        <PinnedTopSlot />
        <ScrollViewport owner="destination-groups">
            <Destinations presentation={props.collapsed ? "compact" : "expanded"} />
        </ScrollViewport>
    </MotionRail>
)

export const invariants = {
    stableHost: true,
    changedAxes: ["width", "visible-copy", "inline-inset"],
    invariantAxes: ["scroll-owner", "boundary-height", "destination-order", "toggle-glyph"],
    scrollOwner: "destination-groups",
    toggleOwner: "collapsible-rail",
    toggleGlyph: "sidebar-simple",
    toggleKeyboardOperable: true,
    toggleStateExposed: true,
    expandedInset: "p-6",
    collapsedInset: "px-3 py-6",
    rightEdgeSeparator: true,
} as const
