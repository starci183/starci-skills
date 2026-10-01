/**
 * The vocabulary the rules judge against is the grammar's own: this twin test recomputes it from
 * packages/grammar/src and fails when `lib/vocabulary.generated.mjs` is stale (run `npm run vocabulary`).
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { extractValues } from "./lib/extract-values.mjs"
import { extractVocabulary, FAMILY_PREFIXES, GRAMMAR_CSS } from "./lib/extract-vocabulary.mjs"
import { GRAMMAR_VALUES } from "./lib/grammar-values.generated.mjs"
import { BREAKPOINTS, DECLARED, STATUS_TONES, VENDOR } from "./lib/vocabulary.generated.mjs"
import { isGrammarToken, isKnownToken } from "./lib/vocabulary.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const grammarSrc = path.resolve(here, "..", "grammar", "src")

test("the generated vocabulary equals what the grammar CSS declares and reads", () => {
  const fresh = extractVocabulary(grammarSrc)
  assert.deepEqual(DECLARED, fresh.declared, "DECLARED is stale: run `npm run vocabulary` in packages/stylelint")
  assert.deepEqual(VENDOR, fresh.vendor, "VENDOR is stale: run `npm run vocabulary` in packages/stylelint")
  assert.deepEqual(BREAKPOINTS, fresh.breakpoints, "BREAKPOINTS is stale: run `npm run vocabulary` in packages/stylelint")
  assert.deepEqual(STATUS_TONES, fresh.statusTones, "STATUS_TONES is stale: run `npm run vocabulary` in packages/stylelint")
})

test("the four family namespaces and the semantic layer are grammar tokens", () => {
  assert.deepEqual(FAMILY_PREFIXES, ["--grammar-", "--starci-core-", "--heritage-", "--offset-pop-"])
  for (const name of ["--grammar-inline-gap", "--starci-core-anything", "--heritage-ink", "--offset-pop-shadow", "--accent", "--surface", "--radius-md", "--font-mono", "--font-sans"]) {
    assert.ok(isGrammarToken(name), name)
  }
})

test("a private namespace is not a grammar token, unless the repository declared it", () => {
  assert.equal(isGrammarToken("--nv-ink"), false)
  assert.equal(isKnownToken("--nv-ink"), false)
  assert.equal(isKnownToken("--nv-ink", ["--nv-ink"]), true)
})

test("every status tone has a solid pair and a soft pair in the vocabulary, info included", () => {
  assert.deepEqual(STATUS_TONES, ["success", "warning", "danger", "info"])
  for (const tone of STATUS_TONES) {
    for (const name of [`--${tone}`, `--${tone}-foreground`, `--${tone}-soft`, `--${tone}-soft-foreground`, `--${tone}-soft-hover`]) assert.ok(isGrammarToken(name), name)
  }
  assert.equal(isGrammarToken("--info-soft-foreground"), true)
  assert.equal(isGrammarToken("--info-softer"), false)
})

test("a status tone whose solid pair the grammar does not declare is refused by the generator", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grammar-src-"))
  try {
    for (const file of GRAMMAR_CSS) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      fs.writeFileSync(path.join(dir, file), ".grammar-common-root { --success: red; --success-foreground: white; --warning: red; --warning-foreground: white; --danger: red; --danger-foreground: white; }")
    }
    assert.throws(() => extractVocabulary(dir), /lists info, but the grammar CSS does not declare --info/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("the generated grammar values equal what the grammar CSS declares on its theme roots", () => {
  assert.deepEqual(GRAMMAR_VALUES, extractValues(grammarSrc), "grammar-values.generated.mjs is stale: run `npm run vocabulary` in packages/stylelint")
  assert.equal(GRAMMAR_VALUES.light.core["--success"], "var(--starci-core-success)")
  assert.match(GRAMMAR_VALUES.light.common["--success-soft-foreground"], /^color-mix\(in oklab, var\(--success\)/)
  assert.ok(GRAMMAR_VALUES.dark.common["--background"])
})

test("eslint-fe reads the status tones from one generated copy of this list", async () => {
  const copy = await import("../eslint/fe/lib/status-tones.generated.mjs")
  assert.deepEqual(copy.STATUS_TONES, STATUS_TONES)
})
