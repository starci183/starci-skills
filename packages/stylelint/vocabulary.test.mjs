/**
 * The vocabulary the rules judge against is the grammar's own: this twin test recomputes it from
 * packages/grammar/src and fails when `lib/vocabulary.generated.mjs` is stale (run `npm run vocabulary`).
 */
import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { extractVocabulary, FAMILY_PREFIXES } from "./lib/extract-vocabulary.mjs"
import { BREAKPOINTS, DECLARED, VENDOR } from "./lib/vocabulary.generated.mjs"
import { isGrammarToken, isKnownToken } from "./lib/vocabulary.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const grammarSrc = path.resolve(here, "../grammar/src")

test("the generated vocabulary equals what the grammar CSS declares and reads", () => {
  const fresh = extractVocabulary(grammarSrc)
  assert.deepEqual(DECLARED, fresh.declared, "DECLARED is stale: run `npm run vocabulary` in packages/stylelint")
  assert.deepEqual(VENDOR, fresh.vendor, "VENDOR is stale: run `npm run vocabulary` in packages/stylelint")
  assert.deepEqual(BREAKPOINTS, fresh.breakpoints, "BREAKPOINTS is stale: run `npm run vocabulary` in packages/stylelint")
})

test("the four family namespaces and the semantic layer are grammar tokens", () => {
  assert.deepEqual(FAMILY_PREFIXES, ["--grammar-", "--starci-core-", "--heritage-", "--offset-pop-"])
  for (const name of ["--grammar-inline-gap", "--starci-core-anything", "--heritage-ink", "--offset-pop-shadow", "--accent", "--surface", "--radius-md", "--font-mono"]) {
    assert.ok(isGrammarToken(name), name)
  }
})

test("a private namespace is not a grammar token, unless the repository declared it", () => {
  assert.equal(isGrammarToken("--nv-ink"), false)
  assert.equal(isKnownToken("--nv-ink"), false)
  assert.equal(isKnownToken("--nv-ink", ["--nv-ink"]), true)
})
