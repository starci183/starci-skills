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
const DESIGN_COMPONENT_DELTA_HEADER =
  "| Layer | Owner | Action | Current path | Final path | Parent / call sites | Contract | Reason |"
const DESIGN_PROPS_DELTA_HEADER =
  "| Owner | Prop / API | Action | Before | After | Producers / call sites | Migration proof |"
const FIDELITY_EVENTS = new Set(["start", "feedback", "end", "finality"])
const RELATED_BUGS_HEADER = "| Finding | Evidence | Classification | Route |"
const DESIGN_LAYERS = new Set(["route", "page", "layout", "overlay", "block", "composite", "branch", "leaf", "shell"])
const DESIGN_COMPONENT_ACTIONS = new Set(["REUSE", "ADD", "MODIFY", "MOVE", "REMOVE"])
const DESIGN_PROP_ACTIONS = new Set([
  "KEEP",
  "ADD",
  "REMOVE",
  "RENAME",
  "RETYPE",
  "MAKE_REQUIRED",
  "MAKE_OPTIONAL",
  "CHANGE_DEFAULT",
])

const markdownFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return markdownFiles(path)
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : []
  })

const phaseSections = (text) => {
  const matches = [...text.matchAll(/^## (plan|review|apply|layout|block|execute|complete|start|feedback|end|finality)(?:\s+.*)?$/gim)]
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

const tableCells = (row) => row.split("|").slice(1, -1).map((cell) => cell.trim().replace(/^`|`$/g, ""))
const isDeferred = (value) => /(?:\*|<[^>]+>|\b(?:tbd|todo|later|apply will|apply decides)\b)/i.test(value)

const contextValue = (text, field) => {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return text.match(new RegExp(`^\\|\\s*${escaped}\\s*\\|\\s*(.*?)\\s*\\|$`, "im"))?.[1]?.trim() ?? ""
}

const recordValue = (text, field) => {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return text.match(new RegExp(`^${escaped}:\\s*(.*?)\\s*$`, "im"))?.[1]?.trim() ?? ""
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
  const startsWithFidelitySession = segments[0] === "fidel" && sections[0]?.phase === "start"
  if (sections.length === 0 || (!startsWithFidelitySession && sections[0].phase !== "plan")) {
    errors.push(segments[0] === "fidel" ? "first fidelity event must be start or legacy plan" : "first phase must be plan")
  }

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
    // Historical tabbed-preview records remain valid evidence. New design journeys declare a
    // registry Session id and are validated by the gate/session schemas instead.
    if (segments[0] === "designs" && section.phase === "plan" && !/Session id\s*:/i.test(section.text)) {
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
    if (segments[0] === "designs" && section.phase === "review" && /Approved revision\s*:/i.test(section.text)) {
      if (!section.text.includes("### COMPONENT DELTA")) {
        errors.push(`review[${index}]: missing COMPONENT DELTA heading`)
      }
      if (!section.text.includes(DESIGN_COMPONENT_DELTA_HEADER)) {
        errors.push(`review[${index}]: missing component delta table`)
      } else {
        const rows = tableRows(section.text, DESIGN_COMPONENT_DELTA_HEADER)
        if (rows.length === 0) errors.push(`review[${index}]: component delta table is empty`)
        for (const row of rows) {
          const [layer, owner, action, currentPath, finalPath, callSites, contract, reason] = tableCells(row)
          if (!DESIGN_LAYERS.has(layer)) errors.push(`review[${index}]: unknown component layer ${layer}`)
          if (!DESIGN_COMPONENT_ACTIONS.has(action)) errors.push(`review[${index}]: unknown component action ${action}`)
          if ([owner, currentPath, finalPath, callSites, contract, reason].some(isDeferred)) {
            errors.push(`review[${index}]: component delta contains deferred inventory`)
          }
        }
      }
      if (!section.text.includes("### PROPS DELTA")) {
        errors.push(`review[${index}]: missing PROPS DELTA heading`)
      }
      if (!section.text.includes(DESIGN_PROPS_DELTA_HEADER)) {
        errors.push(`review[${index}]: missing props delta table`)
      } else {
        const rows = tableRows(section.text, DESIGN_PROPS_DELTA_HEADER)
        if (rows.length === 0) errors.push(`review[${index}]: props delta table is empty`)
        const propOwners = new Set()
        for (const row of rows) {
          const [owner, prop, action, before, after, callSites, proof] = tableCells(row)
          propOwners.add(owner)
          if (!DESIGN_PROP_ACTIONS.has(action)) errors.push(`review[${index}]: unknown props action ${action}`)
          if ([owner, prop, before, after, callSites, proof].some(isDeferred)) {
            errors.push(`review[${index}]: props delta contains deferred inventory`)
          }
        }
        for (const row of tableRows(section.text, DESIGN_COMPONENT_DELTA_HEADER)) {
          const [, owner, action] = tableCells(row)
          if (action !== "REUSE" && !propOwners.has(owner)) {
            errors.push(`review[${index}]: missing props verdict for ${owner}`)
          }
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

  if (segments[0] === "fidel" && sections.some(({ phase }) => FIDELITY_EVENTS.has(phase))) {
    let activeSessionId = ""
    let lastEvent = ""
    let sawEnd = false
    let finalized = false
    for (const [index, section] of sections.entries()) {
      if (!FIDELITY_EVENTS.has(section.phase)) continue
      const sessionId = recordValue(section.text, "Session id")
      const status = recordValue(section.text, "Session status")
      if (section.phase === "start") {
        if (activeSessionId && !finalized) errors.push(`start[${index}]: previous fidelity session is still open`)
        if (activeSessionId && !/Continuation of\s*:/i.test(section.text)) {
          errors.push(`start[${index}]: continuation must cite the finalized session`)
        }
        activeSessionId = sessionId
        lastEvent = "start"
        sawEnd = false
        finalized = false
        if (!sessionId) errors.push(`start[${index}]: missing Session id`)
        if (status !== "open") errors.push(`start[${index}]: Session status must be open`)
        continue
      }
      if (!activeSessionId) {
        errors.push(`${section.phase}[${index}]: fidelity event requires an earlier start`)
        continue
      }
      if (sessionId !== activeSessionId) errors.push(`${section.phase}[${index}]: Session id must match start`)
      if (finalized) errors.push(`${section.phase}[${index}]: finalized fidelity session cannot receive more events`)
      if (section.phase === "feedback") {
        if (status !== "open") errors.push(`feedback[${index}]: Session status must be open`)
        lastEvent = "feedback"
        continue
      }
      if (section.phase === "end") {
        if (status !== "open") errors.push(`end[${index}]: Session status must be open`)
        if (!section.text.includes("### RELATED BUGS")) errors.push(`end[${index}]: missing RELATED BUGS heading`)
        if (!section.text.includes(RELATED_BUGS_HEADER)) errors.push(`end[${index}]: missing related bugs table`)
        sawEnd = true
        lastEvent = "end"
        continue
      }
      if (section.phase === "finality") {
        if (!sawEnd || lastEvent !== "end") errors.push(`finality[${index}]: finality requires the latest event to be end`)
        if (status !== "finalized") errors.push(`finality[${index}]: Session status must be finalized`)
        if (recordValue(section.text, "Session finalized") !== activeSessionId) {
          errors.push(`finality[${index}]: Session finalized must match Session id`)
        }
        finalized = true
        lastEvent = "finality"
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
