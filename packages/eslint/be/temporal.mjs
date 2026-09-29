/**
 * The rule that holds `platform/clock` (catalog R79 `BE_AMBIENT_CLOCK`).
 *
 *   - `no-ambient-clock` refuses `Date.now()`, a bare `new Date()` and `performance.now()` outside
 *     `platform/clock`. Business code asks the injected `Clock` port for the time (`clock.now()`),
 *     because a call to the ambient clock cannot be replaced in a spec - a test then either sleeps
 *     for real or races the wall clock, and a scheduled job cannot be driven to a chosen instant.
 *
 * `new Date(value)` - built from a value the caller already holds (a stored timestamp, a parsed
 * header) - is not an ambient read and is left alone; only the zero-argument form reads "now".
 */
import { isDeclarationFile, isTestLane, normalizePath } from "./lib/path.mjs"

const PLATFORM_CLOCK = /\/src\/modules\/platform\/clock\//

/** Whether a callee is `Date.now`. */
const isDateNow = (node) =>
    node.type === "MemberExpression" &&
    !node.computed &&
    node.object.type === "Identifier" &&
    node.object.name === "Date" &&
    node.property.type === "Identifier" &&
    node.property.name === "now"

/** Whether a callee is `performance.now`. */
const isPerformanceNow = (node) =>
    node.type === "MemberExpression" &&
    !node.computed &&
    node.object.type === "Identifier" &&
    node.object.name === "performance" &&
    node.property.type === "Identifier" &&
    node.property.name === "now"

/** Only `platform/clock` reads the ambient clock. */
export const noAmbientClock = {
    meta: {
        type: "problem",
        docs: { description: "`Date.now()`, a bare `new Date()` and `performance.now()` are read only inside `platform/clock`." },
        schema: [],
        messages: {
            now: "`{{call}}` reads the ambient clock directly. Inject the `Clock` port (`clock.now()`) instead: a spec then drives time with a `FakeClock` and a scheduled job can be tested at a chosen instant, neither of which a direct read allows.",
            date: "`new Date()` with no argument reads the ambient clock. Inject the `Clock` port and build the date from `clock.now()`, or - if this really is parsing a value the caller already holds - pass that value to `new Date(value)`.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename) || isTestLane(filename) || PLATFORM_CLOCK.test(filename)) return {}
        return {
            CallExpression(node) {
                const { callee } = node
                if (isDateNow(callee)) context.report({ node, messageId: "now", data: { call: "Date.now()" } })
                else if (isPerformanceNow(callee)) context.report({ node, messageId: "now", data: { call: "performance.now()" } })
            },
            NewExpression(node) {
                if (node.callee.type === "Identifier" && node.callee.name === "Date" && node.arguments.length === 0) {
                    context.report({ node, messageId: "date" })
                }
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
