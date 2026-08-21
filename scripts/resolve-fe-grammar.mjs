import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { loadAndValidateGrammar } from "./validate-fe-grammar.mjs"

const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

const hash = (value) => createHash("sha256").update(canonical(value)).digest("hex")

const matches = (rule, factSet) => {
  const { all, any, none } = rule.when
  return all.every((fact) => factSet.has(fact))
    && (any.length === 0 || any.some((fact) => factSet.has(fact)))
    && none.every((fact) => !factSet.has(fact))
}

const specificity = (rule) => rule.when.all.length + rule.when.any.length + rule.when.none.length

/** Resolve project facts without model judgement. One deterministic winner is emitted per slot. */
export const resolveGrammar = ({ grammar, profile, factCatalog, evidenceCatalog, rulingCatalog, designSystem, templateCatalog, facts }) => {
  if (grammar.grammar !== profile.grammar) throw new Error("grammar/profile identity mismatch")
  if (grammar.grammar !== factCatalog.grammar) throw new Error("grammar/fact catalog identity mismatch")
  if (grammar.grammar !== evidenceCatalog.grammar) throw new Error("grammar/evidence catalog identity mismatch")
  if (grammar.grammar !== rulingCatalog.grammar || grammar.grammar !== designSystem.grammar) throw new Error("grammar/ruling/design-system identity mismatch")
  const normalizedFacts = [...new Set(facts)].sort()
  const knownFacts = new Set(factCatalog.facts.map((fact) => fact.id))
  const unknownFacts = normalizedFacts.filter((fact) => !knownFacts.has(fact))
  if (unknownFacts.length > 0) throw new Error(`unknown grammar facts: ${unknownFacts.join(",")}`)
  const factSet = new Set(normalizedFacts)
  const bySlot = new Map()
  for (const rule of grammar.rules.filter((candidate) => matches(candidate, factSet))) {
    const current = bySlot.get(rule.slot)
    const candidateRank = [rule.priority, specificity(rule), rule.id]
    const currentRank = current === undefined ? undefined : [current.priority, specificity(current), current.id]
    if (currentRank === undefined
      || candidateRank[0] > currentRank[0]
      || (candidateRank[0] === currentRank[0] && candidateRank[1] > currentRank[1])
      || (candidateRank[0] === currentRank[0] && candidateRank[1] === currentRank[1] && candidateRank[2] < currentRank[2])) {
      bySlot.set(rule.slot, rule)
    }
  }
  const winningRules = [...bySlot.values()]
  const capsuleById = new Map(evidenceCatalog.capsules.map((capsule) => [capsule.id, capsule]))
  const decisions = winningRules
    .sort((left, right) => left.slot.localeCompare(right.slot))
    .map((rule) => {
      const owner = profile.owners[rule.emit.outcome] ?? {
        decision: "new-required",
        component: rule.emit.outcome,
        primitive: rule.emit.outcome,
        principleMode: "delta",
        principleConcerns: ["state"],
        capsuleRefs: rule.capsuleRefs,
        reason: "No project owner maps this grammar outcome.",
      }
      const capsuleRefs = [...new Set([...rule.capsuleRefs, ...owner.capsuleRefs])].sort()
      const missingCapsules = capsuleRefs.filter((id) => !capsuleById.has(id))
      if (missingCapsules.length > 0) throw new Error(`unknown behavior capsules: ${missingCapsules.join(",")}`)
      return {
        slot: rule.slot,
        ruleId: rule.id,
        outcome: rule.emit.outcome,
        obligations: [...rule.emit.obligations].sort(),
        principleMode: owner.principleMode,
        principleConcerns: [...owner.principleConcerns].sort(),
        capsuleRefs,
        owner,
      }
    })
  const selectedCapsuleRefs = [...new Set(decisions.flatMap((decision) => decision.capsuleRefs))].sort()
  const selectedEvidence = selectedCapsuleRefs.map((id) => capsuleById.get(id))
  const selectedFactIds = [...new Set(winningRules.flatMap((rule) => [
    ...rule.when.all,
    ...rule.when.any.filter((fact) => factSet.has(fact)),
  ]).filter((fact) => factSet.has(fact)))].sort()
  const factById = new Map(factCatalog.facts.map((fact) => [fact.id, fact]))
  const selectedFacts = selectedFactIds.map((id) => factById.get(id))
  const templates = [...new Map(selectedEvidence.map((capsule) => {
    const template = templateCatalog[capsule.templateRef]
    if (template === undefined) throw new Error(`missing loaded behavior template: ${capsule.templateRef}`)
    if (template.templateHash !== capsule.templateHash) throw new Error(`loaded template hash mismatch: ${capsule.templateRef}`)
    return [capsule.templateRef, template]
  })).values()].sort((left, right) => left.templateRef.localeCompare(right.templateRef))
  const principleConcerns = [...new Set(decisions
    .filter((decision) => decision.principleMode === "delta")
    .flatMap((decision) => decision.principleConcerns))].sort()
  const contextPack = {
    master: {systemId: designSystem.systemId, axes: designSystem.axes, roles: designSystem.roles, spacingRungs: designSystem.spacingRungs, antiPatterns: designSystem.antiPatterns},
    facts: selectedFacts,
    evidenceRefs: selectedCapsuleRefs,
    evidence: selectedEvidence,
    templates,
    principleConcerns,
  }
  const receipt = {
    grammar: grammar.grammar,
    grammarId: grammar.grammarId,
    version: grammar.version,
    profileId: profile.profileId,
    grammarHash: hash(grammar),
    profileHash: hash(profile),
    factCatalogHash: hash(factCatalog),
    evidenceCatalogHash: hash(evidenceCatalog),
    rulingCatalogHash: hash(rulingCatalog),
    designSystemHash: hash(designSystem),
    designSystemId: designSystem.systemId,
    factsHash: hash(normalizedFacts),
    decisionsHash: hash(decisions),
    contextPackHash: hash(contextPack),
  }
  return { facts: normalizedFacts, decisions, contextPack, receipt }
}

const parseArgs = (argv) => Object.fromEntries(argv.slice(2).map((value, index, values) => {
  if (!value.startsWith("--")) return []
  return [value.slice(2), values[index + 1]]
}).filter((entry) => entry.length === 2))

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv)
  if (!args.grammar || !args.profile || !args.facts) throw new Error("Usage: --grammar <grammar root> --profile <profile JSON> --facts <JSON file>")
  const root = resolve(args.grammar)
  const { grammar, factCatalog, evidenceCatalog, rulingCatalog, designSystem, templateCatalog } = loadAndValidateGrammar(root)
  const profile = JSON.parse(readFileSync(resolve(args.profile), "utf8"))
  const input = JSON.parse(readFileSync(resolve(args.facts), "utf8"))
  process.stdout.write(`${JSON.stringify(resolveGrammar({ grammar, profile, factCatalog, evidenceCatalog, rulingCatalog, designSystem, templateCatalog, facts: input.facts }), null, 2)}\n`)
}
