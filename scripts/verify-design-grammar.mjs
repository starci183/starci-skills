#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { resolveGrammar } from "./resolve-fe-grammar.mjs"
import { loadAndValidateGrammar } from "./validate-fe-grammar.mjs"

const readJson = (path) => JSON.parse(readFileSync(resolve(path), "utf8"))
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const compactCssValue = (value) => value.replace(/\s+/g, " ").trim()

const verifyVisualContract = (design, decisions, preview) => {
  const contracts = decisions
    .map((decision) => decision.owner.visualContract)
    .filter((contract) => contract !== undefined)
  if (contracts.length === 0) return
  if (typeof preview !== "string" || preview.trim().length === 0) {
    throw new Error("grammar-locked visual design requires preview.html proof")
  }
  const direction = design.artifact?.direction
  if (direction === undefined) throw new Error("accepted design omits its grammar-locked visual direction")
  for (const contract of contracts) {
    if (!same(direction.axes, contract.axes)) {
      throw new Error("accepted visual direction axes differ from the grammar-locked theme")
    }
    if (!same(direction.lockedTokens, contract.tokens)) {
      throw new Error("accepted visual direction token values differ from the grammar-locked theme")
    }
    for (const [role, token] of Object.entries(contract.roles)) {
      const decision = direction.roles?.[role]
      if (decision?.token !== token || decision.verdict === "none") {
        throw new Error(`accepted visual direction role ${role} differs from the grammar-locked theme`)
      }
      if (decision.verdict === "new" && decision.value !== contract.tokens[token]) {
        throw new Error(`accepted visual direction role ${role} carries a non-locked token value`)
      }
    }
    const declarations = new Map()
    const declarationPattern = /(--[A-Za-z_][A-Za-z0-9_-]*)\s*:\s*([^;{}]+);/g
    let declaration
    while ((declaration = declarationPattern.exec(preview)) !== null) {
      const values = declarations.get(declaration[1]) ?? []
      values.push(compactCssValue(declaration[2]))
      declarations.set(declaration[1], values)
    }
    for (const [token, value] of Object.entries(contract.tokens)) {
      const exact = compactCssValue(value)
      if (!(declarations.get(token) ?? []).includes(exact)) {
        throw new Error(`preview.html omits exact grammar-locked declaration ${token}`)
      }
      const references = preview.match(new RegExp(`var\\(\\s*${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\)`, "g")) ?? []
      if (references.length === 0) throw new Error(`preview.html declares but does not use grammar-locked token ${token}`)
    }
    const templates = [...preview.matchAll(/<template\b[^>]*\bdata-state\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/template>/gi)]
    if (templates.length === 0) throw new Error("preview.html has no state templates for visual-contract proof")
    for (const match of templates) {
      if (!/data-visual-contract\s*=\s*["']starci-dashboard-theme["']/i.test(match[3])) {
        throw new Error(`preview state ${match[1] ?? match[2]} omits the StarCi dashboard visual-contract boundary`)
      }
    }
    if (!/data-theme-role\s*=\s*["']selected["']/i.test(preview)) {
      throw new Error("preview.html omits a selected-state proof element")
    }
    const styleSource = [...preview.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join("\n")
    const withoutLockedDeclarations = styleSource.replace(declarationPattern, (source, token) => contract.tokens[token] === undefined ? source : "")
    const rawColour = withoutLockedDeclarations.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|lab|lch)\s*\(|\b(?:white|black|red|blue|pink|cyan|magenta|yellow|gray|grey)\b/i)
    if (rawColour) throw new Error(`preview.html carries raw palette value outside the grammar visual contract: ${rawColour[0]}`)
  }
}

/** Prove an accepted design still resolves to its recorded deterministic grammar authority. */
export function verifyDesignGrammar({ design, grammarRoot, profilePath, preview }) {
  const loaded = loadAndValidateGrammar(grammarRoot)
  const profile = readJson(profilePath)
  if (design.grammar !== loaded.grammar.grammar) throw new Error("design grammar differs from authority package")
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
  verifyVisualContract(design, resolved.decisions, preview)
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
    console.error("Usage: node scripts/verify-design-grammar.mjs --design <design.json> --grammar <grammar-root> --profile <profile.json> [--preview <preview.html>]")
    return 2
  }
  try {
    const resolved = verifyDesignGrammar({design: readJson(input.design), grammarRoot: input.grammar, profilePath: input.profile, preview: input.preview ? readFileSync(resolve(input.preview), "utf8") : undefined})
    console.log(`${resolved.decisions.length} grammar decision(s) match the accepted receipt`)
    return 0
  } catch (error) {
    console.error(error.message)
    return 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2))
