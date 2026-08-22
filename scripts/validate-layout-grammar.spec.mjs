import assert from "node:assert/strict"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { validateLayoutGrammar } from "./validate-layout-grammar.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const grammarRoot = join(root, "grammars", "starci")
const profilePath = join(grammarRoot, "profiles", "starci-academy.json")

const fixture = () => ({
  candidates: [{
    id: "personal-project-task",
    renderContract: {
      pages: [{
        id: "task-page",
        regions: [{
          id: "guidance",
          grammarScopes: [{
            target: "common-errors",
            facts: ["surface-section-labelled", "collection-peer", "boundary-shared"],
            decisions: [{slot: "collection-surface", outcome: "surface-list", component: "SurfaceListCard"}],
          }],
        }],
      }],
    },
  }],
})

test("accepts a render child bound to the current grammar owner", () => {
  assert.equal(validateLayoutGrammar({artifact: fixture(), grammarRoot, profilePath}), 1)
})

test("refuses a generic card where peer facts resolve SurfaceListCard", () => {
  const artifact = fixture()
  artifact.candidates[0].renderContract.pages[0].regions[0].grammarScopes[0].decisions[0].component = "SurfaceCard"
  assert.throws(() => validateLayoutGrammar({artifact, grammarRoot, profilePath}), /stale or misapplied/)
})

test("refuses a complete render region without child grammar scopes", () => {
  const artifact = fixture()
  delete artifact.candidates[0].renderContract.pages[0].regions[0].grammarScopes
  assert.throws(() => validateLayoutGrammar({artifact, grammarRoot, profilePath}), /omits grammarScopes/)
})
