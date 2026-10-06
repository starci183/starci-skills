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

import { functionOf, isFn } from "./lib/bindings.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { isPromiseValued } from "./lib/types.mjs"
import { roleOfFile, slotOfFile } from "./lib/scope.mjs"

/**
 * The budget the slot of the linted file states (`budget` in knowledge/hfs/slots.yaml), or an empty one when no slot owns the file
 * or the slot states none. The numbers live in the manifest only: a rule that kept its own copy would drift from it.
 */
const budgetOf = (context) => {
  const id = slotOfFile(context)
  return id === null ? {} : hfsOf(context).slot(id)?.budget ?? {}
}

/**
 * The line limit of the linted file: the budget keyed by the file name its role has in the slot (`component.tsx` for the drawing,
 * `index.tsx` for the entry), else the slot's `file` budget (hooks 200, modules 400), else null.
 */
const lineBudgetOf = (context) => {
  const role = roleOfFile(context)
  const id = slotOfFile(context)
  const fileName = role === null || id === null ? undefined : hfsOf(context).slot(id)?.roles?.[role]
  const budget = budgetOf(context)
  const limit = fileName !== undefined && typeof budget[fileName] === "number" ? budget[fileName] : budget.file
  return typeof limit === "number" ? limit : null
}

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
  if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name
  return null
}

/** A component or hook, by the naming convention React itself relies on. */
const isUnitName = (name) => Boolean(name) && (/^[A-Z]/.test(name) || /^use[A-Z0-9]/.test(name))

// -- BUDGET-1 --------------------------------------------------------------------------------------

/** A file is within the line budget its slot states for its role (`component.tsx`, `index.tsx`) or for every file (`file`). */
export const componentLineBudget = {
  meta: {
    type: "suggestion",
    docs: { description: "A file stays within the line budget its slot states (`component.tsx`, `index.tsx`, `file`)." },
    schema: [],
    messages: {
      lines:
        "This file has {{count}} lines; the budget is {{max}}. A file this size is several units in one: split the drawing from the data, and the sections from each other, so each part can be named, tested and reviewed on its own.",
    },
  },
  create(context) {
    // A spec is not held to a budget; a file has one when its role or its slot states it.
    const max = lineBudgetOf(context)
    if (max === null) return {}
    const source = context.sourceCode || context.getSourceCode()
    return {
      Program(node) {
        // A trailing newline is not a line of code.
        const count = source.lines.length - (source.lines[source.lines.length - 1] === "" ? 1 : 0)
        if (count > max) context.report({ node, messageId: "lines", data: { count, max } })
      },
    }
  },
}

// -- BUDGET-2 --------------------------------------------------------------------------------------

/** A connected unit holds at most the slot's `useState` budget of state hooks and reads at most its `dataHooks` budget of data hooks. */
export const unitHookBudget = {
  meta: {
    type: "suggestion",
    docs: { description: "A unit stays within the state-hook and data-hook budget its slot states (`useState`, `dataHooks`)." },
    schema: [],
    messages: {
      state:
        "`{{name}}` holds {{count}} state hooks; the budget is {{max}}. That much local state is several concerns tangled together: group what changes together into a reducer or a hook of its own, and derive the rest instead of storing it.",
      data:
        "`{{name}}` reads {{count}} data hooks; the budget is {{max}}. A unit that gathers this many resources is a page pretending to be a block: give each slot its own connected block.",
    },
  },
  create(context) {
    // A slot that states no `useState` / `dataHooks` budget puts no bound on that count: the rule refuses to invent one.
    const { useState: maxState, dataHooks: maxData } = budgetOf(context)
    if (typeof maxState !== "number" && typeof maxData !== "number") return {}
    /** One frame per function being walked; only a component or hook frame accumulates. */
    const frames = []
    const enter = (node) => frames.push({ node, name: functionName(node), state: 0, data: 0 })
    const exit = () => {
      const frame = frames.pop()
      if (!frame || !isUnitName(frame.name)) return
      const at = frame.node.id || frame.node
      if (typeof maxState === "number" && frame.state > maxState) {
        context.report({ node: at, messageId: "state", data: { name: frame.name, count: frame.state, max: maxState } })
      }
      if (typeof maxData === "number" && frame.data > maxData) {
        context.report({ node: at, messageId: "data", data: { name: frame.name, count: frame.data, max: maxData } })
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

/** The function node a timer runs: the inline callback, or the same-file function a name stands for. */
const timerCallback = (context, node) => functionOf(context, node.arguments[0])

/**
 * True when running `fn` reads data: a call in its body (outside nested functions) whose value is a promise - `fetch`, the
 * transport client, a reader, SWR's `mutate()`/revalidation, anything awaited - or an `await`. A tick that only reads the time or
 * sets state (a shared clock, a countdown, an animation step) is not a refresh mechanism.
 */
const readsData = (context, fn, seen = new Set()) => {
  if (!fn || seen.has(fn)) return false
  seen.add(fn)
  let found = false
  const visit = (current) => {
    if (found || !current || typeof current.type !== "string") return
    if (current !== fn && isFn(current)) return
    if (current.type === "AwaitExpression") { found = true; return }
    if (current.type === "CallExpression") {
      if (isPromiseValued(context, current)) { found = true; return }
      const local = functionOf(context, current.callee)
      if (local && readsData(context, local, seen)) { found = true; return }
    }
    for (const [key, child] of Object.entries(current)) {
      if (key === "parent") continue
      if (Array.isArray(child)) child.forEach(visit)
      else if (child && typeof child.type === "string") visit(child)
    }
  }
  visit(fn.body)
  return found
}

/**
 * No hand-written polling loop in a component or hook.
 *
 * A timer is polling when what it runs READS DATA (see `readsData`, decided by the type of each call, not by a name): a
 * `setInterval`, or a `setTimeout` whose callback schedules the enclosing function again. The FE convention names no shared clock
 * owner (knowledge/hfs/README.md section 6: "one refresh mechanism per resource, poll or socket"), so a timer that only ticks time
 * or state - a `useNow`-style one-minute clock behind `useSyncExternalStore` - is not a second refresh mechanism.
 */
export const noHandRolledPolling = {
  meta: {
    type: "problem",
    docs: { description: "No `setInterval` and no self-scheduling `setTimeout` that reads data: one refresh mechanism per resource." },
    schema: [],
    messages: {
      interval:
        "A `setInterval` loop that reads data. This is a second refresh mechanism beside the data hook's own; two mechanisms per resource means double requests and a spinner that never settles. Refresh through the data hook (`refreshInterval`) or a socket, not a timer in the component.",
      timeout:
        "A `setTimeout` that schedules its own next run and reads data is a polling loop written by hand. Refresh through the data hook (`refreshInterval`) or a socket.",
    },
  },
  create(context) {
    const source = context.sourceCode || context.getSourceCode()
    return {
      CallExpression(node) {
        if (isIntervalCall(node)) {
          if (readsData(context, timerCallback(context, node))) context.report({ node, messageId: "interval" })
          return
        }
        const callee = node.callee
        if (callee.type !== "Identifier" || callee.name !== "setTimeout") return
        const callback = node.arguments[0]
        if (!callback || (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression")) return
        // The enclosing function: does the timer's own callback call it again (the same binding, not the same spelling)?
        const owner = source.getAncestors(node).reverse().find((ancestor) => isFn(ancestor))
        if (!owner) return
        let again = false
        const visit = (current) => {
          if (again || !current || typeof current.type !== "string") return
          if (current.type === "CallExpression" && functionOf(context, current.callee) === owner) { again = true; return }
          for (const [key, child] of Object.entries(current)) {
            if (key === "parent") continue
            if (Array.isArray(child)) child.forEach(visit)
            else if (child && typeof child.type === "string") visit(child)
          }
        }
        visit(callback.body)
        if (again && (readsData(context, callback) || readsData(context, owner))) context.report({ node, messageId: "timeout" })
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
