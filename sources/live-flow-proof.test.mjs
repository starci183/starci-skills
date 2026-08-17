import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const REFERENCE = join(ROOT, "fe", "references", "live-flow-proof.md")
const APPLY_SKILLS = [
  "starci-fe-design-execute",
  "starci-fe-consolidate-apply",
  "starci-fe-lint-sync-apply",
]

test("frontend product Apply lanes require authenticated four-surface runtime proof", () => {
  assert.ok(existsSync(REFERENCE), "the shared live-flow proof reference must exist")
  const reference = readFileSync(REFERENCE, "utf8")
  for (const token of [
    "### LIVE FLOW PROOF",
    "test account",
    "Network",
    "Console",
    "Terminal",
    "Never print or append passwords",
    "Apply cannot close",
  ]) {
    assert.ok(reference.includes(token), `live-flow proof is missing ${token}`)
  }

  for (const name of APPLY_SKILLS) {
    const skill = readFileSync(join(ROOT, "skills", name, "SKILL.md"), "utf8")
    assert.match(skill, /live-flow-proof\.md/, `${name} does not load the shared runtime proof`)
    assert.match(skill, /### LIVE FLOW PROOF/, `${name} does not append the runtime proof table`)
    assert.match(skill, /Network/, `${name} does not inspect browser Network evidence`)
    assert.match(skill, /Console/, `${name} does not inspect browser Console evidence`)
    assert.match(skill, /terminal/, `${name} does not inspect terminal evidence`)
  }
})
