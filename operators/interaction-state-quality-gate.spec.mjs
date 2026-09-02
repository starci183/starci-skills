import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const operatorsRoot = path.dirname(fileURLToPath(import.meta.url))
const claudeRoot = path.dirname(operatorsRoot)

test("interaction state parity is a fail-closed UI quality gate", () => {
    const quality = readFileSync(path.join(claudeRoot, "knowledge", "ui-quality-review.md"), "utf8")
    const affordance = readFileSync(path.join(claudeRoot, "knowledge", "ui", "states-affordance.md"), "utf8")
    const execute = readFileSync(path.join(operatorsRoot, "test", "ui-quality-audit", "execute.md"), "utf8")

    assert.match(quality, /uiq\.interaction\.scope-state-parity/)
    assert.match(quality, /inline action changes only its named text\/CTA/)
    assert.match(quality, /whole-surface action changes the complete hit target/)
    assert.match(quality, /static surface has no hover treatment/)
    assert.match(quality, /focus-visible/)
    assert.match(quality, /pressed\/active/)
    assert.match(quality, /selected, expanded, pending and disabled/)
    assert.match(quality, /reduced motion/)

    assert.match(affordance, /hit-target ownership/)
    assert.match(affordance, /never by whether content happens\s+to contain a title/)
    assert.match(execute, /Apply the `uiq\.interaction\.scope-state-parity` gate/)
    assert.match(execute, /Fail when feedback leaks outside an inline target/)
    assert.match(execute, /DOM class presence, and source intent cannot pass this gate/)
})
