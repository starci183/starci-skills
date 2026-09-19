import assert from "node:assert/strict"
import test from "node:test"
import { COMMON_GRAMMAR_COMPONENTS, COMMON_UI_RULE_IDS, PRESENTATION_STATES, Sidebar, TextAction, WorkspaceShell, assertPresentationState, defineGrammarFamily, isPresentationState } from "../../dist/common/index.js"
test("exports the neutral presentation state vocabulary", () => {
    assert.equal(PRESENTATION_STATES.length, 7)
    assert.equal(isPresentationState("affirmative"), true)
    assert.equal(isPresentationState("unknown"), false)
    assert.doesNotThrow(() => assertPresentationState("pending"))
    assert.throws(() => assertPresentationState("unknown"), TypeError)
})

test("owns the shared family base and canonical X-n catalog", () => {
    assert.equal(COMMON_GRAMMAR_COMPONENTS.TextAction, TextAction)
    assert.equal(typeof defineGrammarFamily, "function")
    assert.equal(COMMON_UI_RULE_IDS.length, 150)
})

test("exports anonymous shared renderers from the common authority", () => {
    assert.equal(typeof TextAction, "function")
    assert.equal(typeof Sidebar, "function")
    assert.equal(typeof WorkspaceShell, "function")
})
