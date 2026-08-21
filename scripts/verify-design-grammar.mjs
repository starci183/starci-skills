#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { resolveGrammar } from "./resolve-fe-grammar.mjs"
import { loadAndValidateGrammar } from "./validate-fe-grammar.mjs"

const readJson = (path) => JSON.parse(readFileSync(resolve(path), "utf8"))
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

/** Prove an accepted design still resolves to its recorded deterministic grammar authority. */
export function verifyDesignGrammar({ design, grammarRoot, profilePath }) {
  const loaded = loadAndValidateGrammar(grammarRoot)
  const profile = readJson(profilePath)
  if (design.grammar !== loaded.grammar.grammar) throw new Error("design grammar differs from compiler package")
  if (design.grammarProfile !== profile.profileId) throw new Error("design grammar profile differs from routed profile")
  const resolved = resolveGrammar({
    grammar: loaded.grammar,
    profile,
    factCatalog: loaded.factCatalog,
    evidenceCatalog: loaded.evidenceCatalog,
    templateCatalog: loaded.templateCatalog,
    facts: design.grammarFacts,
  })
  if (!same(design.grammarDecisions, resolved.decisions)) throw new Error("accepted grammar decisions are stale")
  if (!same(design.grammarReceipt, resolved.receipt)) throw new Error("accepted grammar receipt is stale")
  return resolved
}

function args(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 2) result[argv[index]?.replace(/^--/, "")] = argv[index + 1]
  return result
}

function main(argv) {
  const input = args(argv)
  if (!input.design || !input.grammar || !input.profile) {
    console.error("Usage: node scripts/verify-design-grammar.mjs --design <design.json> --grammar <grammar-root> --profile <profile.json>")
    return 2
  }
  try {
    const resolved = verifyDesignGrammar({design: readJson(input.design), grammarRoot: input.grammar, profilePath: input.profile})
    console.log(`${resolved.decisions.length} grammar decision(s) match the accepted receipt`)
    return 0
  } catch (error) {
    console.error(error.message)
    return 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2))
