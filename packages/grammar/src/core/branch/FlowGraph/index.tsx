"use client"

import {
    Background,
    Controls,
    Handle,
    Position,
    ReactFlow,
    useNodesInitialized,
    useReactFlow,
    type Edge,
    type Node,
    type NodeProps,
    type NodeTypes,
} from "@xyflow/react"
import { memo, useEffect, useMemo, useState, type KeyboardEvent } from "react"
import { Skeleton } from "../../primitive/Skeleton/index.js"
import { flowGraphRoot, radialPositions } from "./layout.js"
import type { FlowGraphEdge, FlowGraphHeight, FlowGraphLayout, FlowGraphNode } from "./types.js"

export { radialPositions } from "./layout.js"
export type { FlowGraphEdge, FlowGraphHeight, FlowGraphLayout, FlowGraphNode, FlowGraphNodeSize, FlowGraphTone } from "./types.js"

export type FlowGraphProps = {
    /** Names the graph for assistive technology, e.g. "Second brain". */
    readonly label: string
    readonly nodes: ReadonlyArray<FlowGraphNode>
    readonly edges: ReadonlyArray<FlowGraphEdge>
    /** The selected node. Pass it (with `onSelect`) to control selection; leave it out and the graph keeps its own. */
    readonly selectedId?: string | null
    /** Fires with the node id on click, Enter or Space, and with `null` when the empty canvas is clicked or Escape is pressed. */
    readonly onSelect?: (id: string | null) => void
    /** Fixed canvas height: 16rem, 24rem or 32rem. */
    readonly height?: FlowGraphHeight
    /** Pan and zoom. `false` draws a static picture. */
    readonly isInteractive?: boolean
    /** Zoom buttons. Defaults to on while the graph is interactive. */
    readonly showControls?: boolean
    /** `radial` places the nodes itself; `manual` uses each node's `position`. */
    readonly layout?: FlowGraphLayout
    /** Shown instead of the canvas when there are no nodes. */
    readonly emptyLabel?: string
    /** Unresolved graph (knowledge STATE-8): the frame at its height with a Skeleton block, no React Flow mounted, `aria-busy`. */
    readonly isLoading?: boolean
    readonly className?: string
}

type NodeData = {
    readonly graphNode: FlowGraphNode
    readonly isSelected: boolean
    readonly [key: string]: unknown
}

const FlowGraphNodeView = memo(({ data }: NodeProps<Node<NodeData>>) => {
    const { graphNode, isSelected } = data
    const hasCount = graphNode.count !== undefined && graphNode.count !== ""
    return (
        <div
            className="starci-core-flow-graph-node"
            data-grammar-flow-node={graphNode.id}
            data-grammar-selected={isSelected ? "true" : "false"}
            data-placeholder={graphNode.isPlaceholder === true ? "true" : undefined}
            data-root={graphNode.isRoot === true ? "true" : undefined}
            data-size={graphNode.size ?? "md"}
            data-tone={graphNode.isPlaceholder === true ? "muted" : graphNode.tone ?? "neutral"}
        >
            <Handle className="starci-core-flow-graph-handle" isConnectable={false} position={Position.Top} type="target" />
            <span className="starci-core-flow-graph-copy">
                <span className="starci-core-flow-graph-label">{graphNode.label}</span>
                {graphNode.description === undefined ? null : <span className="starci-core-flow-graph-description">{graphNode.description}</span>}
            </span>
            {hasCount ? <span className="starci-core-flow-graph-count">{graphNode.count}</span> : null}
            <Handle className="starci-core-flow-graph-handle" isConnectable={false} position={Position.Top} type="source" />
        </div>
    )
})
FlowGraphNodeView.displayName = "FlowGraphNodeView"

const NODE_TYPES: NodeTypes = { flowGraph: FlowGraphNodeView }
const FIT_OPTIONS = { padding: 0.2, duration: 0 } as const

/** Re-fits the viewport once the nodes are measured, and again whenever the set of nodes or the layout changes. */
const Refit = ({ signature }: { readonly signature: string }) => {
    const { fitView } = useReactFlow()
    const isReady = useNodesInitialized()
    useEffect(() => {
        if (isReady) void fitView(FIT_OPTIONS)
    }, [fitView, isReady, signature])
    return null
}

const labelFor = (node: FlowGraphNode) => node.count === undefined || node.count === "" ? node.label : `${node.label} (${node.count})`

/**
 * A node-and-edge map drawn with React Flow (`@xyflow/react`, a peer dependency) in grammar tokens. The radial layout
 * puts the root in the centre with its children on a ring and their children on an outer ring around them. Nodes are
 * keyboard focusable (Tab) and selectable with Enter or Space; a visually hidden list repeats the nodes for screen readers.
 * Contract: focus FOCUS-2, selection CONTROL-STATE-3, empty STATE-3.
 */
export const FlowGraph = ({
    label,
    nodes,
    edges,
    selectedId,
    onSelect,
    height = "md",
    isInteractive = true,
    showControls,
    layout = "radial",
    emptyLabel = "Nothing to show yet.",
    isLoading = false,
    className,
}: FlowGraphProps) => {
    const [ownSelectedId, setOwnSelectedId] = useState<string | null>(null)
    const currentId = selectedId === undefined ? ownSelectedId : selectedId
    const select = (id: string | null) => {
        if (selectedId === undefined) setOwnSelectedId(id)
        onSelect?.(id)
    }

    const positions = useMemo(() => layout === "radial" ? radialPositions(nodes, edges) : null, [layout, nodes, edges])
    const rootId = flowGraphRoot(nodes)?.id
    const flowNodes = useMemo<Array<Node<NodeData>>>(() => nodes.map((graphNode) => ({
        id: graphNode.id,
        type: "flowGraph",
        position: positions?.get(graphNode.id) ?? graphNode.position ?? { x: 0, y: 0 },
        data: { graphNode: layout === "radial" ? { ...graphNode, isRoot: graphNode.id === rootId } : graphNode, isSelected: graphNode.id === currentId },
        selected: graphNode.id === currentId,
        ariaLabel: labelFor(graphNode),
        draggable: false,
        connectable: false,
    })), [nodes, positions, layout, rootId, currentId])
    const flowEdges = useMemo<Array<Edge>>(() => edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: layout === "radial" ? "straight" : "default",
        className: edge.isPlaceholder === true ? "starci-core-flow-graph-edge starci-core-flow-graph-edge-placeholder" : "starci-core-flow-graph-edge",
        focusable: false,
        selectable: false,
        animated: false,
    })), [edges, layout])
    const signature = `${layout}:${nodes.map((node) => node.id).join("|")}`

    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Escape") {
            if (currentId !== null) select(null)
            return
        }
        if (event.key !== "Enter" && event.key !== " ") return
        const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".react-flow__node") : null
        const id = target?.getAttribute("data-id")
        if (id === null || id === undefined) return
        event.preventDefault()
        select(id)
    }

    const controls = showControls ?? isInteractive

    return (
        <figure
            aria-label={label}
            className={["starci-core-flow-graph", className].filter(Boolean).join(" ")}
            data-component="FlowGraph"
            data-contract="FOCUS-2 CONTROL-STATE-3 STATE-3"
            data-grammar-flow-height={height}
            data-grammar-flow-interactive={isInteractive ? "true" : "false"}
            data-grammar-flow-layout={layout}
            data-tier="branch"
            {...(isLoading ? { "aria-busy": true, "data-loading": "true" } : {})}
            onKeyDown={onKeyDown}
        >
            {isLoading ? (
                <div className="starci-core-flow-graph-canvas starci-core-flow-graph-loading" data-grammar-flow-loading="true"><Skeleton shape="rect" /></div>
            ) : nodes.length === 0 ? (
                <p className="starci-core-flow-graph-empty" data-contract="STATE-3" data-grammar-flow-empty="true">{emptyLabel}</p>
            ) : (
                <>
                    <div className="starci-core-flow-graph-canvas">
                        <ReactFlow
                            edges={flowEdges}
                            edgesFocusable={false}
                            elementsSelectable
                            fitView
                            fitViewOptions={FIT_OPTIONS}
                            maxZoom={2}
                            minZoom={0.2}
                            nodeOrigin={[0.5, 0.5]}
                            nodeTypes={NODE_TYPES}
                            nodes={flowNodes}
                            nodesConnectable={false}
                            nodesDraggable={false}
                            nodesFocusable
                            onNodeClick={(_event, node) => select(node.id)}
                            onPaneClick={() => { if (currentId !== null) select(null) }}
                            panOnDrag={isInteractive}
                            panOnScroll={false}
                            preventScrolling={isInteractive}
                            proOptions={{ hideAttribution: true }}
                            zoomOnDoubleClick={false}
                            zoomOnPinch={isInteractive}
                            zoomOnScroll={isInteractive}
                        >
                            <Background className="starci-core-flow-graph-background" gap={1000} size={0} />
                            {controls ? <Controls aria-label={`${label}: zoom`} className="starci-core-flow-graph-controls" showInteractive={false} /> : null}
                            <Refit signature={signature} />
                        </ReactFlow>
                    </div>
                    <ul className="starci-core-visually-hidden" data-grammar-flow-fallback="true">
                        {nodes.map((node) => <li key={node.id}>{labelFor(node)}</li>)}
                    </ul>
                </>
            )}
        </figure>
    )
}
