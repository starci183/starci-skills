import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(siteRoot, '..', '..')
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name)
  return entry.isDirectory() ? walk(target) : [target]
})

const catalog = readJson(path.join(repoRoot, 'skills', 'catalog.json'))
const skills = catalog.skills.map((skill) => ({
  ...skill,
  domain: skill.capability.split('.')[0],
}))

const operatorIconUrl = (manifestFile) => {
  const iconFile = path.join(path.dirname(manifestFile), 'icon.svg')
  if (!existsSync(iconFile)) return null
  const svg = readFileSync(iconFile, 'utf8')
  const colors = [...new Set(svg.match(/#[0-9a-f]{6}/gi)?.map((color) => color.toUpperCase()) ?? [])]
  if (!/^\s*<svg[\s>]/.test(svg) || /<script\b|\bon[a-z]+\s*=|\b(?:href|src)\s*=/i.test(svg)) throw new Error(`${iconFile}: icon must be a self-contained inert SVG`)
  if (colors.some((color) => !['#7547FF', '#F7C948'].includes(color)) || colors.length !== 2) throw new Error(`${iconFile}: icon must use exactly StarCi purple and yellow`)
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

const operators = walk(path.join(repoRoot, 'operators'))
  .filter((file) => path.basename(file) === 'operator.json')
  .map((manifestFile) => ({ manifestFile, operator: readJson(manifestFile) }))
  .map(({ manifestFile, operator }) => ({
    id: operator.id,
    domain: operator.domain,
    iconUrl: operatorIconUrl(manifestFile),
    knowledgeCount: operator.contextRefs?.length ?? 0,
    accepts: operator.accepts?.map(({ stage, status }) => `${stage} · ${status}`) ?? [],
    emits: operator.emits?.map(({ stage, status }) => `${stage} · ${status}`) ?? [],
    sideEffects: operator.sideEffects ?? [],
  }))
  .sort((left, right) => left.id.localeCompare(right.id))

const domains = [...new Set(operators.map(({ domain }) => domain))]
  .map((domain) => ({
    id: domain,
    operatorCount: operators.filter((operator) => operator.domain === domain).length,
    skillCount: skills.filter((skill) => skill.domain === domain || skill.id.includes(`-${domain}-`)).length,
  }))
  .sort((left, right) => right.operatorCount - left.operatorCount || left.id.localeCompare(right.id))

writeFileSync(
  path.join(siteRoot, 'src', 'catalog.generated.json'),
  `${JSON.stringify({ version: catalog.systemVersion, skills, operators, domains }, null, 2)}\n`,
)

console.log(`generated site data: ${skills.length} skills, ${operators.length} operators, ${domains.length} domains`)
