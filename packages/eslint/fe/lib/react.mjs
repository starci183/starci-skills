/**
 * React hooks of the front-end canon, decided by the import: a call is `useEffect` when its callee is the `useEffect`
 * export of `react` (named import, alias, default or namespace member), not when something is spelled that way.
 */
import { importOf, unwrap } from "./bindings.mjs"

/** The hooks that run work after render and may return its cleanup. */
export const EFFECT_HOOKS = new Set(["useEffect", "useLayoutEffect"])

/**
 * The React export a call invokes, or null when the callee is not an export of `react`.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} call - An ESTree call expression.
 * @returns {string|null} The export name (`useEffect`, `useSyncExternalStore`, ...).
 */
export const reactHookOf = (context, call) => {
  const callee = unwrap(call.callee)
  if (callee.type === "Identifier") {
    const from = importOf(context, callee)
    return from?.source === "react" && from.imported ? from.imported : null
  }
  if (callee.type === "MemberExpression" && !callee.computed && callee.object.type === "Identifier" && callee.property.type === "Identifier") {
    const from = importOf(context, callee.object)
    return from?.source === "react" && from.imported === null ? callee.property.name : null
  }
  return null
}
