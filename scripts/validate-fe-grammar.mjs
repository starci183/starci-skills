import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

const FORBIDDEN_EVIDENCE_KEYS = new Set([
  "remote",
  "repositoryRole",
  "revision",
  "path",
  "symbol",
  "blobHash",
  "activeAnchor",
  "legacyAnchor",
  "sourceOrigin",
])

const FORBIDDEN_EVIDENCE_KINDS = new Set(["active-source", "legacy-source"])

const normalizedTemplate = (value) => value.toString("utf8").replace(/\r\n?/g, "\n")
const sha256 = (value) => `sha256:${createHash("sha256").update(normalizedTemplate(value)).digest("hex")}`
const json = (file) => JSON.parse(readFileSync(file, "utf8"))

const assertNoStoredSourceOrigin = (value, location = "root") => {
  if (Array.isArray(value)) {
    value.forEach((member, index) => assertNoStoredSourceOrigin(member, `${location}[${index}]`))
    return
  }
  if (value === null || typeof value !== "object") {
    if (typeof value === "string" && FORBIDDEN_EVIDENCE_KINDS.has(value)) {
      throw new Error(`forbidden source evidence kind at ${location}: ${value}`)
    }
    return
  }
  for (const [key, member] of Object.entries(value)) {
    if (FORBIDDEN_EVIDENCE_KEYS.has(key)) throw new Error(`forbidden source origin field at ${location}.${key}`)
    assertNoStoredSourceOrigin(member, `${location}.${key}`)
  }
}

const compileTemplate = (templateRef, source) => {
  const result = ts.transpileModule(source, {
    fileName: templateRef,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      isolatedModules: true,
    },
  })
  const errors = (result.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
  if (errors.length > 0) {
    const messages = errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")).join("; ")
    throw new Error(`template does not compile: ${templateRef}: ${messages}`)
  }
  if (result.outputText.trim().length === 0) throw new Error(`template compilation emitted no code: ${templateRef}`)
}

/** Load and validate one self-contained grammar package without repository provenance. */
export const loadAndValidateGrammar = (grammarRoot) => {
  const root = resolve(grammarRoot)
  const grammar = json(resolve(root, "grammar.json"))
  const factCatalog = json(resolve(root, grammar.factCatalog))
  const evidenceCatalog = json(resolve(root, grammar.evidenceCatalog))
  const casesRoot = resolve(root, "cases")
  const cases = readdirSync(casesRoot)
    .filter((name) => name.endsWith(".json"))
    .map((name) => json(resolve(casesRoot, name)))
  const profilesRoot = resolve(root, "profiles")
  const profiles = readdirSync(profilesRoot)
    .filter((name) => name.endsWith(".json") && name !== "profile.schema.json")
    .map((name) => json(resolve(profilesRoot, name)))

  for (const [name, value] of Object.entries({ grammar, factCatalog, evidenceCatalog, cases, profiles })) {
    assertNoStoredSourceOrigin(value, name)
  }

  if (grammar.grammar !== factCatalog.grammar || grammar.grammar !== evidenceCatalog.grammar) {
    throw new Error("grammar, fact and evidence catalog identities must match")
  }

  const factIds = new Set()
  for (const fact of factCatalog.facts) {
    if (factIds.has(fact.id)) throw new Error(`duplicate grammar fact: ${fact.id}`)
    factIds.add(fact.id)
  }

  const caseById = new Map()
  for (const item of cases) {
    if (caseById.has(item.caseId)) throw new Error(`duplicate grammar case: ${item.caseId}`)
    caseById.set(item.caseId, item)
    for (const fact of item.facts) if (!factIds.has(fact)) throw new Error(`unknown case fact ${fact} in ${item.caseId}`)
  }

  const evidenceById = new Map()
  const templateCatalog = {}
  for (const capsule of evidenceCatalog.capsules) {
    if (evidenceById.has(capsule.id)) throw new Error(`duplicate behavior capsule: ${capsule.id}`)
    evidenceById.set(capsule.id, capsule)
    if (!Array.isArray(capsule.rulings) || capsule.rulings.length === 0) {
      throw new Error(`behavior capsule requires founder rulings: ${capsule.id}`)
    }
    for (const ruling of capsule.rulings) {
      if (!/^founder-(?:feedback|ruling):[a-zA-Z0-9:._-]+$/.test(ruling)) {
        throw new Error(`behavior capsule has a non-founder ruling: ${capsule.id}`)
      }
    }
    if (!Array.isArray(capsule.goldenCaseRefs) || capsule.goldenCaseRefs.length === 0) {
      throw new Error(`behavior capsule requires golden cases: ${capsule.id}`)
    }
    if (!Array.isArray(capsule.counterexampleCaseRefs) || capsule.counterexampleCaseRefs.length === 0) {
      throw new Error(`behavior capsule requires counterexample cases: ${capsule.id}`)
    }
    for (const fact of capsule.triggerFacts) {
      if (!factIds.has(fact)) throw new Error(`unknown capsule trigger fact ${fact} in ${capsule.id}`)
    }
    for (const caseId of capsule.goldenCaseRefs) {
      if (caseById.get(caseId)?.kind !== "golden") throw new Error(`capsule ${capsule.id} requires golden case ${caseId}`)
    }
    for (const caseId of capsule.counterexampleCaseRefs) {
      if (caseById.get(caseId)?.kind !== "counterexample") throw new Error(`capsule ${capsule.id} requires counterexample case ${caseId}`)
    }

    const templateFile = resolve(root, capsule.templateRef)
    const templateRelative = relative(root, templateFile)
    if (templateRelative.startsWith("..") || resolve(dirname(templateFile)) !== resolve(root, "templates")) {
      throw new Error(`template must stay inside grammar templates/: ${capsule.templateRef}`)
    }
    if (!existsSync(templateFile)) throw new Error(`missing behavior template: ${capsule.templateRef}`)
    const templateBuffer = readFileSync(templateFile)
    const actualHash = sha256(templateBuffer)
    if (actualHash !== capsule.templateHash) {
      throw new Error(`template hash mismatch for ${capsule.id}: expected ${capsule.templateHash}, got ${actualHash}`)
    }
    const content = templateBuffer.toString("utf8")
    compileTemplate(capsule.templateRef, content)
    templateCatalog[capsule.templateRef] = {
      templateRef: capsule.templateRef,
      templateHash: capsule.templateHash,
      content,
    }
  }

  for (const rule of grammar.rules) {
    for (const fact of [...rule.when.all, ...rule.when.any, ...rule.when.none]) {
      if (!factIds.has(fact)) throw new Error(`unknown rule fact ${fact} in ${rule.id}`)
    }
    for (const evidenceRef of rule.capsuleRefs) {
      if (!evidenceById.has(evidenceRef)) throw new Error(`unknown rule behavior capsule ${evidenceRef} in ${rule.id}`)
    }
  }
  const outcomeIds = new Set(grammar.rules.map((rule) => rule.emit.outcome))
  for (const item of cases) {
    if (item.kind === "golden") {
      for (const outcome of item.expectedOutcomes) {
        if (!outcomeIds.has(outcome)) throw new Error(`unknown case outcome ${outcome} in ${item.caseId}`)
      }
    }
  }

  for (const profile of profiles) {
    if (profile.grammar !== grammar.grammar) throw new Error(`profile grammar mismatch: ${profile.profileId}`)
    for (const [outcome, owner] of Object.entries(profile.owners)) {
      for (const evidenceRef of owner.capsuleRefs) {
        if (!evidenceById.has(evidenceRef)) throw new Error(`unknown owner behavior capsule ${evidenceRef} for ${outcome}`)
      }
      if (owner.visualContract !== undefined) {
        const roleNames = ["ground", "surface", "content", "mutedContent", "accent", "separator", "display", "body", "label", "radius", "elevation", "duration", "easing"]
        const axisNames = ["contrast", "density", "shape", "depth", "motion"]
        if (!outcomeIds.has(outcome)) throw new Error(`visual contract owner does not map a grammar outcome: ${outcome}`)
        if (JSON.stringify(Object.keys(owner.visualContract.axes).sort()) !== JSON.stringify(axisNames.sort())) {
          throw new Error(`visual contract must lock every direction axis: ${outcome}`)
        }
        if (JSON.stringify(Object.keys(owner.visualContract.roles).sort()) !== JSON.stringify(roleNames.sort())) {
          throw new Error(`visual contract must lock every semantic role: ${outcome}`)
        }
        for (const [role, token] of Object.entries(owner.visualContract.roles)) {
          if (owner.visualContract.tokens[token] === undefined) {
            throw new Error(`visual contract role ${role} references an unlocked token for ${outcome}`)
          }
        }
      }
    }
  }

  return { grammar, factCatalog, evidenceCatalog, cases, profiles, templateCatalog }
}

const parseArgs = (argv) => Object.fromEntries(argv.slice(2).map((value, index, values) => {
  if (!value.startsWith("--")) return []
  return [value.slice(2), values[index + 1]]
}).filter((entry) => entry.length === 2))

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv)
  if (!args.grammar) throw new Error("Usage: --grammar <grammar root>")
  const loaded = loadAndValidateGrammar(args.grammar)
  process.stdout.write(`${JSON.stringify({
    grammar: loaded.grammar.grammar,
    facts: loaded.factCatalog.facts.length,
    capsules: loaded.evidenceCatalog.capsules.length,
    cases: loaded.cases.length,
    templates: Object.keys(loaded.templateCatalog).length,
  })}\n`)
}
