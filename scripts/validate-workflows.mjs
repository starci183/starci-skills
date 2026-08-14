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
const CONTEXT_ROWS = [
  "Workdir",
  "Source",
  "Project",
  "Frontend",
  "Backend",
  "Trust",
  "Skills",
  "App",
  "Repo / branch",
  "Purpose",
  "Workflow root",
  "Workflow",
  "Language",
  "Phase",
  "Touching",
]
const OUTPUT_HEADINGS = ["OUTPUTS", "CHANGES", "NEED APPROVALS", "WARNINGS", "REJECTED", "OWED"]
const OUTPUT_HEADERS = [
  "| Concept | Result |",
  "| Tree | Details |",
  "| Question | Options |",
  "| Warning | Impact |",
  "| Rejected | Instead | Why |",
  "| Owed | Cleared by |",
]
const DESIGN_PREVIEW_HEADER = "| Preview | URL | HTML | SHA-256 | Status |"
const DESIGN_DIRECTION_HEADER = "| Direction | Tab | Status |"

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

const tableRows = (text, header) => {
  const lines = text.split(/\r?\n/)
  const headerIndex = lines.indexOf(header)
  if (headerIndex < 0) return []
  const rows = []
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.startsWith("|")) break
    rows.push(line)
  }
  return rows
}

const contextValue = (text, field) => {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return text.match(new RegExp(`^\\|\\s*${escaped}\\s*\\|\\s*(.*?)\\s*\\|$`, "im"))?.[1]?.trim() ?? ""
}

const normalizedPath = (value) => value.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase()

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
    if (contextValue(section.text, "Language") && !section.text.includes("| Language | vi |")) {
      errors.push(`${section.phase}[${index}]: workflow language must be vi`)
    }
    const source = normalizedPath(contextValue(section.text, "Source"))
    const trust = normalizedPath(contextValue(section.text, "Trust"))
    const skills = normalizedPath(contextValue(section.text, "Skills"))
    const workflowRoot = normalizedPath(contextValue(section.text, "Workflow root"))
    const workflow = normalizedPath(contextValue(section.text, "Workflow"))
    if (source && trust !== `${source}/.claude`) {
      errors.push(`${section.phase}[${index}]: Trust must resolve from Source/.claude`)
    }
    if (trust && skills !== `${trust}/skills`) {
      errors.push(`${section.phase}[${index}]: Skills must resolve from Trust/skills`)
    }
    if (source && workflowRoot !== `${source}/.workflows`) {
      errors.push(`${section.phase}[${index}]: Workflow root must resolve from Source/.workflows`)
    }
    if (workflowRoot && !workflow.startsWith(`${workflowRoot}/`)) {
      errors.push(`${section.phase}[${index}]: Workflow must live under Workflow root`)
    }
    if (segments[0] === "designs") {
      for (const field of ["Project", "Frontend", "Backend"]) {
        if (section.text.includes(`| ${field} |`) && !contextValue(section.text, field)) {
          errors.push(`${section.phase}[${index}]: unresolved ${field}`)
        }
      }
    }
    for (const heading of OUTPUT_HEADINGS) {
      if (!section.text.includes(`### ${heading}`)) errors.push(`${section.phase}[${index}]: missing ${heading}`)
    }
    for (const header of OUTPUT_HEADERS) {
      if (!section.text.includes(header)) errors.push(`${section.phase}[${index}]: missing table ${header}`)
    }
    if (segments[0] === "designs" && section.phase === "plan") {
      if (!section.text.includes(DESIGN_PREVIEW_HEADER)) {
        errors.push(`plan[${index}]: missing tracked tabbed HTML preview`)
      } else {
        const previewRows = tableRows(section.text, DESIGN_PREVIEW_HEADER)
        if (previewRows.length !== 1) errors.push(`plan[${index}]: design requires exactly one preview URL`)
        for (const row of previewRows) {
          const port = Number(row.match(/https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)/i)?.[1])
          if (!Number.isInteger(port) || port < 8080 || port > 65535) {
            errors.push(`plan[${index}]: preview URL port must be at least 8080`)
          }
          if (!/\b[a-f0-9]{64}\b/i.test(row)) {
            errors.push(`plan[${index}]: preview row must carry a SHA-256 digest`)
          }
          if (!/index\.html/i.test(row)) errors.push(`plan[${index}]: preview must track one index.html`)
        }
      }
      if (!section.text.includes(DESIGN_DIRECTION_HEADER)) {
        errors.push(`plan[${index}]: missing direction tabs`)
      } else {
        const directionRows = tableRows(section.text, DESIGN_DIRECTION_HEADER)
        if (directionRows.length < 2 || directionRows.length > 4) {
          errors.push(`plan[${index}]: design requires two to four direction tabs`)
        }
      }
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
