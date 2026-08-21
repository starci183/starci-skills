import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const json = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"))

test("all five gate and shared schemas are valid JSON Schema documents", () => {
  for (const path of [
    "fe/gates/session.schema.json", "fe/gates/registry.schema.json",
    "fe/gates/layouts/gate.schema.json", "fe/gates/blocks/gate.schema.json",
    "fe/gates/principles/gate.schema.json", "fe/gates/patterns/gate.schema.json",
    "fe/gates/lints/gate.schema.json", "fe/intent/intent.schema.json",
    "grammars/starci/grammar.schema.json",
    "grammars/starci/facts.schema.json", "grammars/starci/capsules.schema.json",
    "grammars/starci/profiles/profile.schema.json", "grammars/starci/case.schema.json",
  ]) {
    const schema = json(path)
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema", path)
    assert.ok(schema.$id, path)
  }
})

test("Layout and Block alone expose candidate arrays with 3–4 cardinality", () => {
  const layout = json("fe/gates/layouts/gate.schema.json")
  const block = json("fe/gates/blocks/gate.schema.json")
  assert.deepEqual([layout.$defs.LayoutCandidateSet.properties.candidates.minItems, layout.$defs.LayoutCandidateSet.properties.candidates.maxItems], [3, 4])
  assert.deepEqual([block.$defs.BlockCandidateSet.properties.candidates.minItems, block.$defs.BlockCandidateSet.properties.candidates.maxItems], [3, 4])
  for (const gate of ["principles", "patterns", "lints"]) {
    const text = readFileSync(join(ROOT, "fe", "gates", gate, "gate.schema.json"), "utf8")
    assert.doesNotMatch(text, /recommendedCandidateId|candidateHashes|"candidates"/)
  }
})

test("golden cases prove independent surface and block cardinality", () => {
  const one = json("fe/gates/proofs/one-page-layout.json")
  assert.equal(one.layoutSets.length, 1)
  assert.ok(one.layoutSets[0].candidateIds.length >= 3 && one.layoutSets[0].candidateIds.length <= 4)
  const multi = json("fe/gates/proofs/multi-surface-layout.json")
  assert.equal(multi.layoutSets.length, multi.inputTargets.length)
  const modal = json("fe/gates/proofs/page-discovers-modal.json")
  assert.equal(modal.layoutSets.find((set) => set.origin === "discovered").kind, "modal")
  const blocks = json("fe/gates/proofs/five-block-cardinality.json")
  assert.equal(blocks.blockSets.length, 5)
  assert.equal(blocks.blockSets.reduce((sum, set) => sum + set.candidateIds.length, 0), 17)
})

test("intent modules use the five-record shape and forbid deceptive tactics", () => {
  const modules = ["call-to-action", "value-framing", "choice-architecture", "trust-and-proof", "urgency-and-scarcity", "commitment-and-friction"]
  for (const module of modules) for (const file of ["INDEX.md", "vi.md", "example.md", "audit.md", "changelog.md"]) {
    assert.ok(readFileSync(join(ROOT, "fe", "intent", module, file), "utf8").length > 20)
  }
  const schema = json("fe/intent/intent.schema.json")
  assert.ok(schema.properties.forbiddenTactics.items.enum.includes("fake-scarcity"))
  assert.ok(schema.properties.forbiddenTactics.items.enum.includes("obstructed-cancellation"))
})

test("every gate declares its own goal", () => {
  for (const gate of ["layouts", "blocks", "principles", "patterns", "lints"]) {
    const goal = readFileSync(join(ROOT, "fe", "gates", gate, "GOAL.md"), "utf8")
    assert.match(goal, /# .* goal/i)
  }
  assert.match(readFileSync(join(ROOT, "fe/gates/layouts/GOAL.md"), "utf8"), /reuse.*extend.*new-required.*not-applicable/s)
  assert.match(readFileSync(join(ROOT, "fe/gates/blocks/GOAL.md"), "utf8"), /render gì/)
  assert.match(readFileSync(join(ROOT, "fe/gates/principles/GOAL.md"), "utf8"), /Không hallucinate/)
})

test("Layout, Block, session and skills require exact workspace grammar receipts", () => {
  const layout = json("fe/gates/layouts/gate.schema.json")
  const block = json("fe/gates/blocks/gate.schema.json")
  const session = json("fe/gates/session.schema.json")
  assert.ok(layout.$defs.LayoutInput.required.includes("grammarReceipt"))
  assert.ok(layout.$defs.TargetSurface.required.includes("grammarFacts"))
  assert.ok(layout.$defs.LayoutPlan.required.includes("grammarDecisions"))
  assert.ok(block.$defs.BlockInput.required.includes("grammarReceipt"))
  assert.ok(block.$defs.BlockCandidate.required.includes("grammarDecisions"))
  assert.ok(session.required.includes("grammarReceipt"))
  for (const skill of ["plan", "layout", "block", "execute"]) {
    const text = readFileSync(join(ROOT, "skills", `starci-fe-design-${skill}`, "SKILL.md"), "utf8")
    assert.match(text, /grammar/i, skill)
  }
})

test("Execute is structurally blocked without complete exact principle receipts", () => {
  const principles = json("fe/gates/principles/gate.schema.json")
  const patterns = json("fe/gates/patterns/gate.schema.json")
  const lints = json("fe/gates/lints/gate.schema.json")
  const required = principles.$defs.PrinciplesResult.required
  for (const field of ["principleReceipts", "coverage", "principleReceiptHash", "coverageHash"]) {
    assert.ok(required.includes(field), field)
  }
  const patternReceipt = patterns.$defs.PrinciplesReceipt.required
  assert.ok(patternReceipt.includes("principleReceiptHash"))
  assert.ok(patternReceipt.includes("coverageHash"))
  const lintText = JSON.stringify(lints)
  assert.match(lintText, /principle-receipt-coverage/)
  assert.match(lintText, /principle-recipe-exact/)
  const execute = readFileSync(join(ROOT, "skills/starci-fe-design-execute/SKILL.md"), "utf8")
  assert.match(execute, /validate-principle-receipts\.mjs/)
})
