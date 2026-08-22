#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { loadAndValidateGrammar } from "./validate-fe-grammar.mjs"
import { resolveGrammar } from "./resolve-fe-grammar.mjs"

const readJson = (path) => JSON.parse(readFileSync(resolve(path), "utf8"))
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const compactDecisions = (decisions) => decisions.map((decision) => ({
  slot: decision.slot,
  outcome: decision.outcome,
  component: decision.owner.component,
})).sort((left, right) => left.slot.localeCompare(right.slot))

/** Prove that every complete render region binds each child target to current grammar owners. */
export function validateLayoutGrammar({ artifact, grammarRoot, profilePath }) {
  const loaded = loadAndValidateGrammar(grammarRoot)
  const profile = readJson(profilePath)
  let scopeCount = 0
  for (const candidate of artifact.candidates ?? []) {
    for (const page of candidate.renderContract?.pages ?? []) {
      for (const region of page.regions ?? []) {
        const scopes = region.grammarScopes
        if (!Array.isArray(scopes) || scopes.length === 0) {
          throw new Error(`${candidate.id}/${page.id}/${region.id} omits grammarScopes`)
        }
        const targets = new Set()
        for (const scope of scopes) {
          if (targets.has(scope.target)) throw new Error(`${region.id} repeats grammar target ${scope.target}`)
          targets.add(scope.target)
          const resolved = resolveGrammar({
            grammar: loaded.grammar,
            profile,
            factCatalog: loaded.factCatalog,
            evidenceCatalog: loaded.evidenceCatalog,
            rulingCatalog: loaded.rulingCatalog,
            designSystem: loaded.designSystem,
            templateCatalog: loaded.templateCatalog,
            facts: scope.facts,
          })
          const actual = compactDecisions(resolved.decisions)
          const expected = [...scope.decisions].sort((left, right) => left.slot.localeCompare(right.slot))
          if (actual.length === 0) throw new Error(`${region.id}/${scope.target} resolves no semantic owner`)
          if (!same(expected, actual)) throw new Error(`${region.id}/${scope.target} grammar owners are stale or misapplied`)
          scopeCount += 1
        }
      }
    }
  }
  if (scopeCount === 0) throw new Error("layout artifact contains no complete render-region grammar scope")
  return scopeCount
}

const args = (argv) => {
  const result = {}
  for (let index = 0; index < argv.length; index += 2) result[argv[index]?.replace(/^--/, "")] = argv[index + 1]
  return result
}

function main(argv) {
  const input = args(argv)
  if (!input.artifact || !input.grammar || !input.profile) {
    console.error("Usage: --artifact <states-design.json> --grammar <grammar-root> --profile <profile.json>")
    return 2
  }
  try {
    const count = validateLayoutGrammar({artifact: readJson(input.artifact), grammarRoot: input.grammar, profilePath: input.profile})
    console.log(`${count} render-region grammar scope(s) hold`)
    return 0
  } catch (error) {
    console.error(error.message)
    return 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2))
