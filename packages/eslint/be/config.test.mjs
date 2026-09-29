/**
 * Twin tests for the back-end config factory.
 *
 *   node --test config.test.mjs
 *
 * The failures worth catching: a rule published switched off (a rule the standard no longer holds is deleted, so
 * an `off` is a rule that looks adopted and is not), a repository block that ends up with no rules and lints
 * green, a `warn` that survives into a zero-warning gate, and the two public-surface rules HFS once had to
 * switch off drifting back out of the block.
 */
import assert from "node:assert/strict"
import test from "node:test"
import plugin, { linterOptions, recommended, starciBeConfig } from "./index.mjs"

const SOURCES = ["apps/**/*.ts", "src/**/*.ts"]

test("no published rule is off", () => {
    const off = Object.entries(recommended).filter(([, setting]) => (Array.isArray(setting) ? setting[0] : setting) === "off")
    assert.deepEqual(off, [])
})

test("the block carries every recommended rule, none off, and none left at warn", () => {
    const block = starciBeConfig({ sources: SOURCES, plugin, recommended })
    assert.deepEqual(block.files, SOURCES)
    assert.deepEqual(Object.keys(block.rules).sort(), Object.keys(recommended).sort())
    for (const [name, setting] of Object.entries(block.rules)) {
        const level = Array.isArray(setting) ? setting[0] : setting
        assert.notEqual(level, "off", `${name} is off in the block`)
        assert.equal(level, "error", `${name} is not an error in a zero-warning gate`)
    }
    assert.equal(block.plugins["starci-be"], plugin)
    assert.deepEqual(block.linterOptions, linterOptions)
})

test("the two public-surface rules are on and accept the HFS index surface", () => {
    const block = starciBeConfig({ sources: SOURCES, plugin, recommended })
    assert.equal(block.rules["starci-be/must-deep-module-import"], "error")
    assert.equal(block.rules["starci-be/no-folder-reexport"], "error")
})

test("a warn with options stays configured and becomes error", () => {
    const block = starciBeConfig({
        sources: SOURCES,
        plugin,
        recommended: { ...recommended, "starci-be/probe": ["warn", { max: 3 }] },
    })
    assert.deepEqual(block.rules["starci-be/probe"], ["error", { max: 3 }])
})

test("a recommendation with a rule switched off is refused, never published", () => {
    assert.throws(
        () => starciBeConfig({ sources: SOURCES, plugin, recommended: { ...recommended, "starci-be/probe": "off" } }),
        /switched off: starci-be\/probe/,
    )
    assert.throws(
        () => starciBeConfig({ sources: SOURCES, plugin, recommended: { ...recommended, "starci-be/probe": ["off"] } }),
        /switched off/,
    )
})

test("an empty recommendation or empty sources is refused, never a silent empty block", () => {
    assert.throws(() => starciBeConfig({ sources: SOURCES, plugin, recommended: {} }), /empty recommendation/)
    assert.throws(() => starciBeConfig({ sources: SOURCES, plugin, recommended: undefined }), /empty recommendation/)
    assert.throws(() => starciBeConfig({ sources: [], plugin, recommended }), /source globs/)
})
