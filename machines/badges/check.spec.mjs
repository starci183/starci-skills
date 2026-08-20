import assert from "node:assert/strict"
import test from "node:test"
import { badgeUrls, checkUrl, classifyBadge, credentialFailure, redactBadgeUrl } from "./check.mjs"

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

test("accepts provider-issued read-only token on a Codecov badge endpoint", async () => {
    let called = false
    const result = await checkUrl("https://codecov.io/gh/o/r/graph/badge.svg?token=badge-read-only", async () => {
        called = true
        return new Response("<svg><text>coverage 81%</text></svg>", { headers: { "content-type": "image/svg+xml" } })
    })
    assert.equal(called, true)
    assert.deepEqual(result, { url: "https://codecov.io/gh/o/r/graph/badge.svg?token=REDACTED", failures: [] })
})

test("accepts provider-issued read-only token on a Sonar badge endpoint", () => {
    assert.equal(credentialFailure("https://sonar.test/api/project_badges/measure?project=p&metric=bugs&token=badge-read-only"), null)
})

test("rejects token outside an official provider badge endpoint before network", async () => {
    let called = false
    const result = await checkUrl("https://sonar.test/badge?token=secret", async () => {
        called = true
    })
    assert.equal(called, false)
    assert.deepEqual(result.failures, ["credential-bearing URL"])
    assert.equal(result.url, "https://sonar.test/badge?token=REDACTED")
})

test("rejects API credentials even on a provider badge endpoint", () => {
    assert.equal(credentialFailure("https://codecov.io/gh/o/r/graph/badge.svg?access_token=secret"), "credential-bearing URL")
    assert.equal(credentialFailure("https://sonar.test/api/project_badges/measure?project=p&metric=bugs&api_key=secret"), "credential-bearing URL")
})

test("rejects opaque query parameters on provider badge endpoints", () => {
    assert.equal(credentialFailure("https://codecov.io/gh/o/r/graph/badge.svg?opaque=secret"), "unsupported badge query")
    assert.equal(credentialFailure("https://sonar.test/api/project_badges/measure?project=p&metric=bugs&opaque=secret"), "unsupported badge query")
})

test("redacts badge token without changing provider routing", () => {
    assert.equal(
        redactBadgeUrl("https://sonar.test/api/project_badges/measure?project=p&metric=coverage&token=secret"),
        "https://sonar.test/api/project_badges/measure?project=p&metric=coverage&token=REDACTED",
    )
})

test("accepts a semantic SVG metric", () => {
    assert.deepEqual(classifyBadge("https://sonar.test/badge", 200, "image/svg+xml", "<svg><text>coverage 76.8%</text></svg>"), [])
})
