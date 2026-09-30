/**
 * The rule that keeps every back-end spec running (catalog R48 `BE_SPEC_QUALITY`, owner test policy 2026-09-30).
 *
 * A unit, integration, e2e or contract spec never skips, focuses, marks as todo or picks its own runner: a test that does
 * not run is a claim nobody checks. The ONE legitimate skip is the contract layer's own: the contract helper (a file of the
 * slot `be.tests.world`, e.g. `contract.client.ts`) skips itself when the provider sandbox is not configured and hands the
 * spec `sandbox.describe(...)`. That decision lives in the world, so this rule does not look at a `be.tests.world` file
 * and a spec has no way to write a skip itself.
 *
 * Refused in a spec: `it|test|describe` followed by `.skip`, `.skipIf`, `.runIf`, `.todo` or `.only`; `xit`, `xtest`,
 * `xdescribe`, `fit`, `ftest`, `fdescribe`; and a runner used as a value (a conditional `(cond ? describe : describe.skip)`,
 * `const run = describe`, a computed member), because the choice then hides a skip. `it.each` and `it.concurrent` stay.
 * A runner is the test global or the import of `@jest/globals` / `vitest`, judged by its scope binding, never by a name
 * alone: a local variable called `it` is not one.
 */
import { hfsOf } from "./lib/hfs.mjs"
import { isSpecFile } from "./lib/path.mjs"

const RUNNERS = new Set(["describe", "it", "test"])
const MARKED = new Set(["xit", "xtest", "xdescribe", "fit", "ftest", "fdescribe"])
const BLOCKING_MEMBERS = new Set(["skip", "skipIf", "runIf", "todo", "only"])
const RUNNER_PACKAGES = new Set(["@jest/globals", "vitest"])

/** The variable a name resolves to from a scope, or null for an unresolved (global) name. */
const resolve = (scope, name) => {
    for (let current = scope; current; current = current.upper) {
        const variable = current.set.get(name)
        if (variable && variable.defs.length > 0) return variable
    }
    return null
}

/** A spec runs every test it declares; the skip lives in the world's contract helper. */
export const specNoSkip = {
    meta: {
        type: "problem",
        docs: { description: "A spec never skips, focuses, marks todo or selects its runner conditionally; only the world's contract helper skips itself." },
        schema: [],
        messages: {
            skip: "`{{what}}` keeps a test from running. A spec runs every test it declares: delete it or write it. The only skip is the contract helper's own (`sandbox.describe(...)` of `src/tests/world`), decided in the world when the sandbox config is absent.",
            select: "A test runner (`{{what}}`) is used as a value here, so the spec picks or hides what runs. Call `describe`/`it`/`test` directly; a contract spec calls `sandbox.describe(...)` and the world decides the skip.",
        },
    },
    create(context) {
        const filename = context.filename || context.getFilename()
        if (!isSpecFile(filename) || hfsOf(context).slotOf(filename) === "be.tests.world") return {}
        const isRunner = (node) => {
            const variable = resolve(context.sourceCode.getScope(node), node.name)
            if (variable === null) return true
            return variable.defs.some((def) => def.type === "ImportBinding" && RUNNER_PACKAGES.has(String(def.parent?.source?.value)))
        }
        return {
            Identifier(node) {
                const parent = node.parent
                if (parent.type === "TSTypeQuery" || parent.type === "ImportSpecifier" || parent.type === "ExportSpecifier") return
                if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) return
                if (parent.key === node && !parent.computed && !parent.shorthand) return
                const marked = MARKED.has(node.name)
                if (!marked && !RUNNERS.has(node.name)) return
                if (!isRunner(node)) return
                if (marked) return context.report({ node, messageId: "skip", data: { what: node.name } })
                if (parent.type === "CallExpression" && parent.callee === node) return
                if (parent.type === "MemberExpression" && parent.object === node) {
                    const member = parent.computed ? (parent.property.type === "Literal" ? String(parent.property.value) : null) : parent.property.name
                    if (member === null) return context.report({ node: parent, messageId: "select", data: { what: node.name } })
                    if (BLOCKING_MEMBERS.has(member)) return context.report({ node: parent, messageId: "skip", data: { what: `${node.name}.${member}` } })
                    return
                }
                context.report({ node, messageId: "select", data: { what: node.name } })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "spec-no-skip": specNoSkip,
}

/** Every rule of this law ships at `error`. */
export const recommended = {
    "starci-be/spec-no-skip": "error",
}
