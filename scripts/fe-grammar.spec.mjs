import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { resolveGrammar } from "../scripts/resolve-fe-grammar.mjs"
import { loadAndValidateGrammar } from "../scripts/validate-fe-grammar.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const GRAMMAR_ROOT = join(ROOT, "compilers", "grammars", "starci")
const PROFILE = JSON.parse(readFileSync(join(GRAMMAR_ROOT, "profiles", "starci-academy.json"), "utf8"))
const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`

const withGrammarCopy = (run) => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "starci-grammar-"))
  const grammarRoot = join(temporaryRoot, "starci")
  cpSync(GRAMMAR_ROOT, grammarRoot, { recursive: true })
  try {
    return run(grammarRoot)
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true })
  }
}

test("durable grammar evidence has rulings, both case kinds, existing hashed templates and compilable TSX", () => {
  const loaded = loadAndValidateGrammar(GRAMMAR_ROOT)
  assert.equal(loaded.grammar.evidenceCatalog, "./capsules.json")
  assert.equal("capsuleCatalog" in loaded.grammar, false)
  assert.ok(loaded.evidenceCatalog.capsules.length > 0)
  for (const capsule of loaded.evidenceCatalog.capsules) {
    assert.ok(capsule.rulings.length > 0, capsule.id)
    assert.ok(capsule.goldenCaseRefs.length > 0, capsule.id)
    assert.ok(capsule.counterexampleCaseRefs.length > 0, capsule.id)
    assert.match(loaded.templateCatalog[capsule.templateRef].content, /export const/)
  }
})

test("every golden and counterexample case resolves deterministically", () => {
  const loaded = loadAndValidateGrammar(GRAMMAR_ROOT)
  for (const item of loaded.cases) {
    const input = {
      grammar: loaded.grammar,
      profile: PROFILE,
      factCatalog: loaded.factCatalog,
      evidenceCatalog: loaded.evidenceCatalog,
      templateCatalog: loaded.templateCatalog,
    }
    const forward = resolveGrammar({ ...input, facts: item.facts })
    const reverse = resolveGrammar({ ...input, facts: [...item.facts].reverse() })
    assert.deepEqual(forward, reverse, `${item.caseId} depends on fact order`)
    const outcomes = forward.decisions.map((decision) => decision.outcome).sort()
    assert.deepEqual(outcomes, [...item.expectedOutcomes].sort(), item.caseId)
    for (const rejected of item.rejectedOutcomes) {
      assert.equal(outcomes.includes(rejected), false, `${item.caseId} emitted rejected outcome ${rejected}`)
    }
  }
})

test("stored source origin fields and active or legacy source evidence kinds are rejected", () => withGrammarCopy((grammarRoot) => {
  const evidenceFile = join(grammarRoot, "capsules.json")
  const evidence = JSON.parse(readFileSync(evidenceFile, "utf8"))
  evidence.capsules[0].remote = "forbidden"
  writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`)
  assert.throws(() => loadAndValidateGrammar(grammarRoot), /forbidden source origin field/)
}))

test("active-source and legacy-source cannot return as evidence kinds", () => withGrammarCopy((grammarRoot) => {
  const evidenceFile = join(grammarRoot, "capsules.json")
  const evidence = JSON.parse(readFileSync(evidenceFile, "utf8"))
  evidence.capsules[0].rulings = ["active-source"]
  writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`)
  assert.throws(() => loadAndValidateGrammar(grammarRoot), /forbidden source evidence kind/)
}))

test("a behavior capsule cannot be promoted without a founder ruling", () => withGrammarCopy((grammarRoot) => {
  const evidenceFile = join(grammarRoot, "capsules.json")
  const evidence = JSON.parse(readFileSync(evidenceFile, "utf8"))
  evidence.capsules[0].rulings = []
  writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`)
  assert.throws(() => loadAndValidateGrammar(grammarRoot), /requires founder rulings/)
}))

test("template bytes must match their durable hash", () => withGrammarCopy((grammarRoot) => {
  const evidence = JSON.parse(readFileSync(join(grammarRoot, "capsules.json"), "utf8"))
  const templateFile = resolve(grammarRoot, evidence.capsules[0].templateRef)
  writeFileSync(templateFile, `${readFileSync(templateFile, "utf8")}\n// drift`)
  assert.throws(() => loadAndValidateGrammar(grammarRoot), /template hash mismatch/)
}))

test("hashed templates still have to compile as TSX", () => withGrammarCopy((grammarRoot) => {
  const evidenceFile = join(grammarRoot, "capsules.json")
  const evidence = JSON.parse(readFileSync(evidenceFile, "utf8"))
  const templateFile = resolve(grammarRoot, evidence.capsules[0].templateRef)
  const invalid = "export const Broken = () => <div>"
  writeFileSync(templateFile, invalid)
  evidence.capsules[0].templateHash = sha256(invalid)
  writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`)
  assert.throws(() => loadAndValidateGrammar(grammarRoot), /template does not compile/)
}))

test("resolution loads only evidence, templates and facts selected by winning rules", () => {
  const loaded = loadAndValidateGrammar(GRAMMAR_ROOT)
  const resolved = resolveGrammar({
    grammar: loaded.grammar,
    profile: PROFILE,
    factCatalog: loaded.factCatalog,
    evidenceCatalog: loaded.evidenceCatalog,
    templateCatalog: loaded.templateCatalog,
    facts: ["boundary-shared", "collection-peer"],
  })
  assert.deepEqual(resolved.decisions.map((decision) => decision.outcome), ["surface-list"])
  assert.deepEqual(resolved.contextPack.facts.map((fact) => fact.id), ["boundary-shared", "collection-peer"])
  assert.deepEqual(resolved.contextPack.evidenceRefs, ["surface-list"])
  assert.deepEqual(resolved.contextPack.evidence.map((capsule) => capsule.id), ["surface-list"])
  assert.deepEqual(resolved.contextPack.templates.map((template) => template.templateRef), ["./templates/surface-list.template.tsx"])
  assert.deepEqual(resolved.contextPack.principleConcerns, [])
  const serialized = JSON.stringify(resolved.contextPack)
  assert.doesNotMatch(serialized, /hierarchical-disclosure|resizable-rail|typography/)
})

test("principle context contains only delta concerns for selected owners", () => {
  const loaded = loadAndValidateGrammar(GRAMMAR_ROOT)
  const resolved = resolveGrammar({
    grammar: loaded.grammar,
    profile: PROFILE,
    factCatalog: loaded.factCatalog,
    evidenceCatalog: loaded.evidenceCatalog,
    templateCatalog: loaded.templateCatalog,
    facts: ["active-item-present", "collection-navigation", "selection-single"],
  })
  assert.deepEqual(resolved.contextPack.principleConcerns, ["focus-order", "state", "target-size"])
  assert.doesNotMatch(JSON.stringify(resolved.contextPack), /surface-in-surface|typography|responsive/)
})
