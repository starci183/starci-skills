// The landing page never restates the tree from memory: every number, name, job, kind and stop code
// on it is read here, at build time, from the same files the runtime reads. The operator packages are
// parsed with the tree's own parser (`scripts/operator-md.mjs`), so this generator cannot disagree
// with `operators/INDEX.md` about what an operator needs, produces, or stops with.
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadOperatorPackages, cellAliases, cellCodes, isYes, kindOf } from '../../../scripts/operator-md.mjs'
import { loadErrorsRegistry } from '../../../scripts/errors-registry.mjs'

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(siteRoot, '..', '..')
const read = (...p) => readFile(path.join(repoRoot, ...p), 'utf8')
const readJson = async (...p) => JSON.parse(await read(...p))

// --- The runtime version and the lineage line, from INDEX.md ------------------------------------
const indexMd = await read('INDEX.md')
const version = /^#\s*StarCi Skills\s+(\S+)/m.exec(indexMd)?.[1]
if (!version) throw new Error('INDEX.md: no "# StarCi Skills <version>" heading to read the version from')
const lineage = /^##\s*Lineage\s*\n+([\s\S]*?)(?=\n##\s|\n*$)/m.exec(indexMd)?.[1] ?? ''
const lineageNote = lineage.split(/\n\s*\n/)[0].replace(/^\d+\.\s+/, '').replace(/\s*\n\s*/g, ' ').trim()

// --- The entry: name, description and the routing table of SKILL.md ------------------------------
const skillMd = await read('SKILL.md')
const frontMatter = /^---\n([\s\S]*?)\n---/.exec(skillMd)?.[1] ?? ''
const entryField = (key) => new RegExp(`^${key}:\\s*([\\s\\S]*?)(?=\\n[a-z]+:|$)`, 'm').exec(frontMatter)?.[1].replace(/\s*\n\s*/g, ' ').trim() ?? ''

// The one markdown table under "## Entry": which request each operator owns.
const entrySection = /^##\s*Entry\s*\n([\s\S]*?)(?=\n##\s)/m.exec(skillMd)?.[1] ?? ''
const entryRows = entrySection
  .split('\n')
  .filter((line) => line.startsWith('|') && !/^\|\s*-{3,}/.test(line) && !/The request is about/.test(line))
  .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
  .map(([about, operator]) => ({ about, operator: operator.replace(/`/g, '') }))
if (entryRows.length === 0) throw new Error('SKILL.md: the Entry table could not be read')

// --- Routing map ---------------------------------------------------------------------------------
const routing = await readJson('routing.json')
const routes = Object.entries(routing.routes).flatMap(([operator, byDomain]) =>
  Object.entries(byDomain).map(([domain, route]) => ({ operator, domain, kind: route.kind, target: route.target ?? null })))
const routeKinds = Object.entries(routing.kinds).map(([id, meaning]) => ({
  id,
  meaning,
  count: routes.filter((route) => route.kind === id).length,
}))

// --- Operators -----------------------------------------------------------------------------------
const registry = await loadErrorsRegistry(repoRoot)
if (registry.errors.length) throw new Error(`operators/errors.json: ${registry.errors.join('; ')}`)

const packages = (await loadOperatorPackages(repoRoot)).filter((entry) => entry.shape === 'v9')
if (packages.length === 0) throw new Error('operators/: no v9 operator package found')

const operators = packages.map((pkg) => {
  const op = pkg.en
  const tables = op.tables
  const context = [...new Set((tables.context?.rows ?? []).flatMap((row) => cellAliases(row.alias)))].sort()
  const stops = (tables.stops?.rows ?? []).map((row) => {
    const code = cellCodes(row.code)[0] ?? row.code.replace(/`/g, '').trim()
    const known = registry.codes[code]
    return {
      code,
      disposition: known?.disposition ?? row.disposition.trim(),
      domain: known?.domain ?? null,
      meaning: known?.meaning?.en ?? null,
      shared: known ? known.scope.includes('*') : false,
    }
  })
  return {
    id: pkg.manifest.id,
    dir: pkg.name,
    domain: pkg.manifest.domain,
    job: op.job || pkg.manifest.job,
    profile: pkg.manifest.resources?.profile ?? null,
    policy: pkg.manifest.resources?.policy ?? null,
    requires: pkg.manifest.resources?.requires ?? [],
    hasVietnamese: Boolean(pkg.vi),
    context,
    steps: tables.steps?.rows.length ?? 0,
    requirements: tables.requirements?.rows.length ?? 0,
    inputs: (tables.inputs?.rows ?? [])
      .map((row) => ({ kind: kindOf(row.kind), required: isYes(row.required) }))
      .filter((input) => input.kind && input.kind !== '—'),
    outputs: (tables.outputs?.rows ?? [])
      .map((row) => ({ kind: kindOf(row.kind), file: row.file.replace(/`/g, ''), type: row.type.trim(), required: isYes(row.required) }))
      .filter((output) => output.kind && output.kind !== '—'),
    next: (tables.next?.rows ?? []).map((row) => ({ when: row.when, operator: row.operator.replace(/`/g, '') })),
    stops,
    routes: Object.entries(routing.routes[pkg.manifest.id] ?? {}).map(([domain, route]) => ({ domain, kind: route.kind, target: route.target ?? null })),
  }
}).sort((left, right) => left.id.localeCompare(right.id))

const domains = [...new Set(operators.map((operator) => operator.domain))]
  .map((id) => ({ id, operatorCount: operators.filter((operator) => operator.domain === id).length }))
  .sort((left, right) => right.operatorCount - left.operatorCount || left.id.localeCompare(right.id))

const profiles = [...new Set(operators.map((operator) => operator.profile).filter(Boolean))]
  .map((id) => ({ id, operatorCount: operators.filter((operator) => operator.profile === id).length }))
  .sort((left, right) => right.operatorCount - left.operatorCount || left.id.localeCompare(right.id))

// --- Kinds: who writes each file that crosses a branch boundary, and who reads it ------------------
const kindNames = [...new Set(operators.flatMap((operator) => [...operator.inputs, ...operator.outputs].map((entry) => entry.kind)))].sort()
const kinds = kindNames.map((kind) => ({
  kind,
  producedBy: operators.filter((operator) => operator.outputs.some((output) => output.kind === kind)).map((operator) => operator.id),
  consumedBy: operators.filter((operator) => operator.inputs.some((input) => input.kind === kind)).map((operator) => operator.id),
}))
const orphanKinds = kinds.filter((entry) => entry.producedBy.length === 0).map((entry) => entry.kind)
if (orphanKinds.length) throw new Error(`kinds consumed but produced by no operator: ${orphanKinds.join(', ')}`)

// --- Stop codes: the merged registry, exactly as the runtime resolves it ---------------------------
const stopCodes = Object.entries(registry.codes).map(([code, entry]) => ({
  code,
  scope: entry.scope,
  shared: entry.scope.includes('*'),
  domain: entry.domain,
  disposition: entry.disposition,
  meaning: entry.meaning.en,
  fallback: entry.fallback?.en ?? null,
  resume: entry.resume?.en ?? null,
})).sort((left, right) => left.code.localeCompare(right.code))

// --- Workflows: the example chains the entry reuses -------------------------------------------------
const workflowFiles = (await readdir(path.join(repoRoot, 'workflows'))).filter((file) => file.endsWith('.json')).sort()
const workflows = await Promise.all(workflowFiles.map(async (file) => {
  const flow = await readJson('workflows', file)
  const steps = flow.chain.map((step) => step.map((branch) => ({
    operator: branch.operator,
    fanout: branch.fanout ?? null,
    maxParallel: branch.maxParallel ?? null,
    requirements: branch.requirements ?? null,
  })))
  return {
    id: flow.id,
    when: flow.when,
    ends: flow.ends,
    steps,
    stepCount: steps.length,
    branchCount: steps.reduce((total, step) => total + step.length, 0),
    widestStep: steps.reduce((widest, step) => Math.max(widest, step.length), 0),
    loops: (flow.loops ?? []).map((loop) => ({ from: loop.from, to: loop.to, when: loop.when, maxRounds: loop.maxRounds })),
  }
}))

const catalog = {
  version,
  lineageNote,
  entry: {
    name: entryField('name'),
    description: entryField('description'),
    rows: entryRows,
  },
  loop: {
    // The one sentence SKILL.md draws as the loop; the page must not invent a different one.
    diagram: /```text\n([^`]*?)\n```/.exec(skillMd)?.[1].trim() ?? '',
    kinds: routeKinds,
  },
  operators,
  domains,
  profiles,
  kinds,
  stopCodes,
  workflows,
  counts: {
    operators: operators.length,
    workflows: workflows.length,
    routes: routes.length,
    kinds: kinds.length,
    stopCodes: stopCodes.length,
    steps: operators.reduce((total, operator) => total + operator.steps, 0),
    domains: domains.length,
    profiles: profiles.length,
    fallbackCodes: stopCodes.filter((code) => code.disposition === 'fallback').length,
  },
}

await writeFile(path.join(siteRoot, 'src', 'catalog.generated.json'), `${JSON.stringify(catalog, null, 2)}\n`)

console.log(
  `generated site data: v${version}, ${catalog.counts.operators} operators, ${catalog.counts.workflows} workflows, `
  + `${catalog.counts.routes} routes, ${catalog.counts.kinds} kinds, ${catalog.counts.stopCodes} stop codes`,
)
