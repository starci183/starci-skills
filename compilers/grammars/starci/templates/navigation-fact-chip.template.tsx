/** Durable StarCi template: gated destinations stay operable and prominent facts use semantic chips. */
type Fact =
    | { readonly kind: "locked"; readonly label: string }
    | { readonly kind: "rank"; readonly label: `#${number}` }
    | { readonly kind: "due"; readonly count: number }
type Destination = { readonly id: string; readonly label: string; readonly gateViewable?: boolean; readonly fact?: Fact }
declare const DestinationRow: (props: Destination & { readonly disabled: false; readonly chipTone?: "warning" | "accent" }) => JSX.Element

export const NavigationFactChipTemplate = (destination: Destination) => (
    <DestinationRow
        {...destination}
        disabled={false}
        chipTone={destination.fact?.kind === "rank" ? "accent" : destination.fact === undefined ? undefined : "warning"}
    />
)

export const invariants = {
    viewableGateIsDisabled: false,
    zeroDueCountIsOmitted: true,
    trailingFactIsAction: false,
} as const
