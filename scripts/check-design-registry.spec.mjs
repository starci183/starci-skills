import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { createHash } from "node:crypto"
import { checkDesignRegistry, revisionHash } from "./check-design-registry.mjs"

const layoutHash = "a".repeat(64)
const blockHash = "b".repeat(64)
const conditionInventory = (states) => [
    { family: "viewport", applicability: "applicable", evidence: "Desktop and mobile are product breakpoints.", values: ["desktop", "mobile"], stateIds: states.map((state) => state.id) },
    ...["overlay", "disclosure", "async", "data", "permission"].map((family) => ({ family, applicability: "not-applicable", evidence: `Fixture has no ${family} condition.`, values: [], stateIds: [] })),
    { family: "interaction", applicability: "applicable", evidence: "The primary control advances state.", values: ["advance"], stateIds: states.map((state) => state.id) },
]
const contentMatrix = (states) => states.map((state) => ({ stateId: state.id, entityKinds: ["course"], facts: ["Course title and progress"], actions: ["Continue"], densityReason: "Fixture represents the owned course state." }))
const functionalPreview = (states, element = "main") => `<!doctype html><html data-functional-preview="true"><head><style>@media(max-width:700px){body{margin:0}}</style><script>document.addEventListener("click",event=>{if(event.target.closest("[data-action]")) document.body.dataset.changed="true"})</script></head><body>${states.map((state) => `<template data-state="${state.id}"><${element} data-business-state="${state.id}"><button data-action="advance">Continue</button></${element}></template>`).join("")}</body></html>`

function fixture() {
    const root = mkdtempSync(join(tmpdir(), "starci-registry-check-"))
    mkdirSync(join(root, "objects", "sha256"), { recursive: true })
    mkdirSync(join(root, "layouts", "by-id"), { recursive: true })
    mkdirSync(join(root, "blocks", "by-id", "course-home"), { recursive: true })
    const layoutHead = { layoutId: "course-home", head: layoutHash, regions: ["hero"] }
    const blockHead = { layoutId: "course-home", blockId: "hero", layoutHash, head: blockHash }
    writeFileSync(join(root, "registry.json"), JSON.stringify({ schemaVersion: 2, project: "example", designRegistry: "design-registry-v2.json" }))
    writeFileSync(join(root, "objects", "sha256", `${layoutHash}.json`), JSON.stringify({ regions: [{ name: "hero" }] }))
    writeFileSync(join(root, "objects", "sha256", `${blockHash}.json`), JSON.stringify({ id: "hero" }))
    writeFileSync(join(root, "layouts", "by-id", "course-home.json"), JSON.stringify(layoutHead))
    writeFileSync(join(root, "blocks", "by-id", "course-home", "hero.json"), JSON.stringify(blockHead))
    writeFileSync(join(root, "design-registry-v2.json"), JSON.stringify({
        schemaVersion: 2,
        project: "example",
        layoutHeads: { "course-home": layoutHead },
        blockHeads: { "course-home/hero": blockHead },
        objects: { immutable: true, byHash: {
            [layoutHash]: { hash: layoutHash, path: `objects/sha256/${layoutHash}.json` },
            [blockHash]: { hash: blockHash, path: `objects/sha256/${blockHash}.json` },
        } },
    }))
    return root
}

test("accepts current identity heads without any session record", () => {
    assert.equal(checkDesignRegistry(fixture()).ok, true)
})

test("accepts v2 authority without the optional legacy registry metadata", () => {
    const root = fixture()
    rmSync(join(root, "registry.json"))
    assert.equal(checkDesignRegistry(root).ok, true)
})

test("refuses undeclared or stale block heads", () => {
    const root = fixture()
    const path = join(root, "design-registry-v2.json")
    const design = JSON.parse(readFileSync(path, "utf8"))
    design.blockHeads["course-home/hero"].layoutHash = "c".repeat(64)
    writeFileSync(path, JSON.stringify(design))
    const result = checkDesignRegistry(root)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some((failure) => failure.includes("stale layout hash")))
})

function bundleFixture(artifact = { regions: [{ name: "hero" }] }, states = [{ id: "desktop", viewport: { width: 1440, height: 900 } }]) {
    const root = mkdtempSync(join(tmpdir(), "starci-registry-bundle-check-"))
    const preview = functionalPreview(states)
    const previewSha256 = createHash("sha256").update(preview).digest("hex")
    const design = {
        schemaVersion: 2,
        kind: "layout",
        layoutId: "course-home",
        functional: true,
        principleObligations: [{ target: "course-home", module: "flow", situation: "FLOW-CONTENT-1", reason: "The fixture has one deliberate content flow." }],
        contentMatrix: contentMatrix(states),
        conditionInventory: conditionInventory(states),
        transitions: [{ id: "advance", from: states[0].id, action: "advance", to: states.at(-1).id }],
        artifact,
        states,
        previewSha256,
    }
    const hash = revisionHash(design)
    mkdirSync(join(root, "revisions", hash), { recursive: true })
    writeFileSync(join(root, "revisions", hash, "design.json"), JSON.stringify(design))
    writeFileSync(join(root, "revisions", hash, "preview.html"), preview)
    writeFileSync(join(root, "design-registry-v2.json"), JSON.stringify({
        schemaVersion: 2,
        project: "example",
        hashAlgorithm: "sha256",
        canonicalization: "RFC8785-JCS",
        layoutHeads: { "course-home": { layoutId: "course-home", head: hash, regions: ["hero"] } },
        blockHeads: {},
        revisions: { immutable: true, byHash: { [hash]: { hash, path: `revisions/${hash}` } } },
    }))
    return { root, hash }
}

function addBlockBundle(fixture, layoutHash = fixture.hash) {
    const states = [{ id: "ready", viewport: { width: 960, height: 640 } }]
    const preview = functionalPreview(states, "section")
    const previewSha256 = createHash("sha256").update(preview).digest("hex")
    const design = {
        schemaVersion: 2,
        kind: "block",
        layoutId: "course-home",
        blockId: "hero",
        layoutHash,
        artifact: { id: "hero-card" },
        functional: true,
        principleObligations: [{ target: "hero", module: "alignment", situation: "ALIGN-AXIS-1", reason: "The hero aligns its content on one axis." }],
        contentMatrix: contentMatrix(states),
        conditionInventory: conditionInventory(states),
        transitions: [{ id: "advance", from: "ready", action: "advance", to: "ready" }],
        states,
        previewSha256,
    }
    const hash = revisionHash(design)
    mkdirSync(join(fixture.root, "revisions", hash), { recursive: true })
    writeFileSync(join(fixture.root, "revisions", hash, "design.json"), JSON.stringify(design))
    writeFileSync(join(fixture.root, "revisions", hash, "preview.html"), preview)
    const registryPath = join(fixture.root, "design-registry-v2.json")
    const registry = JSON.parse(readFileSync(registryPath, "utf8"))
    registry.revisions.byHash[hash] = { hash, path: `revisions/${hash}` }
    registry.blockHeads["course-home/hero"] = { layoutId: "course-home", blockId: "hero", layoutHash: fixture.hash, head: hash }
    writeFileSync(registryPath, JSON.stringify(registry))
    return hash
}

test("accepts a two-file revision bundle without legacy projections", () => {
    assert.equal(checkDesignRegistry(bundleFixture().root).ok, true)
})

test("accepts a composed page revision whose existing layouts and preview state are source-bound", () => {
    const artifact = {
        id: "course-page",
        regions: [{ name: "hero", pageId: "lesson", change: "proposed" }],
        pages: [{
            id: "lesson", route: "/courses/course/learn/lesson", state: "lesson-ready", regions: ["hero"],
            nodes: [{ id: "app-shell", kind: "app-layout", change: "existing", source: "src/app/layout.tsx", sourceHash: "c".repeat(64) }],
        }],
    }
    assert.equal(checkDesignRegistry(bundleFixture(artifact, [{ id: "lesson-ready", viewport: { width: 1440, height: 900 } }]).root).ok, true)
})

test("refuses a composed page whose page state or existing source evidence is absent", () => {
    const artifact = {
        id: "course-page",
        regions: [{ name: "hero", pageId: "lesson", change: "proposed" }],
        pages: [{
            id: "lesson", route: "/courses/course/learn/lesson", state: "lesson-ready", regions: ["hero"],
            nodes: [{ id: "app-shell", kind: "app-layout", change: "existing", source: "src/app/layout.tsx" }],
        }],
    }
    const result = checkDesignRegistry(bundleFixture(artifact).root)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some((failure) => failure.includes("no matching preview state")))
    assert.ok(result.failures.some((failure) => failure.includes("lacks source evidence")))
})

test("accepts a block bundle bound to the current layout revision", () => {
    const fixture = bundleFixture()
    addBlockBundle(fixture)
    assert.equal(checkDesignRegistry(fixture.root).ok, true)
})

test("refuses a block bundle authored under another layout revision", () => {
    const fixture = bundleFixture()
    addBlockBundle(fixture, "c".repeat(64))
    const result = checkDesignRegistry(fixture.root)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some((failure) => failure.includes("parent layout")))
})

test("refuses preview mutation after a revision is accepted", () => {
    const { root, hash } = bundleFixture()
    writeFileSync(join(root, "revisions", hash, "preview.html"), "<main>mutated</main>")
    const result = checkDesignRegistry(root)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some((failure) => failure.includes("preview.html digest")))
})

test("refuses metadata mutation even when preview digest still matches", () => {
    const { root, hash } = bundleFixture()
    const path = join(root, "revisions", hash, "design.json")
    const design = JSON.parse(readFileSync(path, "utf8"))
    design.states[0].viewport.width = 1280
    writeFileSync(path, JSON.stringify(design))
    const result = checkDesignRegistry(root)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some((failure) => failure.includes("revision digest")))
})
