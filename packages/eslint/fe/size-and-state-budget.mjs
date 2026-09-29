/**
 * The rules that hold `size-and-state-budget.md` (HFS R65, `FE_SIZE_AND_STATE_BUDGET`).
 *
 * A BUDGET IS A SMELL DETECTOR, NOT A STYLE. A component past 300 lines, or one that holds more than
 * six pieces of state or reads six data hooks, is doing the work of several units: one repository's
 * status-flow component held 20 `useState`s and three data sources in one 900-line file, and no
 * reviewer could say what it did. The numbers are the same for every app so that "too big" is a
 * measurement, not an opinion.
 *
 * WHAT THE LINT HOLDS, AND WHAT IT LEAVES. Absolute limits per file and per component are file-local
 * facts and are held here. "Size may not GROW against the parent commit" (`HFS_SIZE_GROWTH`) is a
 * repository fact needing the previous revision, so it belongs to the architecture machine; the two
 * are complementary, not duplicates - this catches the new giant, that catches the old one growing.
 *
 * POLLING. A hand-rolled `setInterval` or self-scheduling `setTimeout` is a second refresh mechanism
 * beside the data hook's own, and two mechanisms per resource means double requests and a spinner
 * that never settles. Each resource refreshes by exactly one mechanism (a SWR `refreshInterval`, or a
 * socket), so the loop in a component is always the wrong one.
 */

import { isSpecFile } from "./lib/scope.mjs"
import { normalizePath } from "./lib/path.mjs"

/** The largest a component file may be. */
export const MAX_COMPONENT_LINES = 300

/** The most `useState` calls one connected unit may hold. */
export const MAX_STATE_HOOKS = 6

/** The most data hooks one connected unit may read. */
export const MAX_DATA_HOOKS = 6

/** A hook that reads remote data. */
const DATA_HOOK = /^use\w*(?:Swr|SWR|Query|Mutation|Fetch|Infinite|Subscription)\w*$/

/** A state hook. */
const STATE_HOOK = /^(?:useState|useReducer)$/

/** The name a call is made through: `useState` or `React.useState`. */
const calleeName = (callee) => {
  if (callee.type === "Identifier") return callee.name
  if (callee.type === "MemberExpression" && !callee.computed && callee.object.type === "Identifier" && callee.object.name === "React") {
    return callee.property.name
  }
  return null
}

/** The name a function is bound to, when it has one. */
const functionName = (node) => {
  if (node.id) return node.id.name
  const parent = node.parent
  if (parent && parent.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name
  return null
}

/** A component or hook, by the naming convention React itself relies on. */
const isUnitName = (name) => Boolean(name) && (/^[A-Z]/.test(name) || /^use[A-Z0-9]/.test(name))

// -- BUDGET-1 --------------------------------------------------------------------------------------

/** A component file is at most 300 lines. */
export const componentLineBudget = {
  meta: {
    type: "suggestion",
    docs: { description: `A component file has at most ${MAX_COMPONENT_LINES} lines.` },
    schema: [],
    messages: {
      lines:
        "This component file has {{count}} lines; the budget is {{max}}. A file this size is several units in one: split the drawing from the data, and the sections from each other, so each part can be named, tested and reviewed on its own.",
    },
  },
  create(context) {
    const filename = normalizePath(context.filename || context.getFilename())
    if (!filename.endsWith(".tsx") || isSpecFile(filename) || !filename.includes("/src/")) return {}
    const source = context.sourceCode || context.getSourceCode()
    return {
      Program(node) {
        // A trailing newline is not a line of code.
        const count = source.lines.length - (source.lines[source.lines.length - 1] === "" ? 1 : 0)
        if (count > MAX_COMPONENT_LINES) context.report({ node, messageId: "lines", data: { count, max: MAX_COMPONENT_LINES } })
      },
    }
  },
}

// -- BUDGET-2 --------------------------------------------------------------------------------------

/** A connected unit holds at most six state hooks and reads at most six data hooks. */
export const unitHookBudget = {
  meta: {
    type: "suggestion",
    docs: { description: `A unit has at most ${MAX_STATE_HOOKS} state hooks and ${MAX_DATA_HOOKS} data hooks.` },
    schema: [],
    messages: {
      state:
        "`{{name}}` holds {{count}} state hooks; the budget is {{max}}. That much local state is several concerns tangled together: group what changes together into a reducer or a hook of its own, and derive the rest instead of storing it.",
      data:
        "`{{name}}` reads {{count}} data hooks; the budget is {{max}}. A unit that gathers this many resources is a page pretending to be a block: give each slot its own connected block.",
    },
  },
  create(context) {
    if (isSpecFile(context.filename || context.getFilename())) return {}
    /** One frame per function being walked; only a component or hook frame accumulates. */
    const frames = []
    const enter = (node) => frames.push({ node, name: functionName(node), state: 0, data: 0 })
    const exit = () => {
      const frame = frames.pop()
      if (!frame || !isUnitName(frame.name)) return
      const at = frame.node.id || frame.node
      if (frame.state > MAX_STATE_HOOKS) {
        context.report({ node: at, messageId: "state", data: { name: frame.name, count: frame.state, max: MAX_STATE_HOOKS } })
      }
      if (frame.data > MAX_DATA_HOOKS) {
        context.report({ node: at, messageId: "data", data: { name: frame.name, count: frame.data, max: MAX_DATA_HOOKS } })
      }
    }
    return {
      FunctionDeclaration: enter,
      FunctionExpression: enter,
      ArrowFunctionExpression: enter,
      "FunctionDeclaration:exit": exit,
      "FunctionExpression:exit": exit,
      "ArrowFunctionExpression:exit": exit,
      CallExpression(node) {
        const name = calleeName(node.callee)
        if (!name) return
        // Attribute the call to the nearest enclosing component or hook.
        const owner = [...frames].reverse().find((frame) => isUnitName(frame.name))
        if (!owner) return
        if (STATE_HOOK.test(name)) owner.state += 1
        else if (DATA_HOOK.test(name)) owner.data += 1
      },
    }
  },
}

// -- BUDGET-3 --------------------------------------------------------------------------------------

/** `setInterval`, or `window.setInterval`. */
const isIntervalCall = (node) => {
  const callee = node.callee
  if (callee.type === "Identifier") return callee.name === "setInterval"
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.name === "setInterval" &&
    callee.object.type === "Identifier" &&
    ["window", "globalThis", "self"].includes(callee.object.name)
  )
}

/** No hand-written polling loop in a component or hook. */
export const noHandRolledPolling = {
  meta: {
    type: "problem",
    docs: { description: "No `setInterval` and no self-scheduling `setTimeout`: one refresh mechanism per resource." },
    schema: [],
    messages: {
      interval:
        "A `setInterval` loop. This is a second refresh mechanism beside the data hook's own; two mechanisms per resource means double requests and a spinner that never settles. Refresh through the data hook (`refreshInterval`) or a socket, not a timer in the component.",
      timeout:
        "A `setTimeout` that schedules its own next run is a polling loop written by hand. Refresh through the data hook (`refreshInterval`) or a socket.",
    },
  },
  create(context) {
    if (isSpecFile(context.filename || context.getFilename())) return {}
    const source = context.sourceCode || context.getSourceCode()
    return {
      CallExpression(node) {
        if (isIntervalCall(node)) return context.report({ node, messageId: "interval" })
        const callee = node.callee
        if (callee.type !== "Identifier" || callee.name !== "setTimeout") return
        const callback = node.arguments[0]
        if (!callback || (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression")) return
        // The enclosing named function: does the timer's own callback call it again?
        const owner = source.getAncestors(node).reverse().find((ancestor) =>
          ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(ancestor.type) && functionName(ancestor),
        )
        const name = owner ? functionName(owner) : null
        if (!name) return
        const calls = new RegExp(`\\b${name}\\s*\\(`).test(source.getText(callback))
        if (calls) context.report({ node, messageId: "timeout" })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "component-line-budget": componentLineBudget,
  "unit-hook-budget": unitHookBudget,
  "no-hand-rolled-polling": noHandRolledPolling,
}

/** Every rule is an error: the budget is the same for every app, and there is no baseline. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
