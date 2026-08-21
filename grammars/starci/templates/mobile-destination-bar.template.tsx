/** Durable StarCi template: narrow navigation switches one local panel from a bottom destination bar. */
type Destination = { readonly id: string; readonly label: string; readonly available: boolean }
type MobileDestinationProps = { readonly selected: string; readonly destinations: ReadonlyArray<Destination> }
declare const Panel: (props: { readonly id: string }) => JSX.Element
declare const BottomNavigation: (props: { readonly destinations: ReadonlyArray<Destination>; readonly selected: string }) => JSX.Element

export const MobileDestinationBarTemplate = (props: MobileDestinationProps) => {
    const available = props.destinations.filter((destination) => destination.available)
    const selected = available.some((destination) => destination.id === props.selected)
        ? props.selected
        : available[0]?.id
    return (
        <div>
            {selected === undefined ? null : <Panel id={selected} />}
            <BottomNavigation destinations={available} selected={selected ?? ""} />
        </div>
    )
}

export const invariants = {
    actionBar: false,
    visiblePanels: 1,
    staleSelectionSurvivesMissingDestination: false,
} as const
