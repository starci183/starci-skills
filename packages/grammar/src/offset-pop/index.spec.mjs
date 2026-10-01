import assert from "node:assert/strict"
import test from "node:test"
import * as offsetPop from "../../dist/offset-pop/index.js"
import * as common from "../../dist/common/index.js"

test("exports Offset Pop DNA, its token contract and the family registry boundary", () => {
    assert.equal(offsetPop.OFFSET_POP_DNA.id, "offset-pop")
    assert.equal(offsetPop.OFFSET_POP_DNA.version, 1)
    assert.equal(offsetPop.OFFSET_POP_DNA.color.accent, "#ff3593")
    assert.equal(offsetPop.OFFSET_POP_DNA.offset.x, "0.25rem")
    assert.equal(offsetPop.OFFSET_POP_DNA.palette.pink, offsetPop.OFFSET_POP_DNA.color.accent)
    assert.deepEqual(offsetPop.OFFSET_POP_SPACING_SCALE, {
        "0": "0rem",
        "0.5": "0.125rem",
        "1": "0.25rem",
        "1.5": "0.375rem",
        "2": "0.5rem",
        "2.5": "0.625rem",
        "3": "0.75rem",
        "4": "1rem",
        "5": "1.25rem",
        "6": "1.5rem",
        "8": "2rem",
        "10": "2.5rem",
        "12": "3rem",
        "16": "4rem",
    })
    assert.equal(offsetPop.OFFSET_POP_TOKEN_NAMES.surface, "--offset-pop-surface")
    assert.equal(offsetPop.OFFSET_POP_TOKEN_NAMES.shadowX, "--offset-pop-shadow-x")
    assert.equal(
        offsetPop.OFFSET_POP_TOKEN_DEFAULTS[offsetPop.OFFSET_POP_TOKEN_NAMES.surface],
        offsetPop.OFFSET_POP_DNA.color.light.surface,
    )
    assert.equal(
        offsetPop.OFFSET_POP_DARK_TOKEN_DEFAULTS[offsetPop.OFFSET_POP_TOKEN_NAMES.canvas],
        offsetPop.OFFSET_POP_DNA.color.dark.canvas,
    )
    assert.equal(offsetPop.OFFSET_POP_BAND_TOKEN_NAMES.bandOffset, "--starci-core-band-offset")
    for (const value of [
        offsetPop.OFFSET_POP_DNA,
        offsetPop.OFFSET_POP_SPACING_SCALE,
        offsetPop.OFFSET_POP_TOKEN_NAMES,
        offsetPop.OFFSET_POP_TOKEN_DEFAULTS,
        offsetPop.OFFSET_POP_DARK_TOKEN_DEFAULTS,
        offsetPop.OFFSET_POP_BAND_TOKEN_NAMES,
    ]) {
        assert.equal(Object.isFrozen(value), true)
    }
    assert.equal(offsetPop.offsetPopGrammar.id, "offset-pop")
    assert.deepEqual(offsetPop.offsetPopGrammar.scopeProps, { "data-grammar-family": "offset-pop" })
    assert.equal(offsetPop.offsetPopGrammar.styles.entrypoint, "@starci/grammar/offset-pop/styles.css")
    assert.equal(offsetPop.offsetPopRuleConformance.familyId, "offset-pop")
    assert.equal(typeof offsetPop.OFFSET_POP_FAMILY_EVIDENCE, "object")
    const covered = new Set([
        ...offsetPop.offsetPopRuleConformance.inheritedCommonRules,
        ...Object.keys(offsetPop.offsetPopRuleConformance.familyEvidence),
    ])
    assert.deepEqual(covered, new Set(common.COMMON_UI_RULE_IDS))
})

test("re-exports every Common renderer from Offset Pop and installs its own root", () => {
    // The Offset Pop entry is the family's complete surface, exactly like Core: every Common renderer, the
    // same object as in Common, plus the family root. A consumer imports both from one entry.
    for (const name of Object.keys(common.COMMON_GRAMMAR_COMPONENTS)) {
        if (name === "GrammarRoot") continue
        assert.equal(offsetPop[name], common[name], `${name} is not the Common renderer`)
    }
    assert.equal(offsetPop.Button, common.Button)
    assert.equal(offsetPop.WorkspaceShell, common.WorkspaceShell)
    assert.equal(offsetPop.SurfaceCard, common.SurfaceCard)
    assert.equal(typeof offsetPop.defineGrammarFamily, "function")
    assert.equal(typeof offsetPop.OffsetPopGrammarRoot, "function")
    assert.notEqual(offsetPop.OffsetPopGrammarRoot, common.GrammarRoot)
    assert.equal(offsetPop.offsetPopGrammar.components.GrammarRoot, offsetPop.OffsetPopGrammarRoot)
    assert.equal(offsetPop.offsetPopGrammar.components.Button, common.Button)
})
