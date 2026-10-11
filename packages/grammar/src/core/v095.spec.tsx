import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { COMMON_GRAMMAR_COMPONENTS } from "../common/index.js"

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")
const css = read("../common/components-navigation.css")
const flowCss = css.slice(css.indexOf("/* ---------- FlowGraph"))
const packageJson = JSON.parse(read("../../package.json")) as { version: string, dependencies?: object, peerDependencies: Record<string, string>, devDependencies: Record<string, string> }

describe("0.9.5: FlowGraph", () => {
    it("is a Common renderer and the package is at 0.9.5", () => {
        expect(Object.keys(COMMON_GRAMMAR_COMPONENTS)).toContain("FlowGraph")
        expect(packageJson.version).toBe("0.9.5")
    })

    it("keeps @xyflow/react a peer (plus a dev copy for tests), never a dependency", () => {
        expect(packageJson.dependencies).toBeUndefined()
        expect(packageJson.peerDependencies["@xyflow/react"]).toMatch(/^\^12\./)
        expect(packageJson.devDependencies["@xyflow/react"]).toMatch(/^12\.\d+\.\d+$/)
    })

    it("is a client module that needs no stylesheet import from the host", () => {
        const source = read("./branch/FlowGraph/index.tsx")
        expect(source.startsWith('"use client"')).toBe(true)
        expect(source).not.toMatch(/@xyflow\/react\/dist\/.*\.css/)
        expect(flowCss).toContain(".starci-core-flow-graph .react-flow__viewport")
        expect(flowCss).toContain(".starci-core-flow-graph .react-flow__node {")
    })

    it("paints with grammar tokens only, no hex colours, and draws placeholder edges dashed", () => {
        expect(flowCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
        expect(flowCss).toContain("stroke: var(--xy-edge-stroke)")
        expect(flowCss).toContain("--xy-edge-stroke: var(--separator")
        expect(flowCss).toMatch(/edge-placeholder \.react-flow__edge-path \{ stroke-dasharray/)
        for (const token of ["--accent-soft", "--success-soft", "--warning-soft", "--danger-soft"]) expect(flowCss).toContain(token)
    })

    it("fixes the three canvas heights and never animates edges under reduced motion", () => {
        expect(flowCss).toContain("block-size: 24rem")
        expect(flowCss).toContain("block-size: 16rem")
        expect(flowCss).toContain("block-size: 32rem")
        expect(flowCss).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.starci-core-flow-graph \.react-flow__edge\.animated path \{ animation: none/)
    })

    it("is in the changelog", () => {
        expect(read("../../CHANGELOG.md")).toMatch(/^## 0\.9\.5 - 2026-10-11/m)
    })
})
