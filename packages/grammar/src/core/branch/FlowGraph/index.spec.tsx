// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { FAMILY_WRAPS, installDomShims } from "../../../__test__/grammarRoots.js"
import { FlowGraph, radialPositions, type FlowGraphEdge, type FlowGraphNode } from "./index.js"

/** React Flow measures with ResizeObserver and DOMMatrixReadOnly, which jsdom lacks. */
beforeAll(() => {
    installDomShims()
    if (globalThis.DOMMatrixReadOnly === undefined) {
        globalThis.DOMMatrixReadOnly = class DOMMatrixReadOnly {
            m22 = 1
            constructor(transform?: string) {
                const scale = /scale\(([\d.]+)\)/.exec(transform ?? "")
                this.m22 = scale === null ? 1 : Number(scale[1])
            }
        } as unknown as typeof DOMMatrixReadOnly
    }
})
afterEach(cleanup)

const nodes: ReadonlyArray<FlowGraphNode> = [
    { id: "root", label: "Second brain", isRoot: true },
    { id: "a", label: "People", count: 12 },
    { id: "b", label: "Projects" },
    { id: "c", label: "Ideas", isPlaceholder: true },
    { id: "a1", label: "Ada" },
    { id: "a2", label: "Grace" },
]
const edges: ReadonlyArray<FlowGraphEdge> = [
    { id: "e1", source: "root", target: "a" },
    { id: "e2", source: "root", target: "b" },
    { id: "e3", source: "root", target: "c", isPlaceholder: true },
    { id: "e4", source: "a", target: "a1" },
    { id: "e5", source: "a", target: "a2" },
]

describe.each(FAMILY_WRAPS)("FlowGraph under %s", (_family, wrap) => {
    it("names the graph and draws one element per node", () => {
        const { container } = render(wrap(<FlowGraph label="Second brain" nodes={nodes} edges={edges} />))
        const figure = screen.getByRole("figure", { name: "Second brain" })
        expect(figure.getAttribute("data-component")).toBe("FlowGraph")
        expect(figure.getAttribute("data-tier")).toBe("branch")
        expect(container.querySelectorAll(".react-flow__node")).toHaveLength(nodes.length)
        expect(container.querySelector(".react-flow__attribution")).toBeNull()
    })

    it("repeats the nodes in a visually hidden list with their counts", () => {
        const { container } = render(wrap(<FlowGraph label="Second brain" nodes={nodes} edges={edges} />))
        const items = [...container.querySelectorAll("[data-grammar-flow-fallback] li")].map((item) => item.textContent)
        expect(items).toEqual(["Second brain", "People (12)", "Projects", "Ideas", "Ada", "Grace"])
    })

    it("marks placeholder nodes", () => {
        const { container } = render(wrap(<FlowGraph label="Map" nodes={nodes} edges={edges} />))
        expect([...container.querySelectorAll('[data-placeholder="true"]')].map((node) => node.getAttribute("data-grammar-flow-node"))).toEqual(["c"])
    })

    it("selects a node on click and on Enter or Space, and clears on Escape", () => {
        const onSelect = vi.fn()
        const { container } = render(wrap(<FlowGraph label="Map" nodes={nodes} edges={edges} onSelect={onSelect} />))
        const wrapper = (id: string) => container.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!
        fireEvent.click(wrapper("a"))
        expect(onSelect).toHaveBeenLastCalledWith("a")
        expect(container.querySelector('[data-grammar-selected="true"]')?.getAttribute("data-grammar-flow-node")).toBe("a")
        expect(wrapper("b").getAttribute("tabindex")).toBe("0")
        fireEvent.keyDown(wrapper("b"), { key: "Enter" })
        expect(onSelect).toHaveBeenLastCalledWith("b")
        fireEvent.keyDown(wrapper("a1"), { key: " " })
        expect(onSelect).toHaveBeenLastCalledWith("a1")
        fireEvent.keyDown(wrapper("a1"), { key: "Escape" })
        expect(onSelect).toHaveBeenLastCalledWith(null)
    })

    it("follows selectedId when controlled", () => {
        const { container } = render(wrap(<FlowGraph label="Map" nodes={nodes} edges={edges} selectedId="b" />))
        expect(container.querySelector('[data-grammar-selected="true"]')?.getAttribute("data-grammar-flow-node")).toBe("b")
    })

    it("shows emptyLabel and no canvas without nodes", () => {
        const { container } = render(wrap(<FlowGraph label="Map" nodes={[]} edges={[]} emptyLabel="Nothing connected yet." />))
        expect(screen.getByText("Nothing connected yet.")).toBeTruthy()
        expect(container.querySelector(".react-flow")).toBeNull()
    })

    it("hides the zoom controls when static and shows them when interactive", () => {
        const view = render(wrap(<FlowGraph label="Map" nodes={nodes} edges={edges} />))
        expect(view.container.querySelector(".react-flow__controls")).not.toBeNull()
        view.rerender(wrap(<FlowGraph label="Map" nodes={nodes} edges={edges} isInteractive={false} />))
        expect(view.container.querySelector(".react-flow__controls")).toBeNull()
        expect(view.container.querySelector('[data-grammar-flow-interactive="false"]')).not.toBeNull()
    })
})

describe("radialPositions", () => {
    const dist = (point: { x: number, y: number }, from = { x: 0, y: 0 }) => Math.hypot(point.x - from.x, point.y - from.y)

    it("puts the root in the centre and its children equidistant on a ring", () => {
        const positions = radialPositions(nodes, edges)
        expect(positions.get("root")).toEqual({ x: 0, y: 0 })
        const ring = ["a", "b", "c"].map((id) => dist(positions.get(id)!))
        expect(ring[0]).toBeGreaterThan(0)
        for (const radius of ring) expect(radius).toBeCloseTo(ring[0]!, 6)
        const [a, b, c] = ["a", "b", "c"].map((id) => positions.get(id)!)
        expect(dist(a!, b!)).toBeCloseTo(dist(b!, c!), 6)
    })

    it("puts grandchildren on an outer ring, nearest their own parent", () => {
        const positions = radialPositions(nodes, edges)
        const parent = positions.get("a")!
        for (const id of ["a1", "a2"]) {
            const point = positions.get(id)!
            expect(dist(point)).toBeGreaterThan(dist(parent))
            expect(dist(point, parent)).toBeLessThan(dist(point, positions.get("b")!))
        }
    })

    it("uses the first node as root when none is flagged, and ring-places unreachable nodes", () => {
        const positions = radialPositions([{ id: "x", label: "X" }, { id: "y", label: "Y" }, { id: "z", label: "Z" }], [{ id: "xy", source: "x", target: "y" }])
        expect(positions.get("x")).toEqual({ x: 0, y: 0 })
        expect(dist(positions.get("z")!)).toBeGreaterThan(0)
    })

    it("lays nothing out for no nodes", () => {
        expect(radialPositions([], []).size).toBe(0)
    })
})
