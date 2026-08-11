/**
 * The rules that hold `contract.md`.
 *
 * One idea, stated six ways: a structural node is described ONCE, by a key that owns the node's
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
import { existsSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"

// -- where things are ---------------------------------------------------------------------------

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

/** True when this file holds the entry table - the one place a class string or a reason is written. */
export const isContractTableFile = (filename) => normalizePath(filename).endsWith(`/${CONTRACT_TABLE_RELATIVE}`)

/** True when this file is the frame that renders an entry, and therefore paints its markers. */
export const isContractFrameFile = (filename) => normalizePath(filename).includes(`/${CONTRACT_FRAME_RELATIVE}/`)

/** Named surface branches own fixed vendor-wrapper mechanics around one checked content node. */
export const isSurfaceContractHostFile = (filename) =>
  /\/src\/components\/branches\/(?:SurfaceCard|SurfaceAccordionCard|SurfaceListCard)\//.test(normalizePath(filename))

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
export const isLeafFile = (filename) => normalizePath(filename).includes(`/${LEAF_DIR_RELATIVE}/`)

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
  let dir = dirname(normalizePath(filename))
  for (let depth = 0; depth < 40; depth += 1) {
    const candidate = normalizePath(join(dir, CONTRACT_TABLE_RELATIVE))
    if (existsSync(candidate)) return candidate
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

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-literal-structural-class": noLiteralStructuralClass,
  "no-class-composition-outside-contract": noClassCompositionOutsideContract,
  "contract-why-is-a-reason": contractWhyIsAReason,
  "no-structural-host-outside-contract-frame": noStructuralHostOutsideContractFrame,
  "no-hand-written-contract-attrs": noHandWrittenContractAttrs,
  "no-unknown-contract-key": noUnknownContractKey,
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
