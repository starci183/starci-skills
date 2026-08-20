import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { checkDesignRegistry } from "./check-design-registry.mjs"

const layoutHash = "a".repeat(64)
const blockHash = "b".repeat(64)

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
