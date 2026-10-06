/**
 * The rule that keeps `async` honest.
 *
 * `async-needs-await` (R73 `BE_ASYNC_NO_AWAIT`) refuses an `async` function that never awaits. Such a function
 * promises asynchronous work and does none: it turns a thrown error into a rejected promise for no reason,
 * hides that the body is synchronous, and reads as if a suspension point existed. Delete the `async` and return the
 * value (or the promise the body already holds); where a signature must return a `Promise`, return `Promise.resolve(x)`.
 *
 * Three shapes are exempt because the `async` is not the author's choice:
 *   - a method of a class that `implements` or `extends` something (the base contract fixes the return type);
 *   - a method that carries a decorator (the framework contract fixes it: resolvers, event handlers, lifecycle hooks);
 *   - an `async` generator, whose `yield` is its suspension.
 */
import { walk } from "./lib/ast.mjs"
import { isDeclarationFile } from "./lib/path.mjs"

/** Whether the function body awaits, ignoring nested functions (each is judged alone). */
const awaits = (fn) => {
  let found = false
  walk(fn.body, (node) => {
    if (found) return
    if (node.type === "AwaitExpression") found = true
    else if (node.type === "ForOfStatement" && node.await) found = true
  }, { intoFunctions: false })
  return found
}

/** Whether the function is a method whose `async` a base class, interface or decorator fixes. */
const asyncIsContractual = (fn) => {
  const method = fn.parent?.type === "MethodDefinition" ? fn.parent : null
  if (!method) return false
  if (method.decorators?.length > 0) return true
  if (method.override) return true
  const klass = method.parent?.parent
  if (klass && (klass.superClass || (klass.implements && klass.implements.length > 0))) return true
  return false
}

/** An `async` function awaits something. */
export const asyncNeedsAwait = {
  meta: {
    type: "problem",
    docs: { description: "An `async` function contains an `await`, or it is not `async`." },
    schema: [],
    messages: {
      noAwait:
        "This `async` function never awaits. It promises asynchronous work and does none, so a thrown error becomes a rejected promise for no reason and a reader looks for a suspension that is not there. Remove `async` and return the value or the promise the body already holds; where the signature must return a `Promise`, return `Promise.resolve(value)`.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isDeclarationFile(filename)) return {}
    const check = (node) => {
      if (!node.async || node.generator || !node.body) return
      if (node.body.type !== "BlockStatement" && node.type === "ArrowFunctionExpression") {
        // an expression body has no statements to await inside; `async () => x` is judged by the expression itself
        let has = false
        walk(node.body, (child) => {
          if (child.type === "AwaitExpression") has = true
        }, { intoFunctions: false })
        if (!has) context.report({ node, messageId: "noAwait" })
        return
      }
      if (asyncIsContractual(node)) return
      if (!awaits(node)) context.report({ node, messageId: "noAwait" })
    }
    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "async-needs-await": asyncNeedsAwait,
}

/** Starts at error: no baseline exists, and the repositories' fix lanes clear the debt. */
export const recommended = {
  "starci-be/async-needs-await": "error",
}
