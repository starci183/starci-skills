import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { resolve } from "node:path"
import { inventorySonarRoutes, reconcileSonarBadgeMarkdown } from "./sonar-source-credentials.mjs"

test("inventories one distinct project-analysis identity for every routed source role", () => {
    const sourceRoot = resolve(import.meta.dirname, "../..")
    const rows = inventorySonarRoutes(sourceRoot)
    assert.equal(rows.length, 8)
    assert.deepEqual(new Set(rows.map((row) => row.key)).size, rows.length)
    assert(rows.every((row) => row.github.startsWith("starci-lab/")))
    assert(rows.every((row) => row.record.endsWith(".key")))
})

test("reconciles a complete private-project Sonar badge block without touching Codecov", () => {
    const input = `# Example\n\n[![Codecov](https://codecov.io/gh/o/r/graph/badge.svg?token=codecov-read-only)](https://codecov.io/gh/o/r)\n[![Old Sonar](https://old.test/api/project_badges/measure?project=old&metric=bugs)](https://old.test/dashboard?id=old)\n\nBody\n`
    const result = reconcileSonarBadgeMarkdown(input, {
        host: "https://sonar.starci.org",
        projectKey: "example-be",
        badgeToken: "sonar-read-only",
    })
    assert.match(result, /codecov-read-only/)
    assert.equal((result.match(/api\/project_badges\/measure/g) ?? []).length, 8)
    assert.equal((result.match(/token=sonar-read-only/g) ?? []).length, 8)
    assert.doesNotMatch(result, /old\.test|project=old/)
    assert.equal(reconcileSonarBadgeMarkdown(result, {
        host: "https://sonar.starci.org",
        projectKey: "example-be",
        badgeToken: "sonar-read-only",
    }), result)
})

test("refuses to write a private Sonar badge without its separate read-only capability", () => {
    assert.throws(() => reconcileSonarBadgeMarkdown("# Example\n", {
        host: "https://sonar.starci.org",
        projectKey: "example-be",
        badgeToken: "",
    }), /project badge token is absent/)
})

test("authority probing is an explicit value-free mode", () => {
    const source = readFileSync(new URL("./sonar-source-credentials.mjs", import.meta.url), "utf8")
    assert.match(source, /--check-authority/)
    assert.match(source, /stored-admin-valid/)
    assert.match(source, /operator-intake-required/)
})
