/**
 * The rules that hold `hygiene.md`: the small runtime habits that pass every type check and fail in a
 * reader's browser (HFS R65 `FE_SIZE_AND_STATE_BUDGET` for the subscription, catch and console rules, R50
 * `FE_TRANSPORT_OWNER` for the fetch rule).
 *
 * FOUR HABITS, ONE CAUSE: work started by a component that nobody owns the end of.
 *   - a timer, listener, observer, socket or subscription started by an effect that never releases it
 *     keeps running after the component is gone and sets state on nothing;
 *   - a fetch started in an effect has no cache, no dedupe, no error state and no cancel, which is
 *     what SWR and the server readers already give for free (R50: client reads use SWR);
 *   - an empty `catch` turns a failure into a blank screen with no trace;
 *   - `console.*` is a log nobody reads, in a place no log pipeline sees.
 *
 * DECIDED BY RESOLUTION, NOT BY SPELLING. An effect is a call whose callee IS React's `useEffect` / `useLayoutEffect`
 * export (the import is followed); `setTimeout`, `addEventListener`, `new ResizeObserver` are the platform's when their
 * symbol is declared by the default library, not by a homonym in the repository; "the same handle" is the same scope
 * binding (or member path), not the same identifier text; "a promise" is what the type checker says.
 */

import { walk } from "./lib/ast.mjs"
import { calleeParts, functionOf, isFn, keyOf, parentOf, unwrap } from "./lib/bindings.mjs"
import { isPlatform, isUnresolvedType, propertyNamesOf } from "./lib/platform.mjs"
import { EFFECT_HOOKS, reactHookOf } from "./lib/react.mjs"
import { isProductSource } from "./lib/scope.mjs"
import { isPromiseValued } from "./lib/types.mjs"

// -- HYGIENE-1 -------------------------------------------------------------------------------------

/** The platform functions that start a timer or a frame callback and hand back a handle. */
const HANDLE_STARTERS = new Map([
  ["setTimeout", "timer"],
  ["setInterval", "timer"],
  ["requestAnimationFrame", "frame"],
])

/** The platform functions that release such a handle, per kind. */
const HANDLE_RELEASERS = { timer: new Set(["clearTimeout", "clearInterval"]), frame: new Set(["cancelAnimationFrame"]) }

/** The observers that hold their targets until they are disconnected. */
const OBSERVERS = new Set(["ResizeObserver", "IntersectionObserver", "MutationObserver"])

/** The connections that stay open until they are closed. */
const CHANNELS = new Set(["WebSocket", "EventSource", "BroadcastChannel"])

/** The methods a subscription object releases itself with. */
const SUBSCRIPTION_RELEASES = ["unsubscribe", "off", "close"]

/** The global object's names: a timer or listener called through any of them is the same platform call. */
const GLOBAL_OBJECTS = new Set(["window", "globalThis", "self"])

/** `receiver` is absent or names the global object: `setTimeout(...)`, `window.setTimeout(...)`. */
const onGlobalObject = (receiver) => {
  if (!receiver) return true
  const inner = unwrap(receiver)
  return inner.type === "Identifier" && GLOBAL_OBJECTS.has(inner.name)
}

/** The nearest function around a node, or null at module level. */
const nearestFunction = (node) => {
  for (let current = node.parent; current; current = current.parent) if (isFn(current)) return current
  return null
}

/**
 * Where the value of a start call is kept: `{ key }` for `const id = ...` / `id = ...` / `ref.current = ...`,
 * `{ container }` for `list.push(...)` / `set.add(...)`, or null when the handle is dropped.
 */
const handleOf = (context, call) => {
  const parent = parentOf(call)
  if (!parent) return null
  if (parent.type === "VariableDeclarator" && unwrap(parent.init) === call && parent.id.type === "Identifier") return { key: keyOf(context, parent.id) }
  if (parent.type === "AssignmentExpression" && unwrap(parent.right) === call) {
    const key = keyOf(context, parent.left)
    return key ? { key } : null
  }
  if (parent.type === "CallExpression" && parent.arguments.some((argument) => unwrap(argument) === call)) {
    const parts = calleeParts(parent)
    if (parts?.receiver && (parts.name === "push" || parts.name === "add")) {
      const container = keyOf(context, parts.receiver)
      return container ? { container } : null
    }
  }
  return null
}

/** The static key of an event type: `s:resize` for a string literal, the binding key for an identifier. */
const typeKeyOf = (context, node) => {
  const inner = unwrap(node)
  if (inner?.type === "Literal" && typeof inner.value === "string") return `s:${inner.value}`
  if (inner?.type === "TemplateLiteral" && inner.expressions.length === 0) return `s:${inner.quasis[0].value.cooked}`
  return keyOf(context, inner)
}

/** The key of the object whose `.signal` an `addEventListener` option object passes (`{ signal: controller.signal }`), or null. */
const signalOwnerOf = (context, options) => {
  const object = unwrap(options)
  if (object?.type !== "ObjectExpression") return null
  const property = object.properties.find((entry) => entry.type === "Property" && !entry.computed && entry.key.type === "Identifier" && entry.key.name === "signal")
  if (!property) return null
  let value = unwrap(property.value)
  if (value.type === "Identifier") {
    const definition = context.sourceCode.getScope(value).set.get(value.name)?.defs[0]
    if (definition?.type === "Variable" && definition.node.init) value = unwrap(definition.node.init)
  }
  return value.type === "MemberExpression" && !value.computed && value.property.type === "Identifier" && value.property.name === "signal" ? keyOf(context, value.object) : null
}

/** Every resource a call or `new` starts that must be released, or an empty list. */
const resourcesOf = (context, node) => {
  const found = []
  if (node.type === "NewExpression") {
    const callee = unwrap(node.callee)
    if (callee.type !== "Identifier" || !(OBSERVERS.has(callee.name) || CHANNELS.has(callee.name)) || !isPlatform(context, callee)) return found
    found.push({ kind: OBSERVERS.has(callee.name) ? "observer" : "channel", node, name: callee.name, handle: handleOf(context, node) })
    return found
  }
  const parts = calleeParts(node)
  if (!parts) return found
  const callee = unwrap(node.callee)
  if (HANDLE_STARTERS.has(parts.name) && onGlobalObject(parts.receiver) && isPlatform(context, callee)) {
    found.push({ kind: HANDLE_STARTERS.get(parts.name), node, name: parts.name, handle: handleOf(context, node) })
  } else if (parts.name === "addEventListener" && node.arguments.length >= 2 && isPlatform(context, callee)) {
    const listener = unwrap(node.arguments[1])
    found.push({
      kind: "listener",
      node,
      name: "addEventListener",
      target: parts.receiver ? keyOf(context, parts.receiver) : "g:window",
      type: typeKeyOf(context, node.arguments[0]),
      typeText: context.sourceCode.getText(node.arguments[0]),
      listener: listener && !isFn(listener) ? keyOf(context, listener) : null,
      listenerText: context.sourceCode.getText(node.arguments[1]),
      signalOwner: signalOwnerOf(context, node.arguments[2]),
      receiverText: parts.receiver ? context.sourceCode.getText(parts.receiver) : null,
    })
  } else if (!reactHookOf(context, node)) {
    // a subscription object is decided by its type, and only once the call is known to sit in an effect or a subscribe
    const handle = handleOf(context, node)
    if (handle?.key) found.push({ kind: "subscription", node, name: context.sourceCode.getText(node.callee), handle })
  }
  return found
}

/** True when the value of a call is a subscription object: it carries `unsubscribe`, `off` or `close` and is neither a promise, a DOM node nor a window. */
const isSubscriptionObject = (context, call) => {
  const names = propertyNamesOf(context, call)
  return SUBSCRIPTION_RELEASES.some((name) => names.has(name)) && !names.has("then") && !names.has("nodeType") && !names.has("document") && !isUnresolvedType(context, call)
}

/** The ids of the statements' identifiers around a release: what a `list.forEach(clearTimeout)` mentions besides the releaser. */
const nearKeys = (context, node) => {
  let root = node
  for (let current = node; current; current = current.parent) {
    root = current
    if (current.type.endsWith("Statement") || current.type === "VariableDeclaration" || isFn(current.parent)) break
  }
  const keys = new Set()
  walk(context.sourceCode, root, (child) => {
    if (child.type === "Identifier" || child.type === "MemberExpression") {
      const key = keyOf(context, child)
      if (key) keys.add(key)
    }
    return undefined
  })
  return keys
}

/** Every release the given functions perform (following calls to same-file functions), as comparable records. */
const releasesIn = (context, roots) => {
  const releases = []
  const visited = new Set()
  const queue = [...roots]
  while (queue.length > 0) {
    const fn = queue.shift()
    if (!fn || visited.has(fn)) continue
    visited.add(fn)
    walk(context.sourceCode, fn, (node) => {
      if (node.type === "Identifier" && [...Object.values(HANDLE_RELEASERS)].some((set) => set.has(node.name))) {
        const parent = parentOf(node)
        const asCallee = parent?.type === "CallExpression" && unwrap(parent.callee) === node
        if (!asCallee && !(parent?.type === "MemberExpression" && parent.property === node)) releases.push({ kind: "release-ref", name: node.name, near: nearKeys(context, node) })
      }
      if (node.type !== "CallExpression") return undefined
      const parts = calleeParts(node)
      if (!parts) return undefined
      const args = node.arguments
      const isHandleReleaser = Object.values(HANDLE_RELEASERS).some((set) => set.has(parts.name))
      if (isHandleReleaser && onGlobalObject(parts.receiver)) releases.push({ kind: "release", name: parts.name, arg: args[0] ? keyOf(context, args[0]) : null })
      else if (parts.name === "removeEventListener" && args.length >= 2) {
        releases.push({ kind: "remove", target: parts.receiver ? keyOf(context, parts.receiver) : "g:window", type: typeKeyOf(context, args[0]), listener: keyOf(context, args[1]) })
      } else if (parts.receiver && ["disconnect", "close", "unsubscribe", "off", "abort"].includes(parts.name)) {
        releases.push({ kind: "method", name: parts.name, receiver: keyOf(context, parts.receiver) })
      } else if (!parts.receiver) {
        const target = functionOf(context, node.callee)
        if (target) queue.push(target)
      }
      return undefined
    })
  }
  return releases
}

/** True when the releases contain the one that ends this resource. */
const isReleased = (resource, releases) => {
  const { handle } = resource
  switch (resource.kind) {
    case "timer":
    case "frame": {
      if (!handle) return false
      const names = HANDLE_RELEASERS[resource.kind]
      return releases.some((release) => {
        if (release.kind === "release") return names.has(release.name) && handle.key !== undefined && release.arg === handle.key
        if (release.kind === "release-ref") return names.has(release.name) && handle.container !== undefined && release.near.has(handle.container)
        return false
      })
    }
    case "listener":
      if (resource.signalOwner) return releases.some((release) => release.kind === "method" && release.name === "abort" && release.receiver === resource.signalOwner)
      if (!resource.listener || !resource.target || !resource.type) return false
      return releases.some((release) => release.kind === "remove" && release.target === resource.target && release.type === resource.type && release.listener === resource.listener)
    case "observer":
      return Boolean(handle?.key) && releases.some((release) => release.kind === "method" && release.name === "disconnect" && release.receiver === handle.key)
    case "channel":
      return Boolean(handle?.key) && releases.some((release) => release.kind === "method" && release.name === "close" && release.receiver === handle.key)
    default:
      return Boolean(handle?.key) && releases.some((release) => release.kind === "method" && SUBSCRIPTION_RELEASES.includes(release.name) && release.receiver === handle.key)
  }
}

/** What to write to release a resource, for the message. */
const releaseHint = (resource) => {
  switch (resource.kind) {
    case "timer":
      return "keep the handle (`const id = " + resource.name + "(...)`) and return `() => clearTimeout(id)` (or `clearInterval`)"
    case "frame":
      return "keep the id (`const id = requestAnimationFrame(...)`) and return `() => cancelAnimationFrame(id)`"
    case "listener":
      return resource.signalOwner
        ? "return `() => controller.abort()` on the controller whose signal you passed"
        : `name the listener once and return \`() => ${resource.receiverText ? `${resource.receiverText}.` : ""}removeEventListener(${resource.typeText}, handler)\` with the same target, type and handler (or pass \`{ signal }\` and abort it)`
    case "observer":
      return "return `() => observer.disconnect()` on the observer you stored"
    case "channel":
      return "return `() => connection.close()` on the connection you stored"
    default:
      return "return `() => subscription.unsubscribe()` (or `off` / `close`) on the subscription you stored"
  }
}

/** True when the observer is `.observe`d somewhere under the owner (an observer that observes nothing holds nothing). */
const isObserved = (context, resource, owner) => {
  if (!resource.handle?.key) {
    const parent = parentOf(resource.node)
    return parent?.type === "MemberExpression" && parent.property.type === "Identifier" && parent.property.name === "observe"
  }
  let observed = false
  walk(context.sourceCode, owner, (node) => {
    if (observed) return false
    if (node.type === "CallExpression") {
      const parts = calleeParts(node)
      if (parts?.receiver && parts.name === "observe" && keyOf(context, parts.receiver) === resource.handle.key) observed = true
    }
    return undefined
  })
  return observed
}

/** The functions an owner returns as its cleanup (every top-level `return`, or the expression body of an arrow). */
const cleanupsOf = (context, owner) => {
  const cleanups = []
  const push = (expression) => {
    const inner = unwrap(expression)
    if (!inner) return
    if (inner.type === "ConditionalExpression") {
      push(inner.consequent)
      push(inner.alternate)
      return
    }
    const fn = functionOf(context, inner)
    if (fn) cleanups.push(fn)
  }
  if (owner.body.type !== "BlockStatement") {
    push(owner.body)
    return cleanups
  }
  walk(context.sourceCode, owner.body, (node) => {
    if (node !== owner.body && isFn(node)) return false
    if (node.type === "ReturnStatement" && node.argument) push(node.argument)
    return undefined
  })
  return cleanups
}

/**
 * Every effect and `useSyncExternalStore` subscribe in the file starts things that must end with it: a resource started
 * by one is released by the cleanup it returns, against the same handle, target and listener.
 */
export const effectSubscriptionNeedsCleanup = {
  meta: {
    type: "problem",
    docs: { description: "A timer, frame, listener, observer, socket or subscription started in an effect or a store subscribe is released, against the same handle, by the cleanup it returns." },
    schema: [],
    messages: {
      unreleased:
        "`{{what}}` is started here but the cleanup this {{owner}} returns does not release it against the same {{same}}. On unmount, and before the next run, the old one is still live: it fires later and sets state on a component that is gone, or keeps a listener, observer or connection open. In the cleanup: {{hint}}.",
      orphan:
        "`{{what}}` is started outside an effect and nothing in this function releases it. Nothing ends it when the component unmounts, so it fires later and sets state on a component that is gone. Start it in a `useEffect` and release it in the returned cleanup, or keep the handle and clear it in this same function.",
    },
  },
  create(context) {
    if (!isProductSource(context)) return {}
    const owners = new Map()
    const resources = []
    return {
      CallExpression(node) {
        const hook = reactHookOf(context, node)
        if (hook && (EFFECT_HOOKS.has(hook) || hook === "useSyncExternalStore") && node.arguments[0]) {
          const fn = functionOf(context, node.arguments[0])
          if (fn) owners.set(fn, EFFECT_HOOKS.has(hook) ? "effect" : "subscribe")
        }
        resources.push(...resourcesOf(context, node))
      },
      NewExpression(node) {
        resources.push(...resourcesOf(context, node))
      },
      "Program:exit"(program) {
        for (const resource of resources) {
          let owner = null
          for (let current = resource.node.parent; current && !owner; current = current.parent) if (isFn(current) && owners.has(current)) owner = current
          const what = resource.kind === "listener" ? `addEventListener(${resource.typeText}, ${resource.listenerText})` : resource.kind === "subscription" ? resource.name : resource.kind === "observer" || resource.kind === "channel" ? `new ${resource.name}(...)` : `${resource.name}(...)`
          if (!owner) {
            if (resource.kind !== "timer" && resource.kind !== "frame") continue
            const scope = nearestFunction(resource.node) ?? program
            if (!isReleased(resource, releasesIn(context, [scope]))) context.report({ node: resource.node, messageId: "orphan", data: { what } })
            continue
          }
          if (resource.kind === "observer" && !isObserved(context, resource, owner)) continue
          if (resource.kind === "subscription" && !isSubscriptionObject(context, resource.node)) continue
          if (isReleased(resource, releasesIn(context, cleanupsOf(context, owner)))) continue
          const same = resource.kind === "listener" ? "target, event type and listener" : "handle"
          context.report({ node: resource.node, messageId: "unreleased", data: { what, owner: owners.get(owner) === "effect" ? "effect" : "subscribe", same, hint: releaseHint(resource) } })
        }
      },
    }
  },
}

// -- HYGIENE-2 -------------------------------------------------------------------------------------

/** The call at the bottom of a chain: `a().b().c()` starts at `a()`. */
const rootCallOf = (call) => {
  let current = call
  for (;;) {
    const callee = unwrap(current.callee)
    if (callee.type === "MemberExpression") {
      const object = unwrap(callee.object)
      if (object.type === "CallExpression") {
        current = object
        continue
      }
    }
    return current
  }
}

/** True when a `.then` / `.catch` / `.finally` sits anywhere in the call chain. */
const isThenChained = (call) => {
  let current = call
  for (;;) {
    const callee = unwrap(current.callee)
    if (callee.type !== "MemberExpression") return false
    if (!callee.computed && callee.property.type === "Identifier" && ["then", "catch", "finally"].includes(callee.property.name)) return true
    const object = unwrap(callee.object)
    if (object.type !== "CallExpression") return false
    current = object
  }
}

/**
 * True when a call started by the effect body is a data load: it yields a promise, is `.then`-ed, or is `void`-ed
 * while nothing says what it is. A platform call other than `fetch` (`audio.play()`, `clipboard.writeText(...)`) is not
 * a data load and is left alone.
 */
const startsLoad = (context, call) => {
  const root = rootCallOf(call)
  const rootCallee = unwrap(root.callee)
  const isPlatformCall = (rootCallee.type === "Identifier" || rootCallee.type === "MemberExpression") && isPlatform(context, rootCallee)
  if (isPlatformCall && calleeParts(root)?.name !== "fetch") return false
  if (isPromiseValued(context, call) || isThenChained(call)) return true
  const parent = parentOf(call)
  return parent?.type === "UnaryExpression" && parent.operator === "void" && isUnresolvedType(context, call)
}

/** The first load the effect callback starts synchronously (an immediately-invoked function counts; a listener, timer callback or the cleanup does not). */
const loadStartedBy = (context, effect) => {
  let found = null
  walk(context.sourceCode, effect.body, (node) => {
    if (found) return false
    if (node !== effect.body && isFn(node)) {
      const parent = parentOf(node)
      return parent?.type === "CallExpression" && unwrap(parent.callee) === node ? undefined : false
    }
    if (node.type === "AwaitExpression") {
      found = node
      return false
    }
    if (node.type === "CallExpression" && startsLoad(context, node)) {
      found = node
      return false
    }
    return undefined
  })
  return found
}

/** No data loading inside `useEffect`; SWR on the client, a reader on the server. */
export const noDataFetchInEffect = {
  meta: {
    type: "problem",
    docs: { description: "An effect body starts no promise: no `await`, `fetch`, `.then`, `void load()`, `mutate()` or `refresh()`; read through SWR or a server reader." },
    schema: [],
    messages: {
      fetch:
        "This effect starts a load: it awaits, calls `fetch`, chains `.then`, or calls a function that returns a promise (`void load()`, an SWR `mutate()` or `refresh()` too). An effect has no cache, no request dedupe, no error or loading state and no cancel, so two components asking for the same thing fetch twice and a slow first answer overwrites a fast second one. Data freshness comes from the SWR key, not from an effect: call the app client through SWR (`hooks/`) keyed on what changes, run `mutate()` from the event that changed the data (a handler, a socket message), and read what a route needs in a server reader (`modules/api/<domain>/read-*.ts`).",
    },
  },
  create(context) {
    if (!isProductSource(context)) return {}
    return {
      CallExpression(node) {
        const hook = reactHookOf(context, node)
        if (!hook || !EFFECT_HOOKS.has(hook) || !node.arguments[0]) return
        const effect = functionOf(context, node.arguments[0])
        if (!effect) return
        const found = loadStartedBy(context, effect)
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
    if (!isProductSource(context)) return {}
    return {
      CatchClause(node) {
        if (node.body.body.length === 0) context.report({ node, messageId: "empty" })
      },
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier" || callee.property.name !== "catch") return
        const handler = node.arguments[0]
        if (!handler || !isFn(handler)) return
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
    if (!isProductSource(context)) return {}
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
  "effect-subscription-needs-cleanup": effectSubscriptionNeedsCleanup,
  "no-data-fetch-in-effect": noDataFetchInEffect,
  "no-empty-catch": noEmptyCatch,
  "no-console": noConsole,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
