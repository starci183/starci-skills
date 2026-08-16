/**
 * The rules that hold `contract.md`.
 *
 * One idea, stated several ways: a structural node is described ONCE, by a key that owns the node's
 * classes, the element it opens, and the reason its children sit that way. An author types the key
 * and nothing else. Everything here exists to make the alternatives - a literal class string, a
 * hand-composed class, a hand-painted marker, an invented key, a bare `div` - stop compiling in
 * review the way a wrong tree already stops compiling in TypeScript.
 *
 * THE STRONGEST RULES HERE ARE NOT RULES. The class vocabulary and the host vocabulary are closed
 * unions in `contracts.ts`, so an off-scale value is unrepresentable rather than forbidden. These
 * rules cover what a type cannot see: which FILE wrote the string, and whether the key exists.
 *
 * TWO DELIBERATE DEPARTURES from the source this was ported from, both recorded so the next reader
 * does not "restore" them:
 *
 *   - NO RULE PATROLS WHAT FILLS A SLOT, and that was measured rather than assumed. A slot resolves
 *     to `LeafComponent<name, props>`, so the compiler was handed an inline arrow, a named function
 *     with no metadata, and metadata carrying the WRONG name: it refused all three. A rule here
 *     would re-check a door the type already holds shut, and cost a rule to keep it doing so.
 *   - `noUnknownSlotRole` is absent, and it is NOT coming back even though the child contract has.
 *     It policed a `slots` object against roles a key declared, and stopped being able to when
 *     contracts collapsed to classes-plus-a-reason. Entries declare their slots again now - but as
 *     a record the COMPILER reads, so a wrong leaf, wrong leaf props, a missing slot or a slot
 *     nobody declared are type errors before any rule runs. Re-adding a rule here would patrol a
 *     door the type already holds shut, which is the weaker of the two and costs a rule to keep.
 *   - The list of banned elements includes `ul`, `ol`, `li` and `form`. The original stopped at the
 *     neutral boxes, from an era when an entry could only open a `div`. An entry names its own host
 *     now, so a hand-written `<ul>` is a node with no key exactly like a hand-written `<div>` - and
 *     leaving it lawful is what let arrangements be filed among the leaves to escape these rules.
 *
 * This module also exports the path helpers and the table reader, because both describe the
 * contract table rather than any one rule. Other law modules import them from here.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"

// -- where things are ---------------------------------------------------------------------------

/**
 * Every prefix a component tree can sit under.
 *
 * ONE TIER, TWO LAYOUTS. A single-app repository keeps the tree at `src/components/*`; a monorepo
 * keeps the same tree, with the same tier names, in a shared package at `packages/ui/src/*`. Only
 * the prefix differs, so a rule that writes the prefix out by hand works in one repository and is
 * BLIND in the other - and blind here does not mean noisy, it means silently wrong in both
 * directions at once. A leaf it cannot recognise is reported for writing the classes a leaf is
 * supposed to write, while every rule that guards the leaf tier stops guarding anything.
 *
 * That is not hypothetical. Pointed at a monorepo, this file produced 46 errors across 28 correct
 * files - every one of them a leaf declaring `meta = { shape: "leaf" }` in `packages/ui/src/leaves`
 * - and the obvious reading was that the repository owed 46 fixes. It owed none.
 *
 * A layout added to this list is added to every rule at once, which is the only reason there is one
 * list rather than a literal per predicate.
 */
export const COMPONENT_ROOTS = ["src/components", "packages/ui/src", "src"]

/** The contract folder, relative to the repository root. */
export const CONTRACT_DIR_RELATIVE = "src/components/contracts"

/**
 * The entry table, relative to the repository root.
 *
 * THIS CONSTANT IS THE ONE THING HERE THAT CAN BE WRONG WITHOUT ANYTHING TURNING RED. When the
 * table moved and this path did not, the reader returned null, every rule that reads it did
 * nothing, and eslint reported a clean tree while an invented key walked through. The twin test
 * asserts a real file parses for exactly that reason - never delete that test to make a move
 * easier.
 */
export const CONTRACT_TABLE_RELATIVE = `${CONTRACT_DIR_RELATIVE}/index.ts`

/** The one component that turns an entry into a real element. */
export const CONTRACT_FRAME_RELATIVE = "src/components/branches/Tree"

/** The tier that owns its own interior, and is therefore outside these rules. */
export const LEAF_DIR_RELATIVE = "src/components/leaves"

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
export const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/**
 * Whether a file sits in one named tier, under any supported layout.
 *
 * @param filename - the file being linted.
 * @param segment - the tier path below the component root, e.g. `leaves` or `branches/Tree`.
 * @returns true when the file is inside that tier in any layout.
 */
export const isInComponentTier = (filename, segment) =>
    COMPONENT_ROOTS.some((root) => normalizePath(filename).includes(`/${root}/${segment}/`))

/**
 * Candidate paths for one component-tree file, one per supported layout.
 *
 * @param relative - path below the component root, e.g. `contracts/index.ts`.
 * @returns one candidate per known root, most specific first.
 */
export const componentCandidates = (relative) => COMPONENT_ROOTS.map((root) => `${root}/${relative}`)

/** True when this file holds the entry table - the one place a class string or a reason is written. */
export const isContractTableFile = (filename) =>
    componentCandidates("contracts/index.ts")
        .some((candidate) => normalizePath(filename).endsWith(`/${candidate}`))

/** True when this file is the frame that renders an entry, and therefore paints its markers. */
export const isContractFrameFile = (filename) => isInComponentTier(filename, "branches/Tree")

/** Named surface branches own fixed vendor-wrapper mechanics around one checked content node. */
export const isSurfaceContractHostFile = (filename) =>
  ["SurfaceCard", "SurfaceAccordionCard", "SurfaceListCard", "SurfaceFormCard"]
      .some((surface) => isInComponentTier(filename, `branches/${surface}`))

/**
 * True when this file is a leaf.
 *
 * A leaf wraps ONE vendor primitive and owns the glue that holds one line together, so it writes
 * that much itself and there is nothing for the contract table to tune.
 *
 * IT IS NOT "A FIXED CLUSTER". That wider wording used to sit here, and it is what let every
 * arrangement in the codebase be filed in this folder: it was the only place a component could
 * write its own classes, so anything lacking a key moved in. The cost was measurable rather than
 * theoretical - entries ended up with class strings byte-for-byte identical to constants typed by
 * hand in the leaf folder, and nothing could see the duplication because no rule reads both.
 *
 * THE EXEMPTION IS A FOLDER, which makes it a policy boundary rather than a type: anyone can escape
 * these rules by filing a component here. What keeps a region out is a question a person asks -
 * does this file arrange two contents? If yes it is a composite. No gate asks that question.
 */
export const isLeafFile = (filename) => isInComponentTier(filename, "leaves")

/** A twin test may build fixture markup by hand; product source may not. */
export const isTestFile = (filename) => /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(normalizePath(filename))

/** Product source lives under `src/`; tooling and config are out of scope. */
export const isSourceFile = (filename) => normalizePath(filename).includes("/src/")

/** Product source these rules govern: under `src/`, not a test, not a leaf, not the frame. */
export const isGovernedFile = (filename) => {
  const file = normalizePath(filename)
  if (!isSourceFile(file) || isTestFile(file)) return false
  return !isLeafFile(file) && !isContractFrameFile(file)
}

// -- reading the table --------------------------------------------------------------------------

/** Parsed tables, keyed by path and invalidated by the file's mtime. */
const cache = new Map()

/** Walk up from a linted file to the contract table; null when none sits above it. */
export const findContractTable = (filename) => {
  /*
   * Every layout's table path is tried at each level, not just the single-app one. Walking up
   * looking only for `src/components/contracts/index.ts` finds nothing in a monorepo, and the
   * reader's own header records what that silence costs: it returns null, every rule that reads it
   * does nothing, and eslint reports a clean tree while an invented key walks through.
   */
  const candidates = componentCandidates("contracts/index.ts")
  let dir = dirname(normalizePath(filename))
  for (let depth = 0; depth < 40; depth += 1) {
    for (const relative of candidates) {
      const candidate = normalizePath(join(dir, relative))
      if (existsSync(candidate)) return candidate
    }
    const parent = dirname(dir)
    if (!parent || parent === dir) return null
    dir = parent
  }
  return null
}

/**
 * The text of one `buildX({ ... })` call, brace-balanced.
 *
 * READING TO THE END OF THE FILE IS NOT GOOD ENOUGH, and that is not a hypothetical. The moment a
 * second table joined the first in this file, a reader that sliced to EOF collected unrelated keys
 * as node keys. The balanced reader stops at the actual end of the selected table.
 */
const balancedCall = (source, builder) => {
  const at = source.indexOf(`${builder}({`)
  if (at < 0) return null
  const open = source.indexOf("{", at)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === "{") depth += 1
    else if (ch === "}") {
      depth -= 1
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  return null
}

/** Every key of one table, read off its own call and no other. */
const parseKeys = (source, builder) => {
  const body = balancedCall(source, builder)
  if (!body) return []
  return [...body.matchAll(/^\s{4}"([a-z][a-z-]*)":\s*\{/gm)].map((hit) => hit[1])
}

/**
 * Read the contract table that governs a linted file.
 *
 * Returns null when there is no table above the file, or when it cannot be read as keys. A rule
 * that gets null must do NOTHING: a table nobody can read is a reason to stay quiet, never a reason
 * to call every call site wrong.
 *
 * Parsing is deliberately textual. An ESLint rule runs under one parser on one file at a time and
 * cannot import a TypeScript module.
 *
 * @param filename - The file being linted.
 */
/**
 * The element one contract key opens, read from the table.
 *
 * WHY A RULE NEEDS THIS. The document's main landmark used to be drawn by a branch called `Main`,
 * so a rule could look for that name. The element now belongs to the entry - `host: "main"` beside
 * the classes and the children - because a `<main>` is a MEANING and meaning lives with the rest of
 * what the key fixes. A rule that still looks for the branch reports a correct landmark as missing.
 *
 * Textual, for the same reason `readContracts` is: a rule runs under one parser on one file and
 * cannot import a TypeScript module. Absent `host` means `div`, which is what the frame defaults to.
 *
 * @param filename - The file being linted, used to locate the table above it.
 * @param key - The contract key to read.
 * @returns The host element name, or null when the table or the key cannot be read.
 */
export const contractHostOf = (filename, key) => {
  const path = findContractTable(filename)
  if (!path) return null
  let source = null
  try {
    source = readFileSync(path, "utf8")
  } catch {
    return null
  }
  const opening = source.indexOf(`"${key}": {`)
  if (opening === -1) return null
  // The entry ends at the next key at the same indentation; a bounded window is enough and avoids
  // brace-matching a file this rule only needs one field from.
  /*
   * The window ENDS at the next key at the same indentation, which is what the comment above has
   * always said and what the code did not do. A fixed 2000-character slice runs straight into the
   * entries below it, so an entry declaring no host inherited the first one it could see - and any
   * key written a few lines above `routed-page-main` was reported as drawing the document's main
   * landmark. The rule was right about the law and wrong about where one entry stops.
   */
  const rest = source.slice(opening + 1)
  const nextKey = rest.search(/\n[ ]{4}"[a-z0-9-]+": \{/)
  const window = nextKey === -1 ? source.slice(opening) : source.slice(opening, opening + 1 + nextKey)
  const host = window.match(/\bhost:\s*"([a-z]+)"/)
  return host ? host[1] : "div"
}

export const readContracts = (filename) => {
  const path = findContractTable(filename)
  if (!path) return null
  let stamp = null
  try {
    stamp = statSync(path).mtimeMs
  } catch {
    return null
  }
  const hit = cache.get(path)
  if (hit && hit.stamp === stamp) return hit.value
  let source = null
  try {
    source = readFileSync(path, "utf8")
  } catch {
    return null
  }
  const keys = parseKeys(source, "buildContracts")
  const value = keys.length > 0 ? { path, keys } : null
  cache.set(path, { stamp, value })
  return value
}

// -- reading who uses the table -------------------------------------------------------------------

/**
 * The repository root the table hangs from, or null when the path is not a table path.
 *
 * The longest matching layout wins, because `src/contracts/index.ts` is a suffix of nothing here but
 * would happily claim a monorepo path if the shortest candidate were tried first, and the root it
 * returned would be a directory that does not exist.
 */
const repositoryRootOf = (tablePath) => {
  const path = normalizePath(tablePath)
  const candidates = [...componentCandidates("contracts/index.ts")].sort((a, b) => b.length - a.length)
  for (const candidate of candidates) {
    if (path.endsWith(`/${candidate}`)) return path.slice(0, path.length - candidate.length - 1)
  }
  return null
}

/**
 * Every directory a call site of a contract key can be written in, for the repository holding one
 * table.
 *
 * THE WORKSPACE SIBLINGS ARE THE WHOLE POINT, and leaving them out is not a smaller answer, it is
 * the wrong one. A monorepo keeps the table in the shared package and renders it from the apps: in
 * `nivo-fe` a handful of references sit beside the table under `packages/ui/src` and the rest live
 * in the `src` tree of each workspace under `apps`. A reader that walked only `COMPONENT_ROOTS`
 * would see those few, call every other
 * key dead, and hand back a list of deletions that would take working screens off the air - the same
 * shape of failure `COMPONENT_ROOTS` itself was written to end.
 *
 * Roots nested inside another root are dropped, so a tree is walked once rather than once per prefix
 * that happens to name it.
 *
 * @param tablePath - the contract table's own path.
 * @returns existing search roots, or an empty list when the repository root cannot be resolved.
 */
export const contractSearchRoots = (tablePath) => {
  const root = repositoryRootOf(tablePath)
  if (!root) return []
  const candidates = new Set(COMPONENT_ROOTS.map((relative) => `${root}/${relative}`))
  for (const group of ["apps", "packages"]) {
    let entries = []
    try {
      entries = readdirSync(`${root}/${group}`, { withFileTypes: true })
    } catch {
      entries = []
    }
    for (const entry of entries) {
      if (entry.isDirectory()) candidates.add(`${root}/${group}/${entry.name}/src`)
    }
  }
  const present = [...candidates].filter((dir) => {
    try {
      return statSync(dir).isDirectory()
    } catch {
      return false
    }
  })
  return present.filter((dir) => !present.some((other) => other !== dir && dir.startsWith(`${other}/`)))
}

/** Directories that hold copies of source rather than source, and are never a call site. */
const UNWALKED_DIRS = new Set(["node_modules", ".next", "dist", ".artifacts"])

/** Files a reference can be written in. */
const WALKED_FILES = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/

/**
 * Every way a key is named outside the table.
 *
 * All five are textual on purpose. The walk reads hundreds of files that are not the file being
 * linted, under whatever parser that file would need, and a reference is a quoted key in every one
 * of these forms - so a regex reads exactly as much as an AST would and reads it once.
 *
 * A story and a test count. They render the key, which is what the question asks: a shape proven in
 * Storybook and nowhere else is documented rather than dead, and deleting it deletes the proof.
 */
const REFERENCE_PATTERNS = [
  /\bcontract\s*=\s*\{?\s*"([a-z][a-z0-9-]*)"/g,
  /\bcontract\s*:\s*"([a-z][a-z0-9-]*)"/g,
  /\bdefineContractComponent\(\s*"([a-z][a-z0-9-]*)"/g,
  /\bdefineContractProjection\(\s*"([a-z][a-z0-9-]*)"/g,
  /\bCONTRACTS\[\s*"([a-z][a-z0-9-]*)"\s*\]/g,
]

/**
 * A key does not always reach the frame written next to it, and the difference is not stylistic.
 *
 * A component that picks between sibling entries names them somewhere else entirely: in
 * `starci-academy-fe`, `RankedUserRow` resolves its verdict through a helper typed `ContractKey` that
 * RETURNS the key, and hands the frame a variable. The five forms above see nothing there, and three
 * keys that draw the leaderboard on every load were reported as drawn by nobody.
 *
 * So a file that speaks the `ContractKey` type is read differently: every quoted key-shaped literal
 * in it counts. That is deliberately generous, and generous is the correct direction - the cost of
 * over-reading is a dead key surviving one more release, and the cost of under-reading is a rule
 * whose finding is "delete the row that renders".
 *
 * The table itself is not read this way, or rather is not read at all: it is the one file skipped,
 * so its own key list cannot vouch for anything.
 */
const TYPED_KEY_FILE = /\bContractKey\b/
const QUOTED_KEY = /"([a-z][a-z0-9]*(?:-[a-z0-9]+)+)"/g

/** Reference sets, keyed by table path. One eslint run is one process, so this is one walk per run. */
const referenceCache = new Map()

/**
 * Every contract key named anywhere in the repository outside the table itself.
 *
 * Returns null when the tree cannot be seen - no resolvable root, no directory to walk. A reader
 * that cannot see the tree must stay quiet: the alternative is a rule that answers "nothing renders
 * this" when the truth is "I looked nowhere", and that answer arrives as a list of deletions.
 *
 * The walk happens once per table per process and is cached, because the question is asked once for
 * every key in the table and the answer is one traversal.
 *
 * @param tablePath - the contract table being linted.
 * @returns the set of referenced keys, or null when the tree could not be walked.
 */
export const readContractReferences = (tablePath) => {
  const table = normalizePath(tablePath)
  const hit = referenceCache.get(table)
  if (hit !== undefined) return hit
  const roots = contractSearchRoots(table)
  if (roots.length === 0) {
    referenceCache.set(table, null)
    return null
  }
  const found = new Set()
  const pending = [...roots]
  while (pending.length > 0) {
    const dir = pending.pop()
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) {
        if (!UNWALKED_DIRS.has(entry.name)) pending.push(path)
        continue
      }
      if (!WALKED_FILES.test(entry.name) || path === table) continue
      let source = null
      try {
        source = readFileSync(path, "utf8")
      } catch {
        continue
      }
      for (const pattern of REFERENCE_PATTERNS) {
        for (const match of source.matchAll(pattern)) found.add(match[1])
      }
      if (TYPED_KEY_FILE.test(source)) {
        for (const match of source.matchAll(QUOTED_KEY)) found.add(match[1])
      }
    }
  }
  referenceCache.set(table, found)
  return found
}

// -- shared AST helpers -------------------------------------------------------------------------

/** Class tokens that decide the SHAPE of a tree rather than the look of one value. */
const STRUCTURAL_EXACT = new Set([
  "flex",
  "inline-flex",
  "grid",
  "inline-grid",
  "contents",
  "absolute",
  "relative",
  "fixed",
  "sticky",
])

/** Prefixed families that are equally structural (`gap-4`, `items-center`, `col-span-2`). */
const STRUCTURAL_PREFIX =
  /^(?:flex-|grid-cols-|grid-rows-|col-|row-|gap-|items-|justify-|content-|place-|self-|order-|space-x-|space-y-|divide-|overflow-|inset-|top-|right-|bottom-|left-|z-|basis-|shrink|grow)/

/** Helpers that assemble a class string at runtime. */
const CLASS_COMPOSERS = new Set(["cn", "clsx", "classnames", "classNames", "twMerge", "twJoin", "cva", "tv"])

/** Markers the frame paints from the entry it renders. */
const CONTRACT_ATTRS = new Set(["data-node", "data-why"])

/**
 * Neutral boxes: elements with no meaning of their own, whose only job is to hold other elements.
 *
 * Opening one is always a shape decision, because there is no other reason to open one. These are
 * refused unconditionally outside the frame.
 */
const NEUTRAL_HOSTS = new Set(["div", "section", "main", "header", "footer", "aside", "nav"])

/**
 * Elements chosen for MEANING, which an entry may also name as its host.
 *
 * These are refused only when they carry classes, and the distinction is load-bearing. A `<form>`
 * exists to submit, a `<ul>` exists because its contents are a list - assistive technology reports
 * the element, so it cannot be swapped for a neutral one, and wrapping a contract node in one
 * decides no shape at all. What must still come from an entry is the SHAPE: the moment one of these
 * carries a class, it has stopped being a semantic wrapper and become a node with no key.
 *
 * An earlier version refused these outright, on the reasoning that an entry can name them. That
 * confused "the table CAN express this element" with "every use of this element is a node", and it
 * flagged three honest wrappers that carried a submit handler and not one class.
 */
const SEMANTIC_HOSTS = new Set(["ul", "ol", "li", "form"])

/** Strip responsive/state variants and the important marker: `lg:hover:!flex` becomes `flex`. */
const bareToken = (token) => {
  const withoutVariant = token.includes(":") ? token.slice(token.lastIndexOf(":") + 1) : token
  return withoutVariant.replace(/^!/, "")
}

/** The first structural token in a class string, or null when the string only styles a value. */
const structuralToken = (text) => {
  for (const raw of String(text).trim().split(/\s+/).filter(Boolean)) {
    const token = bareToken(raw)
    if (STRUCTURAL_EXACT.has(token) || STRUCTURAL_PREFIX.test(token)) return token
  }
  return null
}

/** True for a `className` / `class` JSX attribute. */
const isClassAttribute = (node) =>
  node.type === "JSXAttribute" && node.name && (node.name.name === "className" || node.name.name === "class")

/** Static string carried by a JSX attribute (literal, or a template with no holes). */
const staticAttributeText = (node) => {
  const value = node && node.value
  if (!value) return null
  if (value.type === "Literal" && typeof value.value === "string") return value.value
  if (value.type === "JSXExpressionContainer") {
    const expression = value.expression
    if (expression.type === "Literal" && typeof expression.value === "string") return expression.value
    if (expression.type === "TemplateLiteral" && expression.expressions.length === 0) {
      return expression.quasis.map((quasi) => quasi.value.cooked).join(" ")
    }
  }
  return null
}

/** JSX element name, including `Foo.Bar`. */
const jsxElementName = (opening) => {
  const name = opening && opening.name
  if (!name) return null
  if (name.type === "JSXIdentifier") return name.name
  if (name.type === "JSXMemberExpression" && name.object && name.property) {
    return `${name.object.name}.${name.property.name}`
  }
  return null
}

/** Intrinsic (lowercase) tag name, or null for a component. */
const hostName = (opening) => {
  const name = opening && opening.name
  if (!name || name.type !== "JSXIdentifier") return null
  return name.name === name.name.toLowerCase() ? name.name : null
}

/** Static string value of a named attribute on an opening element. */
const attributeText = (opening, attributeName) => {
  const attribute = (opening.attributes || []).find(
    (candidate) => candidate.type === "JSXAttribute" && candidate.name && candidate.name.name === attributeName,
  )
  return attribute ? staticAttributeText(attribute) : null
}

/** Property key as a plain string, for non-computed identifier / string keys. */
const propertyName = (node) => {
  if (!node || node.type !== "Property" || node.computed) return null
  if (node.key.type === "Identifier") return node.key.name
  if (node.key.type === "Literal" && typeof node.key.value === "string") return node.key.value
  return null
}

// -- CONTRACT-1 ------------------------------------------------------------------------------------

/** A structural node takes its classes from a key, never from a literal written at the call site. */
export const noLiteralStructuralClass = {
  meta: {
    type: "problem",
    docs: { description: "Structural classes come from a contract key, never from a literal class string." },
    schema: [],
    messages: {
      structural:
        "`{{cls}}` is a structural class written as a literal, so this node's shape is decided here instead of in the contract table. Add or reuse a key in `{{table}}` and render it with `<Tree contract=\"...\" />`. The key already owns the classes, the element AND the reason - typing it is the only layout decision there is.",
      hoisted:
        "`{{name}}` holds `{{cls}}` - a structural class in a module constant. Hoisting it out of the JSX does not make it a decision this file may take; it only makes it one nothing can see. Move the whole string into a key in `{{table}}`.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isGovernedFile(file) || isContractTableFile(file) || isSurfaceContractHostFile(file)) return {}
    return {
      JSXAttribute(node) {
        if (!isClassAttribute(node)) return
        const text = staticAttributeText(node)
        if (!text) return
        const hit = structuralToken(text)
        if (hit) context.report({ node, messageId: "structural", data: { cls: hit, table: CONTRACT_TABLE_RELATIVE } })
      },
      // A class string lifted into a module constant is the same decision one line further up, and
      // it is INVISIBLE to the arm above - this is not hypothetical, it is how an off-scale `py-1.5`
      // survived every rule in the source this was ported from. The variable is where the shape is
      // decided, so the variable is where the report belongs.
      VariableDeclarator(node) {
        const init = node.init
        if (!init || !node.id || node.id.type !== "Identifier") return
        let text = null
        if (init.type === "Literal" && typeof init.value === "string") text = init.value
        if (init.type === "TemplateLiteral" && init.expressions.length === 0) {
          text = init.quasis.map((quasi) => quasi.value.cooked).join(" ")
        }
        if (text === null) return
        const hit = structuralToken(text)
        if (!hit) return
        context.report({
          node,
          messageId: "hoisted",
          data: { name: node.id.name, cls: hit, table: CONTRACT_TABLE_RELATIVE },
        })
      },
    }
  },
}

// -- CONTRACT-2 ------------------------------------------------------------------------------------

/** A class string is never assembled at runtime - that is a second table with no keys. */
export const noClassCompositionOutsideContract = {
  meta: {
    type: "problem",
    docs: { description: "Class strings are not assembled at runtime; a key already carries the whole string." },
    schema: [],
    messages: {
      composer:
        "`{{name}}(...)` assembles a class string at runtime - a second contract table with no keys, no reasons and nothing anybody can read back. The difference you are branching on is a real distinction: give it a key, or a named prop on the component that owns the node.",
      interpolated:
        "`className` is built by interpolation, so the class string exists only while this component runs and nothing can read it back. Move the whole string into a key in `{{table}}` and pass the key.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isGovernedFile(file) || isContractTableFile(file)) return {}
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee && callee.type === "Identifier" && CLASS_COMPOSERS.has(callee.name)) {
          context.report({ node, messageId: "composer", data: { name: callee.name } })
        }
      },
      JSXAttribute(node) {
        if (!isClassAttribute(node)) return
        const value = node.value
        if (!value || value.type !== "JSXExpressionContainer") return
        const expression = value.expression
        const interpolated =
          (expression.type === "TemplateLiteral" && expression.expressions.length > 0) ||
          (expression.type === "BinaryExpression" && expression.operator === "+")
        if (interpolated) context.report({ node, messageId: "interpolated", data: { table: CONTRACT_TABLE_RELATIVE } })
      },
    }
  },
}

// -- CONTRACT-6 ------------------------------------------------------------------------------------

/** Every entry states why its node exists, in a sentence that is not the key again. */
export const contractWhyIsAReason = {
  meta: {
    type: "problem",
    docs: { description: "Every entry explains why its node exists, and the reason is not the key again." },
    schema: [],
    messages: {
      tooShort:
        "`{{key}}` has a reason too short to be one. One clause naming what breaks, wraps or overflows when this node is removed - not a label.",
      restates:
        "`{{key}}` has a reason built only from the words in the key, so it says the key twice and nothing else. Write the fact that made the node exist: what wraps, what overflows, what stops being pressable.",
    },
  },
  create(context) {
    if (!isContractTableFile(context.filename || context.getFilename())) return {}
    return {
      Property(node) {
        if (propertyName(node) !== "why") return
        if (!node.value || node.value.type !== "Literal" || typeof node.value.value !== "string") return
        const owner = node.parent && node.parent.parent
        const key = owner && owner.type === "Property" ? propertyName(owner) : "this entry"
        const words = node.value.value.trim().split(/\s+/).filter(Boolean)
        if (words.length < 12) {
          context.report({ node, messageId: "tooShort", data: { key } })
          return
        }
        const keyWords = new Set(String(key).split("-"))
        const restates = words.every((word) => keyWords.has(word.toLowerCase().replace(/[^a-z]/g, "")))
        if (restates) context.report({ node, messageId: "restates", data: { key } })
      },
    }
  },
}

// -- CONTRACT-7 ------------------------------------------------------------------------------------

/** Structural hosts come from a key rendered by the frame, not from hand-written markup. */
export const noStructuralHostOutsideContractFrame = {
  meta: {
    type: "problem",
    docs: { description: "Structural host elements are rendered by the frame from a key." },
    schema: [],
    messages: {
      host:
        "`<{{tag}}>` written here is a node with no key: nothing records what classes it should carry, which children belong inside it, or why it exists. Name the shape in `{{table}}` and render it with `<Tree contract=\"...\" />` - and if the ELEMENT is the problem rather than the classes, the entry names its own host, so `<ul>`, `<form>` and `<nav>` are keys too. If no key fits, that is the finding, not a reason to open a div.",
      styledSemantic:
        "`<{{tag}}>` carries classes, so it has stopped being a semantic wrapper and become a node with no key. Opening one for its MEANING is fine - a form submits, a list is a list, and assistive technology reports the element - but the shape it wears belongs to an entry. Move the classes into a key in `{{table}}` and give that entry `host: \"{{tag}}\"`.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isGovernedFile(file) || isSurfaceContractHostFile(file)) return {}
    return {
      JSXOpeningElement(node) {
        const tag = hostName(node)
        if (!tag) return
        if (NEUTRAL_HOSTS.has(tag)) {
          context.report({ node, messageId: "host", data: { tag, table: CONTRACT_TABLE_RELATIVE } })
          return
        }
        if (!SEMANTIC_HOSTS.has(tag)) return
        // A semantic element decides no shape until it carries one.
        const styled = (node.attributes || []).some((attr) => isClassAttribute(attr))
        if (styled) context.report({ node, messageId: "styledSemantic", data: { tag, table: CONTRACT_TABLE_RELATIVE } })
      },
    }
  },
}

// -- CONTRACT-7B -----------------------------------------------------------------------------------

/**
 * A leaf may own one atomic host. It may not arrange structural hosts into a second component tree.
 *
 * This complements CONTRACT-7: leaves are exempt there because their job is to reach one primitive
 * host. The exemption ends the moment that primitive contains another structural host, or one
 * parent owns several structural host siblings.
 */
export const noStructuralArrangementInLeaf = {
  meta: {
    type: "problem",
    docs: { description: "A leaf owns one atomic host, never a structural arrangement." },
    schema: [],
    messages: {
      arrangement:
        "This leaf {{kind}} structural hosts, so it is a composite/contract tree rather than one atomic primitive. Move this ownership to a branch rendered through `<Tree contract=\"...\" />`. `meta.shape`, `data-tier`, aliases, constants, helper callbacks and `defineLeafComponent` do not exempt source JSX structure.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isLeafFile(file) || isTestFile(file) || isContractFrameFile(file)) return {}

    const aliases = new Map()
    const structuralHosts = new Set([...NEUTRAL_HOSTS, ...SEMANTIC_HOSTS])

    const staticHostValue = (node) => {
      if (!node) return null
      if (node.type === "Literal" && typeof node.value === "string") return node.value
      if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
        return node.quasis.map((quasi) => quasi.value.cooked).join("")
      }
      return null
    }

    const structuralHostName = (opening) => {
      const intrinsic = hostName(opening)
      if (intrinsic && structuralHosts.has(intrinsic)) return intrinsic
      const name = jsxElementName(opening)
      const alias = name && aliases.get(name)
      return alias && structuralHosts.has(alias) ? alias : null
    }

    const directStructuralOpening = (child) =>
      child && child.type === "JSXElement" && structuralHostName(child.openingElement)
        ? child.openingElement
        : null

    const hasStructuralAncestor = (opening) => {
      let current = opening.parent
      while (current) {
        if (
          current.type === "JSXElement" &&
          current.openingElement !== opening &&
          structuralHostName(current.openingElement)
        ) {
          return true
        }
        current = current.parent
      }
      return false
    }

    const reportSiblingArrangement = (parent) => {
      const openings = (parent.children || []).map(directStructuralOpening).filter(Boolean)
      if (openings.length < 2) return
      context.report({ node: openings[1], messageId: "arrangement", data: { kind: "owns sibling" } })
    }

    return {
      Program(node) {
        for (const statement of node.body || []) {
          if (statement.type !== "VariableDeclaration") continue
          for (const declaration of statement.declarations || []) {
            if (!declaration.id || declaration.id.type !== "Identifier") continue
            const value = staticHostValue(declaration.init)
            if (value && structuralHosts.has(value)) aliases.set(declaration.id.name, value)
          }
        }
      },
      JSXOpeningElement(node) {
        if (!structuralHostName(node) || !hasStructuralAncestor(node)) return
        context.report({ node, messageId: "arrangement", data: { kind: "nests" } })
      },
      JSXElement(node) {
        // A structural parent is already handled as nested ownership for each structural child.
        // Sibling ownership is needed for an atomic/custom parent that opens several host roots.
        if (structuralHostName(node.openingElement)) return
        reportSiblingArrangement(node)
      },
      JSXFragment: reportSiblingArrangement,
    }
  },
}

// -- CONTRACT-8 ------------------------------------------------------------------------------------

/** Contract markers are painted by the frame, never hand-written on a host element. */
export const noHandWrittenContractAttrs = {
  meta: {
    type: "problem",
    docs: { description: "Contract markers are emitted by the frame, never hand-written." },
    schema: [],
    messages: {
      marker:
        "`{{attr}}` is a marker painted by the frame from the entry it renders. Written by hand it claims a contract nothing enforces, and the node reads as contract-owned to every test that walks these attributes. Render the key instead of describing it.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isSourceFile(file) || isContractFrameFile(file) || isTestFile(file)) return {}
    return {
      JSXAttribute(node) {
        const name = node.name && node.name.type === "JSXIdentifier" ? node.name.name : null
        if (!name || !CONTRACT_ATTRS.has(name)) return
        context.report({ node, messageId: "marker", data: { attr: name } })
      },
    }
  },
}

// -- CONTRACT-9 ------------------------------------------------------------------------------------

/** A key that is not in the table describes nothing, and the message says which keys do exist. */
export const noUnknownContractKey = {
  meta: {
    type: "problem",
    docs: { description: "A contract key must exist in the table." },
    schema: [],
    messages: {
      unknown:
        "`{{key}}` is not a contract key, so it describes no classes, no element and no reason. Existing keys: {{keys}}. A new key is justified by a node shape none of these express - never by wanting a different gap - and its NAME must fix what goes inside it, or it stops constraining anything.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isSourceFile(file)) return {}
    const contracts = readContracts(file)
    if (!contracts) return {}
    const report = (node, key) => {
      if (contracts.keys.includes(key)) return
      context.report({ node, messageId: "unknown", data: { key, keys: contracts.keys.join(", ") } })
    }
    return {
      JSXOpeningElement(node) {
        if (jsxElementName(node) !== "Tree") return
        const key = attributeText(node, "contract")
        if (key) report(node, key)
      },
      CallExpression(node) {
        if (!node.callee || node.callee.type !== "Identifier" || node.callee.name !== "contractSpec") return
        const argument = node.arguments[0]
        if (argument && argument.type === "Literal" && typeof argument.value === "string") {
          report(argument, argument.value)
        }
      },
    }
  },
}

// -- CONTRACT-4 ------------------------------------------------------------------------------------

/** The element an entry names is worn by the frame alone; every other wearer erases it. */
export const onlyTheFrameWearsANode = {
  meta: {
    type: "problem",
    docs: { description: "An entry's node is rendered by the frame, never worn by a component's own element." },
    schema: [],
    messages: {
      worn:
        "`contractNodeProps` hands back an entry's classes and its markers and NOT its element, so calling it outside the frame puts one key's contract on an element THIS file chose. The entry says `ol` and the document gets whatever the props were spread onto: the list leaves the accessibility tree, nothing announces how many items there are - and the key still resolves, the markers still read correct and every gate stays green, which is why this is the failure with no red anywhere. Render the entry's own node through the frame inside your wrapper - `<Tree contract=\"...\" render={...} />` in the vendor body - the way the surface branches now do.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    /*
     * The frame is the only exemption, and a test is not a second one. What a twin test wants to
     * know is what reaches the document, which it reads off the rendered frame; a test that spreads
     * the props itself proves its own fixture and nothing about the product.
     */
    if (!isSourceFile(file) || isContractFrameFile(file)) return {}
    return {
      CallExpression(node) {
        const callee = node.callee
        if (!callee) return
        const named =
          callee.type === "Identifier"
            ? callee.name
            : callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier"
              ? callee.property.name
              : null
        if (named !== "contractNodeProps") return
        context.report({ node, messageId: "worn" })
      },
    }
  },
}

/** Static string carried by a node, or null when it is anything else. */
const literalString = (node) =>
  node && node.type === "Literal" && typeof node.value === "string" ? node.value : null

/** Every string in an array literal, or null when one element is not a static string. */
const literalStringList = (node) => {
  if (!node || node.type !== "ArrayExpression") return null
  const out = []
  for (const element of node.elements) {
    const text = literalString(element)
    if (text === null) return null
    out.push(text)
  }
  return out
}

/** The three ways a slot names what fills it. */
const SLOT_IDENTITY_KEYS = new Set(["contract", "composite", "leaf"])

/**
 * One slot as a comparable string: its declared identity, whether it is optional, whether it repeats.
 *
 * Alternatives are a SET - a slot accepting `["a", "b"]` accepts exactly what `["b", "a"]` accepts.
 * The identity carries which of `contract`, `composite` and `leaf` named it, because those are
 * three different vocabularies and the same word in two of them is not the same child.
 */
const slotShape = (node) => {
  if (!node || node.type !== "ObjectExpression") return null
  let identity = null
  let optional = false
  let repeats = false
  for (const property of node.properties) {
    const name = propertyName(property)
    if (name === null) return null
    if (SLOT_IDENTITY_KEYS.has(name)) {
      if (identity !== null) return null
      const one = literalString(property.value)
      const many = one === null ? literalStringList(property.value) : null
      if (one === null && many === null) return null
      identity = `${name}:${(many ? [...new Set(many)].sort() : [one]).join("|")}`
      continue
    }
    if (name === "optional" || name === "repeats") {
      const flag = property.value
      if (!flag || flag.type !== "Literal" || typeof flag.value !== "boolean") return null
      if (name === "optional") optional = flag.value
      else repeats = flag.value
    }
    // `props` and `restingCount` are read past on purpose: a literal constraint and a placeholder
    // count are not the shape the slot holds.
  }
  if (identity === null) return null
  return `${identity}/optional:${optional}/repeats:${repeats}`
}

/** The slot record as a comparable string, with the names sorted so declaration order says nothing. */
const childrenShape = (node) => {
  if (!node) return ""
  if (node.type !== "ObjectExpression") return null
  const slots = []
  for (const property of node.properties) {
    const name = propertyName(property)
    if (name === null) return null
    const shape = slotShape(property.value)
    if (shape === null) return null
    slots.push(`${name}=${shape}`)
  }
  return slots.sort().join(",")
}

/**
 * The shape one entry spells, as a string two entries can be compared by.
 *
 * WHAT IS IN IT IS THE WHOLE RULE. Classes as a MULTISET, because the order they are typed in is
 * not a decision the node takes; the host, because the element is part of what the key fixes; and
 * the slots by name, declared identity, `optional` and `repeats`, because that is what the entry
 * promises is inside.
 *
 * WHAT IS LEFT OUT IS THE WHOLE POINT. The key's name, its reason, its `restingCount` and the
 * literal `props` on a slot are all absent, so an entry differing only in one of them lands on the
 * same string as its twin. A different resting count IS the same shape: CONTRACT-9 refuses a key
 * for a different gap, and a key for a different placeholder count is that same widening.
 *
 * A `host` that is absent is not folded into `div`. The frame defaults there, but naming the
 * element is a decision the entry took and leaving it unnamed is not the same statement, so a pair
 * disagreeing about it is never called a copy.
 *
 * @param node - the entry's object expression.
 * @returns the shape string, or null when any part of the entry cannot be read statically.
 */
const entryShape = (node) => {
  if (!node || node.type !== "ObjectExpression") return null
  let classes = []
  let host = ""
  let children = ""
  for (const property of node.properties) {
    const name = propertyName(property)
    if (name === null) return null
    // Both spellings, because the table and the type that checks it have carried both.
    if (name === "classes" || name === "classNames") {
      classes = literalStringList(property.value)
      if (classes === null) return null
    } else if (name === "host") {
      host = literalString(property.value)
      if (host === null) return null
    } else if (name === "children") {
      children = childrenShape(property.value)
      if (children === null) return null
    }
  }
  return `classes[${[...classes].sort().join(" ")}] host[${host}] children{${children}}`
}

/** An entry whose shape another entry already spells is that entry under a second name. */
export const noDuplicateEntryShape = {
  meta: {
    type: "problem",
    docs: { description: "Two entries may not spell one shape under two names." },
    schema: [],
    messages: {
      duplicate:
        "`{{key}}` spells the shape `{{other}}` already spells: the same classes in any order, the same host, and the same slots holding the same things. A different reason, a different `restingCount` or a different name is not a different shape. Reuse `{{other}}`, or state in `why` the relationship this entry expresses that `{{other}}` cannot - and if neither is true, `{{key}}` and `{{other}}` are one entry under a name that fits both.",
    },
  },
  create(context) {
    if (!isContractTableFile(context.filename || context.getFilename())) return {}
    return {
      /*
       * The entries are read off the `buildContracts` call rather than off every object in the
       * file, for the reason the textual reader records: a second table in the same file would
       * otherwise be compared against the first, and two vocabularies would report each other.
       *
       * An entry that cannot be read statically is skipped rather than reported. A table nobody can
       * read is a reason to stay quiet, never a reason to call an entry a copy.
       */
      CallExpression(node) {
        if (!node.callee || node.callee.type !== "Identifier" || node.callee.name !== "buildContracts") return
        const table = node.arguments[0]
        if (!table || table.type !== "ObjectExpression") return
        const firstByShape = new Map()
        for (const property of table.properties) {
          const key = propertyName(property)
          if (key === null) continue
          const shape = entryShape(property.value)
          if (shape === null) continue
          const other = firstByShape.get(shape)
          // The pair is reported once, on the later entry, because the earlier one is the key the
          // author is being sent back to.
          if (other === undefined) firstByShape.set(shape, key)
          else context.report({ node: property, messageId: "duplicate", data: { key, other } })
        }
      },
    }
  },
}

/**
 * The class families an entry may not hold, and what each of them is really claiming.
 *
 * A cursor and a hover state claim the node reacts to a pointer. A focus state claims it takes the
 * keyboard. `group` claims something inside it answers this node's hover. A text colour and an
 * alignment are the paint of one value rather than the relationship between several. None of them
 * is an arrangement, and the table cannot be told when the claim stops being true: an entry cannot
 * know that this call site passed no handler, so it goes on drawing a pointer over a dead node.
 */
const INTERACTION_CLASS = /^(?:cursor-|group$|group\/|hover:|active:|focus:|focus-visible:|disabled:|aria-[a-z-]+:|data-\[)/

/**
 * ALIGNMENT IS NOT PAINT, and the line is drawn here rather than by taste.
 *
 * `text-center` says how the content of every child sits inside this node, which is the same kind
 * of statement as `items-center` and is inherited by children that never asked - so it belongs to
 * the node that arranges them. A text COLOUR says what one value looks like, and the leaf that
 * draws that value already owns it; an entry that names one is a second author for something it
 * cannot see. So `text-left` and `text-center` stay legal here, and `text-foreground` does not.
 */
const PAINT_CLASS = /^(?:text-(?:foreground|muted|accent|success|warning|danger)$|decoration-|underline$)/

/**
 * A GROUND AND AN ELEVATION MAKE A RAISED OBJECT, and a raised object is a component.
 *
 * `bg-surface` lifts the node off the page and `shadow-*` says how far - and either alone already
 * says it, which is why either alone is refused. Neither is a statement about how children stand
 * together; both are statements about what the node IS. What it becomes is a card, and a card
 * already has an owner: a named surface branch draws it, owns its inset, its edge and the vendor
 * wrapper underneath. An entry that draws it too puts a second card inside the first, and nothing
 * can see the doubling because the entry and the branch never read each other.
 *
 * THE NEIGHBOURS ARE DELIBERATELY LEFT OUT, each for its own reason.
 *
 *   - `bg-background` is the app frame's ground - the page a navbar or a mobile action bar sits on,
 *     drawn by chrome no card branch owns. It raises nothing, so refusing it would take away the
 *     only ground those nodes have.
 *   - `rounded-*` and `border*` stay legal because an edge also CLIPS and DIVIDES: entries use it to
 *     round the ends of a joined list and to rule one band off from the next. A machine cannot tell
 *     those apart from the corner of a card, so the separation is left to the migration.
 *   - `divide-y`, `divide-separator` and `overflow-hidden` describe relationships BETWEEN children,
 *     which is the one thing an entry is for.
 */
const RAISED_OBJECT_CLASS = /^(?:bg-surface(?:-|$)|shadow(?:-|$))/

/**
 * A ground alone is not a raised object, and this is the one shape that tells them apart.
 *
 * `shadow-*` is elevation and needs no companion: nothing casts a shadow without standing above
 * something. A ground does not settle it - a landing page whose sections alternate their ground so a
 * reader can count them carries the same token and is not a card.
 *
 * The difference is not the corner. Plenty of cards have no radius, and a band can be rounded. The
 * difference is that a BAND RUNS EDGE TO EDGE AND RULES ITSELF OFF: it takes the full measure and
 * separates itself from the next band with one border, because it has no boundary of its own to do
 * it with. An object stops before the edge and is bounded by being an object.
 *
 * So a ground is refused unless the entry is written as a band, and a machine can read that: the
 * full measure, plus a rule along one edge.
 */
const BAND_WIDTH_CLASS = /^w-full$/
const BAND_RULE_CLASS = /^border-[bt]$/

/** Whether this entry is written as a full-bleed band, which is the one ground an entry may own. */
const isBand = (classes) =>
  classes.some((value) => BAND_WIDTH_CLASS.test(value)) && classes.some((value) => BAND_RULE_CLASS.test(value))

/** An entry describes how children stand together; how the node reacts, paints or rises is a branch's. */
export const noInteractionClassInEntry = {
  meta: {
    type: "problem",
    docs: { description: "Entry classes are the arrangement, never the behaviour, the paint or the object." },
    schema: [],
    messages: {
      interaction:
        "`{{key}}` carries `{{value}}`, which is how the node REACTS rather than how its children stand together. The thing that presses owns the handler, the disabled state and therefore the cursor - so the entry cannot know when that promise is off, and goes on drawing it over a dead node. Draw the control in a named branch and put this key's node inside it.",
      paint:
        "`{{key}}` carries `{{value}}`, which is the paint of one value rather than a relationship between children. A leaf owns how its own words are set, and a branch owns the surface it draws; an entry that paints is a second author for something it cannot see.",
      raised:
        "`{{key}}` carries `{{value}}`, which gives the node a ground or an elevation of its own. A ground and an elevation make the node a raised OBJECT rather than an arrangement of children, and a raised object is a component with an owner - so the entry is claiming a thing the surface branch around it already draws, drawn twice and read back nowhere. Put this key's node inside that branch. The app frame's own ground is a different thing and stays legal: `bg-background` is the page chrome sits on, not a raised object. So does an edge - `rounded-*` and `border*` also clip and divide - and so do `divide-y` and `overflow-hidden`, which describe the children.",
    },
  },
  create(context) {
    if (!isContractTableFile(context.filename || context.getFilename())) return {}
    return {
      CallExpression(node) {
        if (!node.callee || node.callee.type !== "Identifier" || node.callee.name !== "buildContracts") return
        const table = node.arguments[0]
        if (!table || table.type !== "ObjectExpression") return
        for (const property of table.properties) {
          const key = propertyName(property)
          if (key === null || !property.value || property.value.type !== "ObjectExpression") continue
          for (const field of property.value.properties) {
            const name = propertyName(field)
            if (name !== "classes" && name !== "classNames") continue
            if (!field.value || field.value.type !== "ArrayExpression") continue
            const written = field.value.elements
              .map((element) => literalString(element))
              .filter((value) => value !== null && value !== "")
            const band = isBand(written)
            for (const element of field.value.elements) {
              const value = literalString(element)
              if (value === null || value === "") continue
              // A ground with nothing bounding it is a band, and a band is the only ground an entry
              // may still own. An elevation is refused wherever it appears.
              const raises = RAISED_OBJECT_CLASS.test(value)
                && (!band || /^shadow(?:-|$)/.test(value))
              const messageId = INTERACTION_CLASS.test(value)
                ? "interaction"
                : PAINT_CLASS.test(value)
                  ? "paint"
                  : raises ? "raised" : null
              if (messageId !== null) context.report({ node: element, messageId, data: { key, value } })
            }
          }
        }
      },
    }
  },
}

// -- CONTRACT-13 -----------------------------------------------------------------------------------

/** Every contract key one entry declares as a child of its own, including alternatives. */
const childContractKeys = (entry) => {
  const out = []
  if (!entry || entry.type !== "ObjectExpression") return out
  for (const property of entry.properties) {
    if (propertyName(property) !== "children") continue
    const slots = property.value
    if (!slots || slots.type !== "ObjectExpression") continue
    for (const slot of slots.properties) {
      const shape = slot.value
      if (!shape || shape.type !== "ObjectExpression") continue
      for (const field of shape.properties) {
        if (propertyName(field) !== "contract") continue
        const one = literalString(field.value)
        // A slot accepting `["a", "b"]` renders whichever it is handed, so both are drawn.
        const many = one === null ? literalStringList(field.value) : null
        if (one !== null) out.push(one)
        else if (many !== null) out.push(...many)
      }
    }
  }
  return out
}

/** A key nobody renders is a promise about a node that does not exist. */
export const noDeadContractKey = {
  meta: {
    type: "problem",
    docs: { description: "Every key in the table is rendered somewhere, or it is not vocabulary." },
    schema: [],
    messages: {
      dead:
        "`{{key}}` is in the table and nothing draws it: no `contract=\"{{key}}\"`, no `defineContractComponent(\"{{key}}\")`, no `defineContractProjection(\"{{key}}\")`, no `CONTRACTS[\"{{key}}\"]`, and no slot of another entry - searched under {{roots}}. An entry is a promise about a node standing in the document, so a key with no user is a promise about nothing: it survives every rename because renaming follows call sites and it has none, it travels whole into the next repository, and it makes the table longer than the code that reads it until telling a described screen from an intended one means searching the source. Delete it. A shape wanted for work that has not started belongs in the plan record, where an unbuilt node is exactly what a reader expects to find.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isContractTableFile(file)) return {}
    /*
     * A table inside a plan record is a record. A design candidate carries a COPY of the vocabulary
     * and renders the one page it was built to answer, so most of that copy is drawn by nobody -
     * which is not a finding, it is what a plan record is: the place this rule sends an unbuilt
     * shape to. Measured on `starci-academy-fe`, two candidates would have opened a hundred and
     * thirty deletions against a tree nothing ships.
     */
    if (file.includes("/.artifacts/")) return {}
    /*
     * No tree, no finding. `readContractReferences` returns null when the repository root cannot be
     * resolved from this path or nothing can be walked, and the only honest report from a reader
     * that looked nowhere is silence - the alternative is every key in the vocabulary reported dead
     * at once, which reads as a table to empty rather than as a rule that is blind.
     */
    const referenced = readContractReferences(file)
    if (referenced === null) return {}
    const roots = contractSearchRoots(file).join(", ")
    return {
      CallExpression(node) {
        if (!node.callee || node.callee.type !== "Identifier" || node.callee.name !== "buildContracts") return
        const table = node.arguments[0]
        if (!table || table.type !== "ObjectExpression") return
        // A child slot is a call site the walk cannot see, because the only file naming that key is
        // the one file the walk skips. Collected first, so declaration order says nothing.
        const asChild = new Set()
        for (const property of table.properties) {
          for (const key of childContractKeys(property.value)) asChild.add(key)
        }
        for (const property of table.properties) {
          const key = propertyName(property)
          if (key === null || referenced.has(key) || asChild.has(key)) continue
          context.report({ node: property, messageId: "dead", data: { key, roots } })
        }
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-literal-structural-class": noLiteralStructuralClass,
  "no-interaction-class-in-entry": noInteractionClassInEntry,
  "no-class-composition-outside-contract": noClassCompositionOutsideContract,
  "contract-why-is-a-reason": contractWhyIsAReason,
  "no-structural-host-outside-contract-frame": noStructuralHostOutsideContractFrame,
  "no-structural-arrangement-in-leaf": noStructuralArrangementInLeaf,
  "no-hand-written-contract-attrs": noHandWrittenContractAttrs,
  "no-unknown-contract-key": noUnknownContractKey,
  "no-duplicate-entry-shape": noDuplicateEntryShape,
  "only-the-frame-wears-a-node": onlyTheFrameWearsANode,
  "no-dead-contract-key": noDeadContractKey,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * A consuming repository's `eslint.config.mjs` stays the authority on what is actually switched on:
 * a repository carrying debt turns a rule down to `warn` while it burns the count down, and back to
 * `error` at zero. What never changes is that a rule at `error` is a broken build rather than a
 * warning to triage.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
