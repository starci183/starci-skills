import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const digest = "a".repeat(64)
const tokens = ["ground", "surface", "content", "muted", "accent", "separator", "display", "body", "label", "radius", "elevation", "duration", "easing"]
const roleToken = (token) => ({ verdict: "reuse", token: `--${token}` })
const direction = {
    id: "calm-command",
    vocabularyAt: digest,
    axes: { contrast: "balanced", density: "balanced", shape: "soft", depth: "flat", motion: "still" },
    citesPrecedent: "none",
    personality: ["calm", "precise", "focused"],
    roles: {
        ground: roleToken("ground"), surface: roleToken("surface"), content: roleToken("content"),
        mutedContent: roleToken("muted"), accent: roleToken("accent"), separator: roleToken("separator"),
        display: roleToken("display"), body: roleToken("body"), label: roleToken("label"), radius: roleToken("radius"),
        elevation: roleToken("elevation"), duration: roleToken("duration"), easing: roleToken("easing"),
    },
    rejects: ["decorative noise"],
    reason: "Keep the page focused on the learner task.",
}

const existingShell = {
    id: "app-shell", kind: "app-layout", change: "existing",
    source: "src/app/layout.tsx", sourceHash: "b".repeat(64),
}

const region = (pageId, name) => ({
    name, pageId, change: "proposed",
    entry: { verdict: "reuse", key: "content-panel" },
    assembler: "Tree", mount: "per-route", whyMatch: "The page needs one readable content region.",
    geometry: { placement: "main", width: "wide", height: "content", align: "stretch" },
    brief: { kind: "content", title: "Content", summary: "The complete page content in reading order.", items: [{ role: "text", label: "Representative content" }] },
})

const axes = [
    { navigation: "navbar", evidence: "beside", secondary: "panel", chrome: "sticky" },
    { navigation: "rail", evidence: "beside", secondary: "panel", chrome: "sticky" },
    { navigation: "navbar", evidence: "below", secondary: "overlay", chrome: "scrolls" },
]

const pageCandidate = (id, axis, sourceHash = existingShell.sourceHash) => ({
    id, direction, axes: axis, citesPrecedent: id === "one" ? "none" : "course-page",
    pages: [{
        id: "lesson", route: "/courses/course/learn/lesson", state: "lesson-ready",
        nodes: [{ ...existingShell, sourceHash }, { id: "lesson-page", kind: "page", change: "proposed", parentId: "app-shell" }],
        regions: ["lesson-content"],
    }],
    regions: [region("lesson", "lesson-content")],
    reason: `Complete composed lesson choice ${id}.`,
})

function runArtifact(artifact) {
    const root = mkdtempSync(join(tmpdir(), "validate-page-set-"))
    const artifactPath = join(root, "artifact.json")
    const vocabularyPath = join(root, "vocabulary.json")
    writeFileSync(artifactPath, JSON.stringify(artifact))
    writeFileSync(vocabularyPath, JSON.stringify({
        schema: 1, root, digest, sources: ["tokens.css"],
        tokens: tokens.map((name) => ({ name: `--${name}`, declarations: [{ source: "tokens.css", value: name }] })),
    }))
    const result = spawnSync(process.execPath, [
        resolve("scripts/validate-artifact.mjs"), "--schema", resolve("brainstorms/layouts/schema.json"),
        "--data", artifactPath, "--vocabulary", vocabularyPath,
    ], { cwd: resolve("."), encoding: "utf8" })
    rmSync(root, { recursive: true, force: true })
    return result
}

const batch = (candidates, scope = { kind: "page", source: "screenshot" }) => ({
    schema: 4,
    envelope: { round: 1, project: "sample", surface: "course-learning", scope },
    candidates,
})

test("schema 4 accepts three complete single-page choices with source-bound existing layouts", () => {
    const result = runArtifact(batch(axes.map((axis, index) => pageCandidate(["one", "two", "three"][index], axis))))
    assert.equal(result.status, 0, result.stderr)
})

test("schema 5 keeps every page choice under StarCi MASTER with deviations only", () => {
    const candidates = axes.map((axis, index) => {
        const candidate = pageCandidate(["one", "two", "three"][index], axis)
        delete candidate.direction
        delete candidate.citesPrecedent
        candidate.systemId = "starci-master"
        candidate.pageOverride = {deviations: []}
        return candidate
    })
    const result = runArtifact({...batch(candidates), schema: 5})
    assert.equal(result.status, 0, result.stderr)
})

test("schema 5 refuses a candidate that silently omits MASTER", () => {
    const candidates = axes.map((axis, index) => {
        const candidate = pageCandidate(["one", "two", "three"][index], axis)
        delete candidate.direction
        delete candidate.citesPrecedent
        candidate.systemId = "starci-master"
        candidate.pageOverride = {deviations: []}
        return candidate
    })
    delete candidates[1].systemId
    const result = runArtifact({...batch(candidates), schema: 5})
    assert.notEqual(result.status, 0)
})

test("grammar-locked token values must match an existing vocabulary declaration", () => {
    const candidates = axes.map((axis, index) => pageCandidate(["one", "two", "three"][index], axis))
    for (const candidate of candidates) candidate.direction = { ...candidate.direction, lockedTokens: { "--accent": "rose" } }
    const result = runArtifact(batch(candidates))
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /vocabulary declarations differ from the grammar-locked value/)
})

test("schema 4 refuses an existing nested layout that drifts between choices", () => {
    const candidates = axes.map((axis, index) => pageCandidate(["one", "two", "three"][index], axis, index === 1 ? "c".repeat(64) : existingShell.sourceHash))
    const result = runArtifact(batch(candidates))
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /existing source-bound node differs/)
})

test("schema 4 refuses an existing node introduced in only one choice", () => {
    const candidates = axes.map((axis, index) => pageCandidate(["one", "two", "three"][index], axis))
    candidates[1].pages[0].nodes.push({
        id: "legacy-drawer", kind: "drawer", change: "existing", parentId: "app-shell",
        source: "src/components/legacy-drawer.tsx", sourceHash: "c".repeat(64),
    })
    const result = runArtifact(batch(candidates))
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /introduced in only this choice/)
})

test("schema 4 requires 3-4 complete candidates when a flow renders three pages", () => {
    const makeFlow = (id, axis) => {
        const pages = ["create-order", "review-order", "order-success"].map((pageId) => ({
            id: pageId, route: `/orders/${pageId}`, state: `${pageId}-ready`,
            nodes: [existingShell, { id: `${pageId}-page`, kind: "page", change: "new", parentId: "app-shell" }],
            regions: [`${pageId}-content`],
        }))
        return {
            id, direction, axes: axis, citesPrecedent: id === "one" ? "none" : "course-page",
            pages, regions: pages.map((page) => region(page.id, page.regions[0])),
            reason: `Complete order flow candidate ${id}.`,
        }
    }
    const ranked = runArtifact(batch(axes.map((axis, index) => makeFlow(["one", "two", "three"][index], axis)), { kind: "flow", source: "description" }))
    assert.equal(ranked.status, 0, ranked.stderr)
    const one = runArtifact(batch([makeFlow("one", axes[0])], { kind: "flow", source: "description" }))
    assert.notEqual(one.status, 0)
    assert.match(one.stderr, /requires 3-4 complete page-set choices/)
})
