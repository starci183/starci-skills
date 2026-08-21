/** Durable StarCi template: hierarchy, disclosure, search and group progress stay one owner. */
type Child = { readonly id: string; readonly title: string; readonly isActive?: boolean }
type Group = { readonly id: string; readonly title: string; readonly done: number; readonly total: number; readonly children: ReadonlyArray<Child> }
type OutlineProps = { readonly groups: ReadonlyArray<Group>; readonly query: string; readonly expanded: ReadonlySet<string> }
declare const Accordion: (props: OutlineProps) => JSX.Element

export const HierarchicalDisclosureTemplate = (props: OutlineProps) => (
    <Accordion groups={props.groups} query={props.query} expanded={props.expanded} />
)

export const invariants = {
    activeParentAutoOpens: true,
    searchRevealsMatchingParents: true,
    expandedSummary: "progress-meter",
    collapsedSummary: "compact-count",
} as const
