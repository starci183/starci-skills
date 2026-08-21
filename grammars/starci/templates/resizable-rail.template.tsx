/** Durable StarCi template: resize changes one shared edge while rail and body keep separate scroll planes. */
type ResizableRailProps = { readonly width: number; readonly min: number; readonly max: number }
declare const AdjacentRow: (props: { readonly children: ReadonlyArray<JSX.Element> }) => JSX.Element
declare const RailBoundary: (props: { readonly width: number; readonly inset: "none"; readonly height: "app-rail"; readonly children: JSX.Element }) => JSX.Element
declare const RailContentPanel: (props: { readonly inset: "owner-defined"; readonly children: JSX.Element }) => JSX.Element
declare const RailScrollViewport: (props: { readonly hideNativeScrollbar: true }) => JSX.Element
declare const Separator: (props: { readonly role: "separator"; readonly keyboard: true; readonly pointer: true; readonly layoutWidth: 0; readonly height: "app-rail" }) => JSX.Element
declare const RoutedBody: (props: { readonly independentScroll: true }) => JSX.Element

export const ResizableRailTemplate = (props: ResizableRailProps) => (
    <AdjacentRow>
        <RailBoundary
            width={Math.min(props.max, Math.max(props.min, props.width))}
            inset="none"
            height="app-rail"
        >
            <RailContentPanel inset="owner-defined">
                <RailScrollViewport hideNativeScrollbar />
            </RailContentPanel>
        </RailBoundary>
        <Separator role="separator" keyboard pointer layoutWidth={0} height="app-rail" />
        <RoutedBody independentScroll />
    </AdjacentRow>
)

export const invariants = {
    resizeAxis: "inline-width-only",
    scrollPlanesIndependent: true,
    separatorIsSiblingBoundary: true,
    separatorLayoutWidth: 0,
    boundaryHeight: "app-rail",
    boundaryInset: "none",
    contentInsetOwner: "rail-content-panel",
    persistedWidth: true,
    boundedWidth: true,
} as const
