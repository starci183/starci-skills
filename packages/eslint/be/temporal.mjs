/**
 * The rule that holds `platform/clock` (catalog R79 `BE_AMBIENT_CLOCK`).
 *
 *   - `no-ambient-clock` refuses every REFERENCE to an ambient clock - `Date.now`, a zero-argument `new Date()`,
 *     `performance.now`, `process.hrtime`, `Temporal.Now` - anywhere but the `platform/clock` owner. A reference is
 *     enough: `const read = Date.now` and `{ now } = performance` read the wall clock exactly as a call does, and a
 *     spec that calls `Date.now()` races the same clock a `FakeClock` exists to drive. Business code asks the injected
 *     `Clock` port (`clock.now()`); a spec constructs a `FakeClock`. Specs are not exempt.
 *
 * `new Date(value)` - built from a value the caller already holds (a stored timestamp, a parsed header) - is not an
 * ambient read and is left alone; only the zero-argument form reads "now". The owner that may read the clock is asked
 * of the slot view (`platform` tier, capability `clock`), not of a path.
 *
 * The test world (slot `be.tests.world`) reads the wall clock too: it is the TEST COMPOSITION ROOT and infrastructure
 * owner (like an app's `main.ts` and `platform`), and its readiness polling, deadlines and fake servers measure real
 * elapsed time against real processes, which a `FakeClock` cannot drive. A spec is not the world: specs stay refused.
 */
import { hfsOf, inTestWorld } from "./lib/hfs.mjs"
import { isOwnedBy } from "./lib/ports.mjs"

/** The globals that carry an ambient reading, and the member of each that reads it (`null`: any member). */
const AMBIENT = Object.freeze({ Date: "now", performance: "now", process: "hrtime", Temporal: "Now" })

/** Modules whose import of one of the globals above is the same ambient object (`node:perf_hooks` `performance`). */
const AMBIENT_MODULES = new Set(["node:perf_hooks", "perf_hooks", "node:process", "process", "@js-temporal/polyfill", "temporal-polyfill"])

/** Modules whose named export IS an ambient reader (`import { hrtime } from "node:process"`). */
const AMBIENT_EXPORTS = Object.freeze({ "node:process": ["hrtime"], process: ["hrtime"] })

/** The variable a name resolves to from `node`'s scope, or null when it is a global. */
const variableOf = (context, node, name) => {
    let scope = (context.sourceCode || context.getSourceCode()).getScope(node)
    while (scope) {
        const found = scope.set.get(name)
        if (found) return found
        scope = scope.upper
    }
    return null
}

/** Whether the root is the ambient global (or an import of it), not a local of the same name. */
const isAmbientRoot = (context, root) => {
    if (!Object.hasOwn(AMBIENT, root.name)) return false
    if (root.viaGlobalThis) return true
    const variable = variableOf(context, root.node, root.name)
    if (!variable || variable.defs.length === 0) return true
    return variable.defs.every((def) => def.type === "ImportBinding" && AMBIENT_MODULES.has(def.parent.source.value))
}

/** The property name of a non-computed or string-literal member access, else null. */
const memberName = (node) => {
    if (!node.computed && node.property.type === "Identifier") return node.property.name
    if (node.computed && node.property.type === "Literal" && typeof node.property.value === "string") return node.property.value
    return null
}

/** `globalThis.Date` and `Date` are the same root: `{ name, node, viaGlobalThis }`, or null when the node is neither. */
const rootIdentifier = (node) => {
    if (node.type === "Identifier") return { name: node.name, node, viaGlobalThis: false }
    if (node.type === "MemberExpression" && node.object.type === "Identifier" && node.object.name === "globalThis") {
        const name = memberName(node)
        return name ? { name, node, viaGlobalThis: true } : null
    }
    return null
}

/** Only `platform/clock` reads the ambient clock. */
export const noAmbientClock = {
    meta: {
        type: "problem",
        docs: { description: "`Date.now`, a zero-argument `new Date()`, `performance.now`, `process.hrtime` and `Temporal.Now` are referenced only inside `platform/clock`." },
        schema: [],
        messages: {
            now: "`{{call}}` reads the ambient clock. Inject the `Clock` port (`@InjectClock() private readonly clock: Clock`, `clock.now()`); a spec then drives time with a `FakeClock` and a scheduled job runs at a chosen instant, neither of which a direct read allows.",
            date: "`new Date()` with no argument reads the ambient clock. Inject the `Clock` port and build the date from `clock.now()`, or - if this is parsing a value the caller already holds - pass that value to `new Date(value)`.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        if (isOwnedBy(hfs, filename, "platform", "clock") || inTestWorld(hfs, filename)) return {}
        const reportRoot = (node, root, member) => {
            if (!isAmbientRoot(context, root)) return
            const wanted = AMBIENT[root.name]
            if (member === wanted) context.report({ node, messageId: "now", data: { call: `${root.name}.${member}` } })
        }
        return {
            MemberExpression(node) {
                const member = memberName(node)
                const root = rootIdentifier(node.object)
                if (!root || member === null) return
                // `process.hrtime.bigint` is the same reader one member deeper: it is reported by the inner `process.hrtime`.
                reportRoot(node, root, member)
            },
            VariableDeclarator(node) {
                // `const { now } = Date` and `const { hrtime } = process` read the clock through a destructured alias.
                if (node.id.type !== "ObjectPattern" || !node.init) return
                const root = rootIdentifier(node.init)
                if (!root) return
                for (const property of node.id.properties) {
                    if (property.type !== "Property" || property.computed) continue
                    const key = property.key.type === "Identifier" ? property.key.name : property.key.value
                    if (typeof key === "string") reportRoot(property, root, key)
                }
            },
            ImportDeclaration(node) {
                const banned = AMBIENT_EXPORTS[node.source.value]
                if (!banned) return
                for (const specifier of node.specifiers) {
                    if (specifier.type === "ImportSpecifier" && banned.includes(specifier.imported.name ?? specifier.imported.value)) {
                        context.report({ node: specifier, messageId: "now", data: { call: `${specifier.imported.name ?? specifier.imported.value} from ${node.source.value}` } })
                    }
                }
            },
            NewExpression(node) {
                const root = rootIdentifier(node.callee)
                if (root && root.name === "Date" && isAmbientRoot(context, root) && node.arguments.length === 0) context.report({ node, messageId: "date" })
            },
            CallExpression(node) {
                // `Date()` called as a function returns the current time as a string: the same ambient read.
                const root = rootIdentifier(node.callee)
                if (root && root.name === "Date" && isAmbientRoot(context, root) && node.arguments.length === 0) context.report({ node, messageId: "date" })
            },
        }
    },
}

/** The rule this law contributes to the plugin. */
export const rules = {
    "no-ambient-clock": noAmbientClock,
}

/** Starts at error: no baseline exists, and the repositories' fix lanes clear the debt with a Clock codemod. */
export const recommended = {
    "starci-be/no-ambient-clock": "error",
}
