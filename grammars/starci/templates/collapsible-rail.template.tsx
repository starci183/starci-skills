/** Durable StarCi template: one host animates width; state never changes inset, scroll owner or boundary. */
type CollapsibleRailProps = { readonly collapsed: boolean; readonly reduceMotion: boolean; readonly toggle: () => void }
declare const MotionRail: (props: { readonly width: 64 | 256; readonly transition: "spring" | "instant"; readonly inset: "px-3 py-6"; readonly height: "app-rail"; readonly children: JSX.Element }) => JSX.Element
declare const CollapseControl: (props: { readonly collapsed: boolean; readonly label: "Collapse navigation" | "Expand navigation"; readonly pressed: boolean; readonly activate: () => void }) => JSX.Element
declare const ExpandedDestinations: () => JSX.Element
declare const CompactDestinations: () => JSX.Element

export const CollapsibleRailTemplate = (props: CollapsibleRailProps) => (
    <MotionRail
        width={props.collapsed ? 64 : 256}
        transition={props.reduceMotion ? "instant" : "spring"}
        inset="px-3 py-6"
        height="app-rail"
    >
        <CollapseControl
            collapsed={props.collapsed}
            label={props.collapsed ? "Expand navigation" : "Collapse navigation"}
            pressed={props.collapsed}
            activate={props.toggle}
        />
        {props.collapsed ? <CompactDestinations /> : <ExpandedDestinations />}
    </MotionRail>
)

export const invariants = {
    stableHost: true,
    changedAxes: ["width", "visible-copy"],
    invariantAxes: ["inset", "scroll-owner", "boundary-height", "destination-order"],
    scrollOwner: "destination-groups",
    toggleOwner: "collapsible-rail",
    toggleKeyboardOperable: true,
    toggleStateExposed: true,
} as const
