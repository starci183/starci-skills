import assert from "node:assert/strict"
import test from "node:test"
import { badgeUrls, checkUrl, classifyBadge } from "./check.mjs"

test("extracts only provider image URLs", () => {
    assert.deepEqual(badgeUrls(`![x](https://example.com/x.svg) ![c](https://codecov.io/gh/o/r/graph/badge.svg) ![s](https://sonar.test/api/project_badges/measure?project=p&metric=bugs)`), [
        "https://codecov.io/gh/o/r/graph/badge.svg",
        "https://sonar.test/api/project_badges/measure?project=p&metric=bugs",
    ])
})

test("rejects error SVG returned with HTTP 200", () => {
    assert.deepEqual(classifyBadge("https://sonar.test/badge", 200, "image/svg+xml", "<svg><text>Project has not been found</text></svg>"), [
        "semantic error badge",
    ])
})

test("rejects credential-bearing badge before network", async () => {
    let called = false
    const result = await checkUrl("https://sonar.test/badge?token=secret", async () => {
        called = true
    })
    assert.equal(called, false)
    assert.deepEqual(result.failures, ["credential-bearing URL"])
})

test("accepts a semantic SVG metric", () => {
    assert.deepEqual(classifyBadge("https://sonar.test/badge", 200, "image/svg+xml", "<svg><text>coverage 76.8%</text></svg>"), [])
})
