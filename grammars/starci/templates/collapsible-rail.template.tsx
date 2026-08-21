/** Durable StarCi template: one host animates width; state never changes inset, scroll owner or boundary. */
type CollapsibleRailProps = { readonly collapsed: boolean; readonly reduceMotion: boolean }
declare const MotionRail: (props: { readonly width: 64 | 256; readonly transition: "spring" | "instant"; readonly inset: "px-3 py-6"; readonly height: "app-rail"; readonly children: JSX.Element }) => JSX.Element
declare const ExpandedDestinations: () => JSX.Element
declare const CompactDestinations: () => JSX.Element

export const CollapsibleRailTemplate = (props: CollapsibleRailProps) => (
    <MotionRail
        width={props.collapsed ? 64 : 256}
        transition={props.reduceMotion ? "instant" : "spring"}
        inset="px-3 py-6"
        height="app-rail"
    >
        {props.collapsed ? <CompactDestinations /> : <ExpandedDestinations />}
    </MotionRail>
)

export const invariants = {
    stableHost: true,
    changedAxes: ["width", "visible-copy"],
    invariantAxes: ["inset", "scroll-owner", "boundary-height", "destination-order"],
    scrollOwner: "destination-groups",
} as const
