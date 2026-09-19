import assert from "node:assert/strict"
import test from "node:test"
import * as core from "../../dist/core/index.js"
import * as common from "../../dist/common/index.js"

test("exports Core DNA and the typed family registry boundary", () => {
    assert.equal(core.STARCI_CORE_DNA.id, "starci-core")
    assert.equal(core.STARCI_CORE_DNA.color.accent, "#7547ff")
    assert.deepEqual(core.STARCI_CORE_SPACING_SCALE, {
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
    assert.equal(core.STARCI_CORE_TOKEN_NAMES.surface, "--starci-core-surface")
    assert.equal(
        core.STARCI_CORE_TOKEN_DEFAULTS[core.STARCI_CORE_TOKEN_NAMES.surface],
        core.STARCI_CORE_DNA.color.light.surface,
    )
    assert.equal(Object.isFrozen(core.STARCI_CORE_DNA), true)
    assert.equal(Object.isFrozen(core.CORE_GRAMMAR_COMPONENTS), true)
    assert.equal(typeof core.CORE_GRAMMAR_COMPONENTS.GrammarRoot, "function")
    assert.equal(typeof core.CORE_GRAMMAR_COMPONENTS.WorkspaceShell, "function")
    assert.equal(typeof core.CORE_GRAMMAR_COMPONENTS.TextAction, "function")
    assert.equal("DashboardShell" in core.CORE_GRAMMAR_COMPONENTS, false)
    assert.equal(typeof core.defineGrammarFamily, "function")
    assert.equal(core.coreGrammar.id, "core")
    assert.deepEqual(core.coreGrammar.scopeProps, { "data-grammar-family": "core" })
    assert.equal(core.coreRuleConformance.inheritedCommonRules.length, 150)
})

test("resolves a scoped family and re-exports every Common renderer from Core", () => {
    const Brand = () => null
    const family = core.defineGrammarFamily({
        id: "heritage",
        styles: {
            entrypoint: "@starci/grammar/heritage/styles.css",
            scope: { attribute: "data-grammar-family", value: "heritage" },
        },
        components: {
            replacements: {},
            extensions: { Brand },
        },
    })

    assert.equal(family.id, "heritage")
    assert.equal(family.styles.entrypoint, "@starci/grammar/heritage/styles.css")
    assert.deepEqual(family.scopeProps, { "data-grammar-family": "heritage" })
    assert.equal(family.components.Brand, Brand)
    assert.equal(Object.isFrozen(family.components), true)
    // The Core entry is the family's complete surface: every Common renderer, the same object as in Common,
    // plus the family root. A consumer imports renderers and CoreGrammarRoot from one entry.
    assert.equal("Button" in core, true)
    assert.equal(core.Button, common.Button)
    assert.equal(core.WorkspaceShell, common.WorkspaceShell)
    assert.equal(core.SurfaceCard, common.SurfaceCard)
    assert.equal(typeof core.CoreGrammarRoot, "function")
    assert.notEqual(core.CoreGrammarRoot, common.GrammarRoot)
})
