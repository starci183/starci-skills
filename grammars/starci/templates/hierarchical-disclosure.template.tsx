/** Durable StarCi template: hierarchy, disclosure, search and group progress stay one owner. */
type Child = { readonly id: string; readonly title: string; readonly isActive?: boolean }
type Group = { readonly id: string; readonly title: string; readonly done: number; readonly total: number; readonly children: ReadonlyArray<Child> }
type OutlineProps = {
    readonly groups: ReadonlyArray<Group>
    readonly query: string
    readonly expanded: ReadonlySet<string>
    readonly boundary: "surface" | "embedded"
}
type SurfaceSummaryInset = "single:p-4;first:p-4 pb-3;middle:px-4 py-3;last:p-4 pt-3"
type ContentInset = "px-6 py-3"
type StructuredPanelAnatomy = "summary-metadata;derived-facts;description;ordered-preview-rows"
type StaticSupportingListMarker = "dot;same-semantic-foreground-as-label"
declare const Accordion: (props: OutlineProps & {
    readonly summaryInset: SurfaceSummaryInset | "host-owned"
    readonly panelContentInset: ContentInset | "host-owned"
    readonly itemSeparator: "inset-between-items" | "host-owned"
    readonly expandedInternalDivider: "none" | "host-owned"
    readonly triggerHoverFill: "none" | "host-owned"
    readonly panelContentMode: "evidenced-structure-or-typed-react-render"
    readonly structuredPanelAnatomy: StructuredPanelAnatomy
    readonly staticSupportingListMarker: StaticSupportingListMarker
}) => JSX.Element

export const HierarchicalDisclosureTemplate = (props: OutlineProps) => (
    <Accordion
        groups={props.groups}
        query={props.query}
        expanded={props.expanded}
        boundary={props.boundary}
        summaryInset={props.boundary === "surface" ? "single:p-4;first:p-4 pb-3;middle:px-4 py-3;last:p-4 pt-3" : "host-owned"}
        panelContentInset={props.boundary === "surface" ? "px-6 py-3" : "host-owned"}
        itemSeparator={props.boundary === "surface" ? "inset-between-items" : "host-owned"}
        expandedInternalDivider={props.boundary === "surface" ? "none" : "host-owned"}
        triggerHoverFill={props.boundary === "surface" ? "none" : "host-owned"}
        panelContentMode="evidenced-structure-or-typed-react-render"
        structuredPanelAnatomy="summary-metadata;derived-facts;description;ordered-preview-rows"
        staticSupportingListMarker="dot;same-semantic-foreground-as-label"
    />
)

export const invariants = {
    activeParentAutoOpens: true,
    searchRevealsMatchingParents: true,
    expandedSummary: "progress-meter",
    collapsedSummary: "compact-count",
    boundedSurfaceSummaryInset: "single:p-4;first:p-4 pb-3;middle:px-4 py-3;last:p-4 pt-3",
    boundedSurfacePanelContentInset: "px-6 py-3",
    boundedSurfaceItemSeparator: "inset-between-items",
    boundedSurfaceExpandedInternalDivider: "none",
    boundedSurfaceTriggerHoverFill: "none",
    panelContentMode: "evidenced-structure-or-typed-react-render",
    structuredPanelAnatomy: "summary-metadata;derived-facts;description;ordered-preview-rows",
    staticSupportingListMarker: "dot;same-semantic-foreground-as-label",
    embeddedSummaryInset: "host-owned",
    embeddedPanelContentInset: "host-owned",
} as const
