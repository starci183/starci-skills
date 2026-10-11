export type FlowGraphTone = "neutral" | "accent" | "success" | "warning" | "danger" | "muted"
export type FlowGraphNodeSize = "sm" | "md" | "lg"
export type FlowGraphHeight = "sm" | "md" | "lg"
export type FlowGraphLayout = "radial" | "manual"

export type FlowGraphNode = {
    readonly id: string
    readonly label: string
    readonly description?: string
    readonly tone?: FlowGraphTone
    readonly size?: FlowGraphNodeSize
    readonly count?: number | string
    /** The centre of a radial layout. Defaults to the first node. */
    readonly isRoot?: boolean
    /** A slot not filled yet: dashed outline, muted. */
    readonly isPlaceholder?: boolean
    /** Where the node sits in `layout="manual"`, as its centre in graph units. */
    readonly position?: { readonly x: number, readonly y: number }
}

export type FlowGraphEdge = {
    readonly id: string
    readonly source: string
    readonly target: string
    readonly isPlaceholder?: boolean
}
