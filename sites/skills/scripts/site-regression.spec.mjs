// The page may only say what the tree says. These checks pin the two ways that can break: the
// generated catalog drifting from the runtime files it is read from, and the page copy stating a
// claim, a count, or a v7 shape the v8 tree does not carry.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(siteRoot, '..', '..')
const read = (...p) => readFileSync(path.join(siteRoot, ...p), 'utf8')
const readRepo = (...p) => readFileSync(path.join(repoRoot, ...p), 'utf8')

const main = read('src', 'main.tsx')
const styles = read('src', 'styles.css')
const html = read('index.html')
const catalog = JSON.parse(read('src', 'catalog.generated.json'))

test('the generated catalog matches the runtime tree it is read from', () => {
  const operatorDirs = readdirSync(path.join(repoRoot, 'operators'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
  assert.equal(catalog.counts.operators, operatorDirs.length)
  assert.equal(catalog.operators.length, catalog.counts.operators)

  const workflowFiles = readdirSync(path.join(repoRoot, 'workflows')).filter((file) => file.endsWith('.json'))
  assert.equal(catalog.counts.workflows, workflowFiles.length)

  const routing = JSON.parse(readRepo('routing.json'))
  const routeCount = Object.values(routing.routes).reduce((total, byDomain) => total + Object.keys(byDomain).length, 0)
  assert.equal(catalog.counts.routes, routeCount)
  assert.equal(Object.keys(routing.routes).length, catalog.counts.operators)

  assert.match(readRepo('INDEX.md'), new RegExp(`^# StarCi Skills ${catalog.version.replace(/\./g, '\\.')}$`, 'm'))
})

test('every operator carries the contract fields the page renders', () => {
  for (const operator of catalog.operators) {
    assert.ok(operator.job.length > 40, `${operator.id}: no job read from operator.md`)
    assert.ok(operator.profile, `${operator.id}: no profile in operator.json`)
    assert.ok(operator.steps > 0, `${operator.id}: no Steps table`)
    assert.ok(operator.outputs.length > 0, `${operator.id}: no Outputs table`)
    assert.ok(operator.stops.length > 0, `${operator.id}: no Stops table`)
    for (const stop of operator.stops) {
      assert.ok(['terminate', 'fallback'].includes(stop.disposition), `${operator.id}/${stop.code}: unknown disposition`)
      assert.ok(stop.domain, `${operator.id}/${stop.code}: not in the merged errors registry`)
    }
  }
})

test('the routing map is closed: every stop domain an operator reaches has one route', () => {
  for (const operator of catalog.operators) {
    const routed = new Set(operator.routes.map((route) => route.domain))
    for (const stop of operator.stops) {
      const domain = stop.domain === 'self' ? operator.domain : stop.domain
      assert.ok(routed.has(domain), `${operator.id}: stop ${stop.code} hands to ${domain}, which routing.json does not route`)
    }
  }
})

test('every workflow branch names a real operator and every chain declares its end', () => {
  const ids = new Set(catalog.operators.map((operator) => operator.id))
  for (const workflow of catalog.workflows) {
    assert.ok(workflow.when.en && workflow.when.vi, `${workflow.id}: when needs both languages`)
    assert.ok(workflow.stepCount > 0)
    assert.ok(workflow.widestStep <= 3, `${workflow.id}: a step runs more than three branches`)
    for (const step of workflow.steps) for (const branch of step) assert.ok(ids.has(branch.operator), `${workflow.id}: unknown operator ${branch.operator}`)
    assert.ok(workflow.ends === 'user' || ids.has(workflow.ends), `${workflow.id}: unknown end ${workflow.ends}`)
    for (const loop of workflow.loops) assert.ok(loop.maxRounds > 0, `${workflow.id}: an uncapped loop`)
  }
})

test('every kind the page lists has a producer inside the tree', () => {
  assert.ok(catalog.kinds.length > 0)
  for (const kind of catalog.kinds) assert.ok(kind.producedBy.length > 0, `${kind.kind}: consumed but never produced`)
})

test('the page copy counts the tree instead of hard-coding it', () => {
  assert.match(main, /catalog\.counts\.operators/)
  assert.match(main, /catalog\.counts\.workflows/)
  assert.match(main, /catalog\.counts\.routes/)
  assert.match(main, /catalog\.counts\.stopCodes/)
  assert.match(main, /catalog\.version/)
  // The entry table and the loop are rendered from SKILL.md, never retyped.
  assert.match(main, /catalog\.entry\.rows\.map/)
  assert.match(main, /catalog\.loop\.diagram\.split\('->'\)/)
  // v7 vocabulary and v7 counts must not survive anywhere in the copy.
  for (const stale of [/13 skills/i, /113 operators/i, /specialized skills/i, /atomic operators/i, /capability graph/i, /Release 7.0/i, /v7.0/i]) {
    assert.doesNotMatch(main, stale)
    assert.doesNotMatch(html, stale)
  }
})

test('the page states the two rules it quotes, attributed to their file', () => {
  assert.match(main, /Only a validated field of <code>response\.json<\/code> does/)
  assert.match(main, /<cite>SKILL\.md — The loop<\/cite>/)
  const flat = (text) => text.replace(/\s+/g, ' ')
  const rule = 'it never decides a value, writes source, or judges a result'
  assert.ok(flat(main).includes(rule), 'the hero must state the entry rule in SKILL.md’s own words')
  const skill = readRepo('SKILL.md')
  assert.ok(flat(skill).includes('Only a validated field of `response.json` does.'), 'SKILL.md no longer states the routing rule this page quotes')
  assert.ok(flat(skill).includes(rule), 'SKILL.md no longer states the entry rule in those words')
})

test('the documentation site is linked from the header, the hero, a banner and the footer', () => {
  assert.match(main, /const DOCS_HREF = '\/docs\/'/)
  const links = main.match(/href=\{DOCS_HREF\}/g) ?? []
  assert.ok(links.length >= 4, `expected at least four /docs/ links, found ${links.length}`)
  assert.match(main, /wholeAction=\{\{ kind: 'link', href: DOCS_HREF/)
  assert.match(styles, /\.docs-banner-body\s*\{/)
})

test('the site keeps the v7 visual language and its Grammar binding', () => {
  assert.match(main, /from '@starci\/grammar\/core'/)
  assert.match(main, /import '@starci\/grammar\/common\.css'/)
  assert.match(main, /import '@starci\/grammar\/core\.css'/)
  assert.match(main, /<Rail label="Operator domains" mode="sticky" width="standard">/)
  assert.match(styles, /--accent: #7547ff;/)
  assert.match(styles, /--lime: #f7c948;/)
  assert.match(styles, /\.hero-system \{[^}]*box-shadow: 18px 18px 0 var\(--lime\);/)
  assert.match(styles, /\.section-art\s*\{[^}]*margin:\s*0 auto 32px;/)
  const { dependencies } = JSON.parse(read('package.json'))
  assert.match(dependencies['@starci/grammar'], /^\d+\.\d+\.\d+$/); assert.equal(dependencies['@starci/grammar'], JSON.parse(readFileSync(new URL('../node_modules/@starci/grammar/package.json', import.meta.url), 'utf8')).version)
})

test('scrollable dark surfaces keep their scroll shadows and the operator rows stay reachable', () => {
  assert.match(styles, /\.operator-section \.starci-core-rail-body, \.operator-list\s*\{[\s\S]*background-attachment:\s*local, local, scroll, scroll;/)
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*\.operator-summary \{\s*grid-template-columns:\s*44px minmax\(0, 1fr\) auto;/)
  assert.match(main, /aria-expanded=\{open\}/)
})

test('the canonical host is kept', () => {
  assert.equal(read('public', 'CNAME').trim(), 'harness.starci.org')
})
