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
