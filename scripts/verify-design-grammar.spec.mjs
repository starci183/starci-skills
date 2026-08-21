import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { resolveGrammar } from "./resolve-fe-grammar.mjs"
import { loadAndValidateGrammar } from "./validate-fe-grammar.mjs"
import { verifyDesignGrammar } from "./verify-design-grammar.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const grammarRoot = join(root, "grammars", "starci")
const profilePath = join(grammarRoot, "profiles", "starci-academy.json")
const loaded = loadAndValidateGrammar(grammarRoot)
const profile = JSON.parse(readFileSync(profilePath, "utf8"))

function fixture() {
  const resolved = resolveGrammar({
    grammar: loaded.grammar,
    profile,
    factCatalog: loaded.factCatalog,
    evidenceCatalog: loaded.evidenceCatalog,
    rulingCatalog: loaded.rulingCatalog,
    designSystem: loaded.designSystem,
    templateCatalog: loaded.templateCatalog,
    facts: ["boundary-shared", "collection-peer"],
  })
  return {
    grammar: "starci",
    grammarProfile: "starci-academy",
    grammarFacts: resolved.facts,
    grammarDecisions: resolved.decisions,
    grammarReceipt: resolved.receipt,
  }
}

test("session design grammar and MASTER recompute byte-identically", () => {
  assert.equal(verifyDesignGrammar({design: fixture(), grammarRoot, profilePath}).decisions.length, 1)
})

test("decision drift is refused before source execution", () => {
  const design = fixture()
  design.grammarDecisions[0].outcome = "invented-owner"
  assert.throws(() => verifyDesignGrammar({design, grammarRoot, profilePath}), /decisions are stale/)
})

function dashboardFixture() {
  const resolved = resolveGrammar({
    grammar: loaded.grammar,
    profile,
    factCatalog: loaded.factCatalog,
    evidenceCatalog: loaded.evidenceCatalog,
    rulingCatalog: loaded.rulingCatalog,
    designSystem: loaded.designSystem,
    templateCatalog: loaded.templateCatalog,
    facts: ["surface-dashboard-console"],
  })
  const contract = resolved.decisions[0].owner.visualContract
  const roles = Object.fromEntries(Object.entries(contract.roles).map(([role, token]) => [role, {
    verdict: "new",
    token,
    value: contract.tokens[token],
    why: "The routed grammar locks this dashboard theme token.",
  }]))
  return {
    grammar: "starci",
    grammarProfile: "starci-academy",
    grammarFacts: resolved.facts,
    grammarDecisions: resolved.decisions,
    grammarReceipt: resolved.receipt,
    artifact: { direction: { axes: structuredClone(contract.axes), roles, lockedTokens: structuredClone(contract.tokens) } },
  }
}

function dashboardPreview(design) {
  const tokens = design.artifact.direction.lockedTokens
  const declarations = Object.entries(tokens).map(([token, value]) => `${token}:${value};`).join("")
  const uses = Object.keys(tokens).map((token) => `var(${token})`).join(" ")
  return `<html><head><style>:root{${declarations}}.theme-proof{--grammar-token-uses:${uses};}</style></head><body><template data-state="dashboard"><main data-visual-contract="starci-dashboard-theme"><div class="theme-proof" data-theme-role="selected">Dashboard</div></main></template></body></html>`
}

test("dashboard visual contract accepts only its exact StarCi theme", () => {
  const design = dashboardFixture()
  assert.equal(verifyDesignGrammar({design, grammarRoot, profilePath, preview: dashboardPreview(design)}).decisions.length, 1)
})

test("dashboard visual contract refuses a project-local accent substitution", () => {
  const design = dashboardFixture()
  design.artifact.direction.lockedTokens["--starci-accent"] = "oklch(62% 0.2 253)"
  assert.throws(() => verifyDesignGrammar({design, grammarRoot, profilePath, preview: dashboardPreview(design)}), /token values differ/)
})

test("dashboard visual contract refuses cobalt CSS even when metadata is exact", () => {
  const design = dashboardFixture()
  const preview = dashboardPreview(design).replace("</style>", ".bypass{color:#176bd6}</style>")
  assert.throws(() => verifyDesignGrammar({design, grammarRoot, profilePath, preview}), /raw palette value outside/)
})
