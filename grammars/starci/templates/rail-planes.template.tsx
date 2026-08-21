/** Durable StarCi template: boundaries stay zero-inset; each content plane owns its own recipe. */
declare const CollapsibleNavigationRail: (props: { readonly inset: "px-3 py-6"; readonly height: "viewport-minus-navbar-and-separator" }) => JSX.Element
declare const ResizableBoundary: (props: { readonly inset: "none"; readonly stickyTop: "navbar-bottom"; readonly height: "viewport-minus-navbar-and-separator"; readonly children: JSX.Element }) => JSX.Element
declare const RailContentPanel: (props: { readonly inset: "px-3"; readonly outerBlockInset: 0 }) => JSX.Element
declare const PrimaryPlane: (props: { readonly inset: "p-6"; readonly margin: "normal-flow" }) => JSX.Element

export const RailPlanesTemplate = () => (
    <div>
        <CollapsibleNavigationRail inset="px-3 py-6" height="viewport-minus-navbar-and-separator" />
        <ResizableBoundary inset="none" stickyTop="navbar-bottom" height="viewport-minus-navbar-and-separator">
            <RailContentPanel inset="px-3" outerBlockInset={0} />
        </ResizableBoundary>
        <PrimaryPlane inset="p-6" margin="normal-flow" />
    </div>
)

export const invariants = {
    collapsibleInsetChangesWithPresentation: false,
    resizableBoundaryInset: "none",
    resizableContentInsetOwner: "rail-content-panel-inline-only",
    resizableContentOuterBlockInset: 0,
    stickyOffsetIncludesContentInset: false,
    navbarSeparatorIncludedInHeight: true,
    primaryPlaneAutoCenters: false,
} as const
