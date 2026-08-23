/** Durable StarCi template: the hit target is larger than the painted circle and shares the toggle centreline. */
type CompactDestinationProps = { readonly label: string; readonly selected: boolean; readonly hover: boolean }
declare const HitTarget: (props: { readonly size: 44; readonly transparent: true; readonly label: string; readonly children: JSX.Element }) => JSX.Element
declare const VisualCircle: (props: { readonly size: 36; readonly paint: "rest" | "hover" | "selected" }) => JSX.Element

export const CompactNavigationTemplate = (props: CompactDestinationProps) => (
    <HitTarget size={44} transparent label={props.label}>
        <VisualCircle size={36} paint={props.selected ? "selected" : props.hover ? "hover" : "rest"} />
    </HitTarget>
)

export const invariants = {
    sharedCentrelineWithToggle: true,
    outerTargetOwnsPaint: false,
} as const
