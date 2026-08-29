import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const main = readFileSync(path.join(siteRoot, 'src', 'main.tsx'), 'utf8')
const styles = readFileSync(path.join(siteRoot, 'src', 'styles.css'), 'utf8')
const repoRoot = path.resolve(siteRoot, '..', '..')

test('skill cards keep vector icons and the yellow-purple treatment', () => {
  assert.match(main, /const SkillIcon = iconForSkill\(skill\.id\)/)
  assert.match(main, /<SkillIcon size=\{24\} weight="duotone"/)
  assert.match(styles, /\.skill-icon\s*\{[\s\S]*linear-gradient\(135deg, #fff1a8[\s\S]*var\(--accent\)/)
})

test('section artwork stays centered inside its bounded shell', () => {
  assert.match(styles, /\.section-art\s*\{[^}]*margin:\s*0 auto 32px;/)
})

test('scrollable operator surfaces expose scroll shadows', () => {
  assert.match(styles, /\.operator-section \.starci-core-rail-body, \.operator-list\s*\{[\s\S]*background-attachment:\s*local, local, scroll, scroll;/)
})

test('three operator examples own inert two-color icon.svg assets', () => {
  const iconFiles = [
    'operators/platform/tunnel-plan/icon.svg',
    'operators/platform/sonar-service-reconcile/icon.svg',
    'operators/platform/observability-reconcile/icon.svg',
  ]
  for (const relativeFile of iconFiles) {
    const svg = readFileSync(path.join(repoRoot, relativeFile), 'utf8')
    const colors = [...new Set(svg.match(/#[0-9a-f]{6}/gi)?.map((color) => color.toUpperCase()) ?? [])].sort()
    assert.deepEqual(colors, ['#7547FF', '#F7C948'])
    assert.match(svg, /<svg[^>]*viewBox="0 0 64 64"[^>]*>/)
    assert.doesNotMatch(svg, /<script\b|\bon[a-z]+\s*=|\b(?:href|src)\s*=/i)
  }
  assert.match(main, /operator\.iconUrl[\s\S]*<img className="operator-icon-art"/)
  assert.match(styles, /\.operator-icon-custom\s*\{[^}]*border-color:\s*rgba\(247,201,72/)
})

test('v7 site copy derives inventory and assigns routing only to the machine', () => {
  assert.match(main, /placeholder=\{`Search \$\{catalog\.skills\.length\} skills`\}/)
  assert.match(main, /supplies exact context and input, validates one typed output, then the machine routes on that output/)
  assert.match(main, /<span>context \+ input<\/span>/)
  assert.match(main, /<span>output<\/span>/)
  assert.match(main, /label="Release 7\.0" fact="ATOMIC OPERATORS"/)
  assert.doesNotMatch(main, /Search 45 skills|emitted decision|Release 6\.2/)
})

test('mobile operator rows preserve the custom icon, identity, and output-count affordance', () => {
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*\.operator-row\s*\{\s*grid-template-columns:\s*44px minmax\(0, 1fr\) auto;/)
})
