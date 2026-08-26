import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const main = readFileSync(path.join(siteRoot, 'src', 'main.tsx'), 'utf8')
const styles = readFileSync(path.join(siteRoot, 'src', 'styles.css'), 'utf8')

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
