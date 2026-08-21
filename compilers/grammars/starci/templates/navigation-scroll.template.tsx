/** Durable StarCi template: only long destination groups scroll; overview and controls remain pinned. */
declare const CollapseControl: () => JSX.Element
declare const OverviewDestination: () => JSX.Element
declare const ResumeEvidence: () => JSX.Element
declare const ScrollViewport: (props: { readonly hideNativeScrollbar: true; readonly overscrollContained: true; readonly children: JSX.Element }) => JSX.Element
declare const DestinationGroups: () => JSX.Element

export const NavigationScrollTemplate = () => (
    <nav>
        <CollapseControl />
        <OverviewDestination />
        <ResumeEvidence />
        <ScrollViewport hideNativeScrollbar overscrollContained>
            <DestinationGroups />
        </ScrollViewport>
    </nav>
)

export const invariants = { onlyGroupsScroll: true } as const
