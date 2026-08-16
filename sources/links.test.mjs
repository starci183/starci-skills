/**
 * The link gate: nothing in this tree points at a file that is not there.
 *
 *   node --test links.test.mjs
 *
 * WHY THIS EXISTS. This tree is held together by relative links — a router into an index, an index
 * into a law, a law into the artifact enforcing it, a skill into the reference carrying its steps.
 * None of them is compiled, so a rename, a move or a merged duplicate breaks them in silence, and
 * the break is invisible until a reader follows one mid-task.
 *
 * The failure it was written after: a law was deleted as a duplicate and the index kept listing it,
 * so the reading order named a file that had stopped existing. That is the shape of the whole
 * class. Deleting is the operation this gate protects, which matters because consolidating two
 * statements of one concept into one is the only safe way to make this tree smaller, and it is
 * exactly the operation that leaves dangling links behind.
 *
 * `parity.test.mjs` proves a law names an artifact and that the artifact exists. This proves the
 * weaker claim across everything: whatever any file points at, it is there.
 */
import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"
import test from "node:test"

/** The trust root, resolved from this file so the gate travels with the tree. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

/** Directories the tool writes rather than the tree owns; they carry no trust and no links. */
const NOT_OURS = new Set([
  ".git",
  ".testtmp",
  "worktrees",
  "projects",
  "todos",
  "statsig",
  "shell-snapshots",
  "ide",
  "node_modules",
])

/**
 * Strip code before looking for links, because code is not a claim about the filesystem.
 *
 * `](x)` is a link in prose and an accident in source. JavaScript alone produces it constantly -
 * `rows[i](arg)`, a destructured call, a regex holding `|`. Reading those as links does not merely
 * add noise: it makes the gate fail on files that are perfectly correct, and a gate that cries wolf
 * gets muted, which costs more than the dangling link it was written to catch.
 *
 * This mattered the moment the shelves grew past a thousand worked examples. Before that the gate
 * was accidentally right - there was almost no code for it to misread.
 *
 * Fenced blocks go first, then inline spans. Order matters: an inline backtick inside a fence is
 * part of the code, not a span of its own, and stripping spans first would leave the fence torn open
 * and swallow the prose after it.
 */
const withoutCode = (text) =>
  text
    .replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[ \t]*$/gm, "")
    .replace(/(`+)[^`\n]*?\1/g, "")

const markdownFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (NOT_OURS.has(entry.name)) return []
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) return markdownFiles(entryPath)
    return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : []
  })

const shown = (absolute) => absolute.slice(ROOT.length + 1).replace(/\\/g, "/")

test("every relative link in the trust tree resolves to something that exists", () => {
  const broken = []
  for (const file of markdownFiles(ROOT)) {
    const text = withoutCode(readFileSync(file, "utf8"))
    for (const [, target] of text.matchAll(/\]\(([^)]+)\)/g)) {
      // A scheme, a bare anchor or a placeholder is not a claim about the filesystem.
      if (/^(?:[a-z][a-z0-9+.-]*:|#|<)/i.test(target)) continue
      const [path] = target.split("#")
      if (path === "") continue
      if (!existsSync(resolve(dirname(file), path))) broken.push(`${shown(file)} -> ${target}`)
    }
  }
  assert.deepEqual(
    broken,
    [],
    `the tree points at files that are not there: ${broken.join("; ")}. A reader following a dead link mid-task cannot tell whether the rule moved, was merged into another file, or was withdrawn - and those three call for three different responses.`,
  )
})
