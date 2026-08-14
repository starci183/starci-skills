/**
 * The skill gate: a procedure may not point at something that is not there.
 *
 *   node --test skills.test.mjs
 *
 * WHY THIS EXISTS. `parity.test.mjs` holds canon to its artifacts, and nothing held the skills to
 * anything. A skill is mostly references — to the trust files it must read first, to the reference
 * pages carrying its steps table, and to the scripts that are its actual gates — and every one of
 * those is a path typed by hand into prose, where nothing recompiles when the target moves.
 *
 * It was written after a sweep found three of these at once, all silent: two skills invoking
 * `<trust-root>/.claude/scripts/...` when the lock defines the trust root AS the `.claude`
 * directory, so the path doubled the folder and could never resolve; and the same server started
 * three different ways across four skills — once repo-relative, once skill-relative, once by
 * placeholder — of which only the placeholder form survives being run from another repository,
 * which is the normal case, because the target is rarely the repository holding trust.
 *
 * A broken link in a skill fails at the worst moment: mid-run, after the context lock is printed
 * and the user is waiting, when the honest recovery is to stop and ask.
 */
import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"
import test from "node:test"

/** The trust root, resolved from this file so the gate travels with the tree. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SKILLS = join(ROOT, "skills")

/** Every markdown file under `skills/`, as absolute paths. */
const markdownFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) return markdownFiles(entryPath)
    return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : []
  })

const skillMarkdown = existsSync(SKILLS) ? markdownFiles(SKILLS) : []
const shown = (absolute) => absolute.slice(ROOT.length + 1).replace(/\\/g, "/")

// Whether a skill's markdown LINKS resolve is not asked here: `links.test.mjs` asks it of every
// file in the tree, and a second copy scoped to skills would be the same law in two places.

test("every trust-tree command a skill prints names a script that exists", () => {
  const broken = []
  for (const file of skillMarkdown) {
    const text = readFileSync(file, "utf8")
    for (const [, path] of text.matchAll(/<trust-root>\/(\S+\.(?:mjs|py))/g)) {
      if (!existsSync(join(ROOT, path))) broken.push(`${shown(file)} -> <trust-root>/${path}`)
    }
  }
  assert.deepEqual(
    broken,
    [],
    `skills print commands for scripts that do not exist: ${broken.join("; ")}. The command is the gate; a gate that cannot start is one a run reports as unavailable rather than failed.`,
  )
})

/** Every executable this tree owns, by basename, so a target repository's own script is not judged. */
const trustScripts = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git" || entry.name === "worktrees" || entry.name === "node_modules") return []
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) return trustScripts(entryPath)
    return /\.(?:mjs|py)$/.test(entry.name) ? [entry.name] : []
  })

test("a skill invokes a trust-tree script only through <trust-root>", () => {
  // The target repository is rarely the one holding trust, so a path relative to the working
  // directory resolves to nothing there. The lock already carries the one absolute value that
  // works, and `<trust-root>` is how a skill spends it.
  //
  // Only scripts this tree OWNS are judged. A skill may legitimately print a command that runs the
  // target repository's own script, and that one is anchored by the target, not by trust.
  const owned = new Set(trustScripts(ROOT))
  const offenders = []
  for (const file of skillMarkdown) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      if (!/\b(?:node|python|python3)\s/.test(line)) continue
      const invoked = [...line.matchAll(/([\w.-]+\.(?:mjs|py))\b/g)].map(([, name]) => name)
      if (!invoked.some((name) => owned.has(name))) continue
      if (line.includes("<trust-root>/.claude/")) {
        offenders.push(`${shown(file)}: doubles the trust folder — ${line.trim()}`)
        continue
      }
      if (!line.includes("<trust-root>/")) {
        offenders.push(`${shown(file)}: not anchored to <trust-root> — ${line.trim()}`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `skills start trust scripts by a path that depends on where the run happens: ${offenders.join("; ")}. Trust root is the .claude directory itself, so \`<trust-root>/.claude/...\` names it twice and a bare relative path names it never.`,
  )
})

test("a skill that names another skill also carries the law of naming one", () => {
  // A `$other-skill` token is a handoff: the run is being told where the work goes next, or which
  // procedure it has to detour through and return from. `skill-shape.md` is what decides which of the
  // two it is, and what the phase owes before it may say either.
  //
  // The failure this was written after: the token appeared in three skills, at exactly the three
  // phase boundaries, and NO file in the tree defined it. So the honest reading of "Route to
  // $starci-fe-design-review" was a note to the reader, and the runs stopped there — the selection
  // was made, the record was written and validated, and the phase that had every prerequisite in
  // hand ended its turn. Six cases sat at `direction-selected` with no successor.
  //
  // The token is cheap to type and the law behind it is not, which is exactly the pair that drifts.
  const naked = []
  for (const file of skillMarkdown) {
    if (!file.endsWith("SKILL.md")) continue
    const text = readFileSync(file, "utf8")
    const named = [...text.matchAll(/\$(starci-[a-z-]+)/g)].map(([, name]) => name)
    const others = new Set(named.filter((name) => !file.includes(`${name}/SKILL.md`)))
    if (others.size === 0) continue
    if (!text.includes("skill-shape.md")) {
      naked.push(`${shown(file)} names ${[...others].join(", ")} but never reaches skill-shape.md`)
    }
  }
  assert.deepEqual(
    naked,
    [],
    `skills hand work to another skill without the law that says how: ${naked.join("; ")}. A skill name in prose is a note to the reader; skill-shape.md is what makes it a transition, a detour that returns, or a finding carried back.`,
  )
})

test("every skill carries a frontmatter name matching its folder", () => {
  const wrong = []
  for (const entry of readdirSync(SKILLS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillFile = join(SKILLS, entry.name, "SKILL.md")
    if (!existsSync(skillFile) || !statSync(skillFile).isFile()) {
      wrong.push(`${entry.name}: has no SKILL.md`)
      continue
    }
    const declared = readFileSync(skillFile, "utf8").match(/^---\r?\n(?:.*\r?\n)*?name:\s*(\S+)/)
    if (declared === null) wrong.push(`${entry.name}: declares no frontmatter name`)
    else if (declared[1] !== entry.name) wrong.push(`${entry.name}: declares ${declared[1]}`)
  }
  assert.deepEqual(
    wrong,
    [],
    `skill folders and their declared names disagree: ${wrong.join("; ")}. The folder is what a router links and the name is what an invocation types, so a difference makes one of the two unreachable.`,
  )
})

test("every capability has exactly Plan, Review and Apply", () => {
  const phasesByCapability = new Map()
  const invalid = []
  for (const entry of readdirSync(SKILLS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const match = entry.name.match(/^(.*)-(plan|review|apply)$/)
    if (match === null) {
      invalid.push(entry.name)
      continue
    }
    const [, capability, phase] = match
    const phases = phasesByCapability.get(capability) ?? []
    phases.push(phase)
    phasesByCapability.set(capability, phases)
  }

  const incomplete = [...phasesByCapability.entries()]
    .map(([capability, phases]) => [capability, [...phases].sort()])
    .filter(([, phases]) => phases.join(",") !== "apply,plan,review")
    .map(([capability, phases]) => `${capability}: ${phases.join(", ")}`)

  assert.deepEqual(invalid, [], `skills outside Plan -> Review -> Apply: ${invalid.join(", ")}`)
  assert.deepEqual(incomplete, [], `incomplete capability trios: ${incomplete.join("; ")}`)
})

test("every phase carries the workflow contract", () => {
  const required = [
    "## CONTEXT",
    "## PROCESS",
    "## OUTPUT",
    "### CONTEXT",
    "### OUTPUTS",
    "### CHANGES",
    "### NEED APPROVALS",
    "### WARNINGS",
    "### REJECTED",
    "### OWED",
  ]
  const broken = []
  for (const entry of readdirSync(SKILLS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillFile = join(SKILLS, entry.name, "SKILL.md")
    const text = readFileSync(skillFile, "utf8")
    const missing = required.filter((token) => !text.includes(token))
    if (!text.includes("skill-shape.md")) missing.push("skill-shape.md")
    if (missing.length > 0) broken.push(`${entry.name}: ${missing.join(", ")}`)
  }
  assert.deepEqual(broken, [], `skills missing the workflow contract: ${broken.join("; ")}`)
})

test("Plan routes to Review and Review routes to Apply", () => {
  const broken = []
  for (const entry of readdirSync(SKILLS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const match = entry.name.match(/^(.*)-(plan|review|apply)$/)
    if (match === null || match[2] === "apply") continue
    const next = match[2] === "plan" ? `${match[1]}-review` : `${match[1]}-apply`
    const text = readFileSync(join(SKILLS, entry.name, "SKILL.md"), "utf8")
    if (!text.includes(`$${next}`)) broken.push(`${entry.name}: does not route to $${next}`)
  }
  assert.deepEqual(broken, [], `phase routing is incomplete: ${broken.join("; ")}`)
})

test("FE Design commits its baseline at Apply, then writes only target source", () => {
  const plan = readFileSync(join(SKILLS, "starci-fe-design-plan", "SKILL.md"), "utf8")
  const review = readFileSync(join(SKILLS, "starci-fe-design-review", "SKILL.md"), "utf8")
  const apply = readFileSync(join(SKILLS, "starci-fe-design-apply", "SKILL.md"), "utf8")

  assert.match(plan, /Plan writes no production source/)
  assert.match(review, /Review writes no target source/)
  assert.match(apply, /Commit before editing/)
  assert.match(apply, /Baseline commit: <sha>/)
  assert.match(apply, /git diff <baseline>/)
  assert.match(apply, /directly at final source paths/)
})

test("every skill has current UI metadata", () => {
  const broken = []
  for (const entry of readdirSync(SKILLS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const metadata = join(SKILLS, entry.name, "agents", "openai.yaml")
    if (!existsSync(metadata)) {
      broken.push(`${entry.name}: missing agents/openai.yaml`)
      continue
    }
    const text = readFileSync(metadata, "utf8")
    if (!text.includes(`$${entry.name}`)) broken.push(`${entry.name}: default prompt misses $${entry.name}`)
  }
  assert.deepEqual(broken, [], `skill UI metadata is stale: ${broken.join("; ")}`)
})

test("skill folders contain no auxiliary README", () => {
  const readmes = []
  for (const entry of readdirSync(SKILLS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = join(SKILLS, entry.name, "README.md")
    if (existsSync(file)) readmes.push(shown(file))
  }
  assert.deepEqual(readmes, [], `skill README files duplicate loaded guidance: ${readmes.join(", ")}`)
})
