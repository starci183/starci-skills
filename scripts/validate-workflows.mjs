#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const MARKER = "<!-- starci-workflow: v2 -->"
const KINDS = new Set([
  "consolidation",
  "data-backup",
  "data-restore",
  "designs",
  "drift",
  "feature",
  "fidel",
  "lint",
  "upgrade",
])
const CONTEXT_ROWS = ["Workdir", "Trust", "App", "Repo / branch", "Purpose", "Workflow", "Phase", "Touching"]
const OUTPUT_HEADINGS = ["OUTPUTS", "CHANGES", "NEED APPROVALS", "WARNINGS", "REJECTED", "OWED"]
const OUTPUT_HEADERS = [
  "| Concept | Result |",
  "| Tree | Details |",
  "| Question | Options |",
  "| Warning | Impact |",
  "| Rejected | Instead | Why |",
  "| Owed | Cleared by |",
]

const markdownFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return markdownFiles(path)
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : []
  })

const phaseSections = (text) => {
  const matches = [...text.matchAll(/^## (plan|review|apply)(?:\s+.*)?$/gim)]
  return matches.map((match, index) => ({
    phase: match[1].toLowerCase(),
    text: text.slice(match.index, matches[index + 1]?.index ?? text.length),
  }))
}

export const validateWorkflow = (relativePath, text) => {
  if (!text.includes(MARKER)) return { legacy: true, errors: [] }

  const errors = []
  const segments = relativePath.split(/[\\/]/)
  if (segments.length !== 3 || !segments[2].endsWith(".md")) {
    errors.push("path must be <kind>/<app>/<name>.md")
  } else if (!KINDS.has(segments[0])) {
    errors.push(`unknown workflow kind: ${segments[0]}`)
  }

  const sections = phaseSections(text)
  if (sections.length === 0 || sections[0].phase !== "plan") errors.push("first phase must be plan")

  for (const [index, section] of sections.entries()) {
    if (!section.text.includes("### CONTEXT")) errors.push(`${section.phase}[${index}]: missing CONTEXT`)
    for (const row of CONTEXT_ROWS) {
      if (!section.text.includes(`| ${row} |`)) errors.push(`${section.phase}[${index}]: missing context row ${row}`)
    }
    if (!section.text.includes(`| Phase | ${section.phase} |`)) {
      errors.push(`${section.phase}[${index}]: CONTEXT phase value does not match heading`)
    }
    for (const heading of OUTPUT_HEADINGS) {
      if (!section.text.includes(`### ${heading}`)) errors.push(`${section.phase}[${index}]: missing ${heading}`)
    }
    for (const header of OUTPUT_HEADERS) {
      if (!section.text.includes(header)) errors.push(`${section.phase}[${index}]: missing table ${header}`)
    }
  }

  const applyIndex = sections.findIndex(({ phase }) => phase === "apply")
  if (applyIndex >= 0) {
    const approvedReview = sections
      .slice(0, applyIndex)
      .some(({ phase, text: sectionText }) => phase === "review" && /Approved revision\s*:/i.test(sectionText))
    if (!approvedReview) errors.push("apply requires an earlier Review with Approved revision")
    if (!/Applied revision\s*:/i.test(sections[applyIndex].text)) {
      errors.push("apply must cite Applied revision")
    }
    if (segments[0] === "designs") {
      if (!/Baseline commit\s*:/i.test(sections[applyIndex].text)) {
        errors.push("design Apply must cite Baseline commit")
      }
      if (!/Tracked diff\s*:/i.test(sections[applyIndex].text)) {
        errors.push("design Apply must cite Tracked diff")
      }
    }
  }

  return { legacy: false, errors }
}

export const validateWorkflowTree = (root) => {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return { checked: 0, legacy: 0, errors: [`workflow root does not exist: ${root}`] }
  }

  const errors = []
  let checked = 0
  let legacy = 0
  for (const file of markdownFiles(root)) {
    const shown = relative(root, file).split(sep).join("/")
    const result = validateWorkflow(shown, readFileSync(file, "utf8"))
    if (result.legacy) {
      legacy += 1
      continue
    }
    checked += 1
    errors.push(...result.errors.map((error) => `${shown}: ${error}`))
  }
  return { checked, legacy, errors }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const rootFlag = process.argv.indexOf("--root")
  const root = resolve(rootFlag >= 0 ? process.argv[rootFlag + 1] : ".workflows")
  const result = validateWorkflowTree(root)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.errors.length > 0) process.exitCode = 1
}
