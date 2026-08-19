import assert from "node:assert/strict"
import test from "node:test"
import { resolve } from "node:path"
import { inventorySonarRoutes } from "./sonar-source-credentials.mjs"

test("inventories one distinct project-analysis identity for every routed source role", () => {
    const sourceRoot = resolve(import.meta.dirname, "../..")
    const rows = inventorySonarRoutes(sourceRoot)
    assert.equal(rows.length, 8)
    assert.deepEqual(new Set(rows.map((row) => row.key)).size, rows.length)
    assert(rows.every((row) => row.github.startsWith("starci-lab/")))
    assert(rows.every((row) => row.record.endsWith(".key")))
})
