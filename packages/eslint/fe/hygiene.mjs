/**
 * The rules that hold `hygiene.md`: the small runtime habits that pass every type check and fail in a
 * reader's browser (HFS R65 `FE_SIZE_AND_STATE_BUDGET` for the timer, catch and console rules, R50
 * `FE_TRANSPORT_OWNER` for the fetch rule).
 *
 * FOUR HABITS, ONE CAUSE: work started by a component that nobody owns the end of.
 *   - a timer started outside an effect, or in one that never clears it, fires after the component is
 *     gone and sets state on nothing;
 *   - a fetch started in an effect has no cache, no dedupe, no error state and no cancel, which is
 *     what SWR and the server readers already give for free (R50: client reads use SWR);
 *   - an empty `catch` turns a failure into a blank screen with no trace;
 *   - `console.*` is a log nobody reads, in a place no log pipeline sees.
 */

import { calleeName, effectCallback, isEffectCall, isFunction, walk } from "./lib/ast.mjs"
import { isSpecFile } from "./lib/scope.mjs"
import { normalizePath } from "./lib/path.mjs"

/** Product source outside specs. */
const isGoverned = (filename) => {
  const file = normalizePath(filename)
  return file.includes("/src/") && !isSpecFile(file)
}

/** The timer functions, bare or on the global. */
const TIMERS = new Set(["setTimeout", "setInterval", "window.setTimeout", "window.setInterval", "globalThis.setTimeout", "globalThis.setInterval"])

// -- HYGIENE-1 -------------------------------------------------------------------------------------

/** The effect callback that encloses `node`, crossing any function boundary, or null. */
const enclosingEffect = (node) => {
  for (let current = node.parent; current; current = current.parent) {
    if (isFunction(current) && current.parent?.type === "CallExpression" && isEffectCall(current.parent) && effectCallback(current.parent) === current) {
      return current
    }
  }
  return null
}

/** The value an effect callback returns at its own top level (the cleanup), or null. */
const cleanupOf = (effect) => {
  if (effect.body.type !== "BlockStatement") return null
  const last = [...effect.body.body].reverse().find((statement) => statement.type === "ReturnStatement")
  return last?.argument ?? null
}

const CLEARERS = new Set(["clearTimeout", "clearInterval", "window.clearTimeout", "window.clearInterval", "globalThis.clearTimeout", "globalThis.clearInterval"])

/** The identifier a timer call's handle is stored in (`const id = ...` or `id = ...`), or null. */
const handleOf = (call) => {
  const parent = call.parent
  if (parent?.type === "VariableDeclarator" && parent.init === call && parent.id.type === "Identifier") return parent.id.name
  if (parent?.type === "AssignmentExpression" && parent.right === call && parent.left.type === "Identifier") return parent.left.name
  return null
}

/** The function a function directly returns (arrow expression body, or its last top-level `return`), or null. */
const returnedFunction = (fn) => {
  if (fn.body.type !== "BlockStatement") return isFunction(fn.body) ? fn.body : null
  const last = [...fn.body.body].reverse().find((statement) => statement.type === "ReturnStatement")
  return last?.argument && isFunction(last.argument) ? last.argument : null
}

/**
 * True when a function enclosing the timer call returns a closure that clears the same handle: the
 * `subscribe` of `useSyncExternalStore`, or any owner that hands back its own unsubscribe.
 */
const clearedByReturnedCleanup = (call, source) => {
  const handle = handleOf(call)
  if (!handle) return false
  for (let current = call.parent; current; current = current.parent) {
    if (current.type !== "FunctionExpression" && current.type !== "ArrowFunctionExpression" && current.type !== "FunctionDeclaration") continue
    const cleanup = returnedFunction(current)
    if (!cleanup) continue
    let clears = false
    walk(source, cleanup, (node) => {
      if (node.type === "CallExpression" && CLEARERS.has(calleeName(node.callee)) && node.arguments[0]?.type === "Identifier" && node.arguments[0].name === handle) clears = true
    })
    if (clears) return true
  }
  return false
}

/** A timer belongs in an effect that clears it, or in a function whose returned cleanup clears it. */
export const timerNeedsEffectCleanup = {
  meta: {
    type: "problem",
    docs: { description: "`setTimeout` and `setInterval` live in an effect whose cleanup clears them." },
    schema: [],
    messages: {
      orphan:
        "`{{timer}}` is started outside an effect. Nothing ends it when the component unmounts, so it fires later and sets state on a component that is gone. Start it in a `useEffect` and clear it in the cleanup, or move it into a hook that does.",
      noCleanup:
        "`{{timer}}` is started in an effect that returns no cleanup which clears it. On unmount or on the next run the old timer is still pending. Return `() => clearTimeout(id)` (or `clearInterval`).",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    // Non-React modules (the API client's timeout, the theme bootstrap) own their timers and clear them in `finally`.
    if (!isGoverned(filename) || /\/modules\//.test(normalizePath(filename))) return {}
    const source = context.sourceCode ?? context.getSourceCode()
    return {
      CallExpression(node) {
        const name = calleeName(node.callee)
        if (!name || !TIMERS.has(name)) return
        if (clearedByReturnedCleanup(node, source)) return
        const effect = enclosingEffect(node)
        if (!effect) return context.report({ node, messageId: "orphan", data: { timer: name } })
        const cleanup = cleanupOf(effect)
        const clears = cleanup && /\bclear(?:Timeout|Interval)\b/.test(source.getText(cleanup))
        if (!clears) context.report({ node, messageId: "noCleanup", data: { timer: name } })
      },
    }
  },
}

// -- HYGIENE-2 -------------------------------------------------------------------------------------

/** A fetch in an effect: `await`, `fetch(...)`, `.then(...)`, outside the cleanup function. */
const fetchesIn = (sourceCode, effect) => {
  const cleanup = cleanupOf(effect)
  let found = null
  walk(sourceCode, effect.body, (node) => {
    if (found) return false
    if (node === cleanup) return false
    if (node.type === "AwaitExpression") found = node
    else if (node.type === "CallExpression") {
      const name = calleeName(node.callee)
      if (name === "fetch" || name === "window.fetch" || (node.callee.type === "MemberExpression" && node.callee.property.type === "Identifier" && node.callee.property.name === "then")) {
        found = node
      }
    }
    return undefined
  })
  return found
}

/** No data loading inside `useEffect`; SWR on the client, a reader on the server. */
export const noDataFetchInEffect = {
  meta: {
    type: "problem",
    docs: { description: "No `await`, `fetch` or `.then` inside a `useEffect`; read through SWR or a server reader." },
    schema: [],
    messages: {
      fetch:
        "This effect loads data (`await`, `fetch` or `.then`). An effect has no cache, no request dedupe, no error or loading state and no cancel, so two components asking for the same thing fetch twice and a slow first answer overwrites a fast second one. Client reads use SWR calling the app client (`hooks/`); reads a route needs go through a server reader (`modules/api/<domain>/read-*.ts`).",
    },
  },
  create(context) {
    if (!isGoverned(context.filename || context.getFilename())) return {}
    const source = context.sourceCode ?? context.getSourceCode()
    return {
      CallExpression(node) {
        if (!isEffectCall(node)) return
        const effect = effectCallback(node)
        if (!effect) return
        const found = fetchesIn(source, effect)
        if (found) context.report({ node: found, messageId: "fetch" })
      },
    }
  },
}

// -- HYGIENE-3 -------------------------------------------------------------------------------------

/** A `catch` block with nothing in it, or a promise `.catch` handler with nothing in it. */
export const noEmptyCatch = {
  meta: {
    type: "problem",
    docs: { description: "A `catch` that does nothing hides the failure; handle it or return a typed outcome." },
    schema: [],
    messages: {
      empty:
        "This `catch` does nothing. The failure disappears: no message for the reader, no trace for the team. Return a typed outcome that carries the cause, show the error state, or rethrow.",
      promise:
        "This `.catch` handler does nothing, so a rejected promise disappears. Turn it into a typed outcome the caller renders, or let it propagate.",
    },
  },
  create(context) {
    if (!isGoverned(context.filename || context.getFilename())) return {}
    return {
      CatchClause(node) {
        if (node.body.body.length === 0) context.report({ node, messageId: "empty" })
      },
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier" || callee.property.name !== "catch") return
        const handler = node.arguments[0]
        if (!handler || !isFunction(handler)) return
        const empty =
          (handler.body.type === "BlockStatement" && handler.body.body.length === 0) ||
          (handler.body.type === "Identifier" && handler.body.name === "undefined") ||
          (handler.body.type === "Literal" && handler.body.value === null)
        if (empty) context.report({ node: handler, messageId: "promise" })
      },
    }
  },
}

// -- HYGIENE-4 -------------------------------------------------------------------------------------

/** No `console.*` in product source. */
export const noConsole = {
  meta: {
    type: "problem",
    docs: { description: "No `console.*` call in product source." },
    schema: [],
    messages: {
      console:
        "`console.{{method}}` in product source. It reaches no log pipeline, leaks internals into a reader's devtools and hides the real handling. Return a typed outcome, render the error state, or let the error reach `error.tsx`.",
    },
  },
  create(context) {
    if (!isGoverned(context.filename || context.getFilename())) return {}
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.object.type !== "Identifier" || callee.object.name !== "console") return
        const method = callee.property.type === "Identifier" ? callee.property.name : "*"
        context.report({ node, messageId: "console", data: { method } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "timer-needs-effect-cleanup": timerNeedsEffectCleanup,
  "no-data-fetch-in-effect": noDataFetchInEffect,
  "no-empty-catch": noEmptyCatch,
  "no-console": noConsole,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
