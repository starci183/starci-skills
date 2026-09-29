/**
 * The rules that hold `lists.md` (HFS R65 `FE_SIZE_AND_STATE_BUDGET`, sub-check `FE_LIST_KEY`).
 *
 * A LIST IS ITEMS WITH IDENTITY. React reconciles a rendered list by `key`: the key is how it knows
 * that the third row is still the third row after the first was deleted. With no key React falls
 * back to position, with an index key it says position is identity, and either way a deleted row
 * hands its state (an open menu, a half-typed input, a focus ring) to its neighbour. Nothing fails a
 * type check and the bug appears only on the second interaction, on a real list.
 *
 * WHAT COUNTS AS A LIST. A `.map` callback that returns JSX. A static array written in place
 * (`[0, 1, 2].map(...)`) or a callback that ignores its item (`(_, index) => ...`, a skeleton) has no identity to lose, so an index key there is fine.
 *
 * THE MEMO TAX. A component prop written as `{{ ... }}` or `[...]` inside a `.map` callback is a new
 * object per row per render, so `memo` on the row never hits and the whole list re-renders on every
 * keystroke of its parent. Hoist the constant, or build it once above the map.
 */

import { attribute, attributeValue, calleeName, isFunction, mentions } from "./lib/ast.mjs"
import { isSpecFile } from "./lib/scope.mjs"

/** `.map(callback)` where the callback is written inline; the call node, else null. */
const mapCallback = (call) => {
  if (call.type !== "CallExpression" || call.callee.type !== "MemberExpression" || call.callee.computed) return null
  if (call.callee.property.type !== "Identifier" || call.callee.property.name !== "map") return null
  const receiver = calleeName(call.callee.object)
  if (receiver !== null && /(?:^|\.)Children$/.test(receiver)) return null
  const callback = call.arguments[0]
  return callback && isFunction(callback) ? callback : null
}

/** The JSX a callback returns: its expression body, or the value of each of its own `return` statements. */
const returnedJsx = (callback) => {
  const found = []
  const take = (node) => {
    if (!node) return
    if (node.type === "JSXElement" || node.type === "JSXFragment") found.push(node)
    else if (node.type === "ConditionalExpression") {
      take(node.consequent)
      take(node.alternate)
    } else if (node.type === "LogicalExpression") take(node.right)
  }
  if (callback.body.type !== "BlockStatement") {
    take(callback.body)
    return found
  }
  const scan = (node) => {
    if (!node || typeof node.type !== "string") return
    if (node.type === "ReturnStatement") return take(node.argument)
    if (node.type === "BlockStatement") node.body.forEach(scan)
    else if (node.type === "IfStatement") {
      scan(node.consequent)
      scan(node.alternate)
    } else if (node.type === "SwitchStatement") node.cases.forEach((entry) => entry.consequent.forEach(scan))
    else if (node.type === "TryStatement") {
      scan(node.block)
      scan(node.handler?.body)
    }
  }
  scan(callback.body)
  return found
}

/**
 * True when the rows have no identity to lose: the receiver is an array written in place, or the callback
 * ignores the item (`(_, index) => ...`), which is how a skeleton or a placeholder count is rendered.
 */
const isPositional = (call, callback) => {
  if (call.callee.object.type === "ArrayExpression") return true
  const item = callback.params[0]
  return Boolean(item) && item.type === "Identifier" && item.name.startsWith("_")
}

// -- LISTS-1 ---------------------------------------------------------------------------------------

/** Every element a `.map` callback returns carries a `key`. */
export const listItemHasKey = {
  meta: {
    type: "problem",
    docs: { description: "An element returned from `.map` carries a `key`." },
    schema: [],
    messages: {
      missing:
        "This element is returned from `.map` with no `key`. React then identifies rows by position, so deleting or reordering one hands its state (an open menu, typed text, focus) to its neighbour. Give it a stable key from the data: `key={row.id}`.",
      fragment:
        "A `<>...</>` returned from `.map` cannot carry a key. Use `<Fragment key={...}>` (import `Fragment` from `react`) so each row has an identity.",
    },
  },
  create(context) {
    if (isSpecFile(context.filename || context.getFilename())) return {}
    return {
      CallExpression(call) {
        const callback = mapCallback(call)
        if (!callback) return
        for (const element of returnedJsx(callback)) {
          if (element.type === "JSXFragment") context.report({ node: element, messageId: "fragment" })
          else if (!attribute(element.openingElement, "key")) context.report({ node: element.openingElement, messageId: "missing" })
        }
      },
    }
  },
}

// -- LISTS-2 ---------------------------------------------------------------------------------------

/** The key is never the position, and never made up on every render. */
export const noIndexKey = {
  meta: {
    type: "problem",
    docs: { description: "A list key is stable data identity, never the map index or a random value." },
    schema: [],
    messages: {
      index:
        "`key` is built from the `.map` index. The index is the row's position, not its identity: after a delete or a reorder the wrong row keeps the state. Use an id the data carries (`key={row.id}`).",
      random:
        "`key` is generated during render (`Math.random`, `Date.now`, `crypto.randomUUID`). A new key on every render remounts every row, throwing away its state and its DOM. Use an id the data carries.",
    },
  },
  create(context) {
    if (isSpecFile(context.filename || context.getFilename())) return {}
    const source = context.sourceCode ?? context.getSourceCode()
    return {
      CallExpression(call) {
        const callback = mapCallback(call)
        if (!callback) return
        const indexParam = callback.params[1]
        const indexName = indexParam && indexParam.type === "Identifier" ? indexParam.name : null
        for (const element of returnedJsx(callback)) {
          if (element.type !== "JSXElement") continue
          const key = attribute(element.openingElement, "key")
          const value = attributeValue(key)
          if (!value) continue
          const text = source.getText(value)
          if (/\b(?:Math\.random|Date\.now|randomUUID|nanoid|uuid)\b/.test(text)) {
            context.report({ node: key, messageId: "random" })
          } else if (indexName && !isPositional(call, callback) && mentions(source, value, indexName)) {
            context.report({ node: key, messageId: "index" })
          }
        }
      },
    }
  },
}

// -- LISTS-3 ---------------------------------------------------------------------------------------

/** True for `<Component>` and `<a.B>`, false for a DOM tag: only a component can be memoised. */
const isComponentTag = (opening) => {
  if (opening.name.type === "JSXMemberExpression") return true
  return opening.name.type === "JSXIdentifier" && /^[A-Z]/.test(opening.name.name)
}

/** True when the nearest function around `node` is a `.map` callback. */
const insideMapCallback = (node) => {
  for (let current = node.parent; current; current = current.parent) {
    if (!isFunction(current)) continue
    return current.parent?.type === "CallExpression" && current.parent.arguments[0] === current && mapCallback(current.parent) === current
  }
  return false
}

/** A component in a mapped list gets no object or array literal for a prop. */
export const noInlineLiteralPropInList = {
  meta: {
    type: "problem",
    docs: { description: "No object or array literal as a prop of a component rendered inside `.map`." },
    schema: [],
    messages: {
      literal:
        "`{{prop}}` is an object or array literal written inside `.map`: a new value per row per render, so a memoised row never hits and the whole list re-renders on every parent update. Hoist it to a constant above the component, or build it once before the map.",
    },
  },
  create(context) {
    if (isSpecFile(context.filename || context.getFilename())) return {}
    return {
      JSXAttribute(node) {
        const opening = node.parent
        if (!opening || opening.type !== "JSXOpeningElement" || !isComponentTag(opening)) return
        if (node.name.type !== "JSXIdentifier" || node.name.name === "key") return
        const value = attributeValue(node)
        if (!value || (value.type !== "ObjectExpression" && value.type !== "ArrayExpression")) return
        if (value.type === "ArrayExpression" && value.elements.length === 0) return
        if (!insideMapCallback(node)) return
        context.report({ node, messageId: "literal", data: { prop: node.name.name } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "list-item-has-key": listItemHasKey,
  "no-index-key": noIndexKey,
  "no-inline-literal-prop-in-list": noInlineLiteralPropInList,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
