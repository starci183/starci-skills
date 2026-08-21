import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { resolveGrammar } from "./resolve-fe-grammar.mjs"
import { loadAndValidateGrammar } from "./validate-fe-grammar.mjs"
import { verifyDesignGrammar } from "./verify-design-grammar.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const grammarRoot = join(root, "compilers", "grammars", "starci")
const profilePath = join(grammarRoot, "profiles", "starci-academy.json")
const loaded = loadAndValidateGrammar(grammarRoot)
const profile = JSON.parse(readFileSync(profilePath, "utf8"))

function fixture() {
  const resolved = resolveGrammar({
    grammar: loaded.grammar,
    profile,
    factCatalog: loaded.factCatalog,
    evidenceCatalog: loaded.evidenceCatalog,
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

test("accepted design grammar recomputes byte-identically", () => {
  assert.equal(verifyDesignGrammar({design: fixture(), grammarRoot, profilePath}).decisions.length, 1)
})

test("decision drift is refused before source execution", () => {
  const design = fixture()
  design.grammarDecisions[0].outcome = "invented-owner"
  assert.throws(() => verifyDesignGrammar({design, grammarRoot, profilePath}), /decisions are stale/)
})
