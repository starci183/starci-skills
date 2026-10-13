/**
 * The rules that hold the composition files of a back-end app (catalog R245 `BE_APP_OPTIONS_COMPOSITION` and R246
 * `BE_APP_COMPOSITION_BUDGET`, owner ruling 2026-10-14). An app's `src/` holds four roles, named by the entries of its `be.app.*` slot (`lib/app-roles.mjs`):
 * `main.ts`, `app.module.ts`, `<app>.options.ts` and the composition groups `compose/<area>.ts`.
 *
 *   - `app-options-composition-free` (`BE_APP_OPTIONS_COMPOSITION`) keeps `<app>.options.ts` to what the app reads from its
 *     environment plus port bindings (provider maps such as `{ approvalGate: X }`): an array that lists Nest modules (a
 *     `*Module` class, a `X.register(...)`/`forRoot(...)`/`registerQueue(...)` call), queue registrations or scheduler entries
 *     (a `*SchedulerOf(...)`, `*Scheduler(...)` or `*Queue(...)` call), a spread of such a list, and an `imports`, `modules`,
 *     `schedulers` or `processors` array are refused. Those lists are composition: they live in `compose/<area>.ts`, one
 *     group per area, which `app.module.ts` spreads.
 *   - `app-file-budget` (`BE_APP_COMPOSITION_BUDGET`) holds each composition file to the line budget its app slot names
 *     (`budget` of the slot, keyed by the same entry: `app.module.ts` 250, `<app>.options.ts` 200, `compose/<area>.ts` 120,
 *     `main.ts` 80). The budget is absolute, not a ratchet: an app root that outgrows it moves an area into a new group.
 *
 * Both rules ask the slot view which entry a file matches; neither keeps a path of its own.
 */
import { lineCount } from "./runtime/scripts/lib/line-count.mjs"
import { APP_OPTIONS_ROLE, appRoleOf } from "./lib/app-roles.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { keyName } from "./lib/ast.mjs"
import { isDeclarationFile, normalizePath } from "./lib/path.mjs"

/** Static factories that register a Nest module (a dynamic module), a queue or a flow producer. */
const REGISTRATION_CALLS = new Set([
    "register",
    "registerAsync",
    "forRoot",
    "forRootAsync",
    "forFeature",
    "forFeatureAsync",
    "registerQueue",
    "registerQueueAsync",
    "registerFlowProducer",
])

/** Keys whose array value is a composition list whatever it holds. */
const COMPOSITION_KEYS = new Set(["imports", "modules", "schedulers", "processors"])

/** A name that is a Nest module class. */
const MODULE_NAME = /Module$/
/** A name that is a list of modules, queues, schedulers or processors (the operand of a spread). */
const LIST_NAME = /(?:Modules|Queues|Schedulers|Processors)$/
/** A call that builds a scheduler entry or a queue registration: `orderExpirySchedulerOf(...)`, `ordersQueue(...)`. */
const ENTRY_CALL = /(?:Scheduler|Queue)(?:Of)?$/

/** The last name of an identifier or a non-computed member expression, else null. */
const lastName = (node) => {
    if (node?.type === "Identifier") return node.name
    if (node?.type === "MemberExpression" && !node.computed) return keyName(node.property)
    return null
}

/** What an array element composes (`module`, `registration`, `scheduler`, `list`), or null when it is plain options data. */
const compositionOf = (element) => {
    if (!element) return null
    if (element.type === "SpreadElement") {
        const spread = element.argument.type === "CallExpression" ? lastName(element.argument.callee) : lastName(element.argument)
        return spread !== null && (LIST_NAME.test(spread) || MODULE_NAME.test(spread)) ? "list" : null
    }
    if (element.type === "CallExpression") {
        const callee = element.callee
        if (callee.type === "MemberExpression" && !callee.computed && REGISTRATION_CALLS.has(keyName(callee.property))) return "registration"
        const name = lastName(callee)
        return name !== null && ENTRY_CALL.test(name) ? "scheduler" : null
    }
    const name = lastName(element)
    return name !== null && MODULE_NAME.test(name) ? "module" : null
}

/** `<app>.options.ts` holds env-derived options and port bindings only: no module, queue or scheduler list. */
export const appOptionsCompositionFree = {
    meta: {
        type: "problem",
        docs: { description: "`apps/<app>/src/<app>.options.ts` holds env-derived options and port bindings only; module, queue and scheduler lists live in `compose/<area>.ts`." },
        schema: [],
        messages: {
            list: "`{{key}}` is a composition list in the app options. `<app>.options.ts` holds what the app reads from its environment and its port bindings only; move this list into `apps/<app>/src/compose/<area>.ts` (one group per area) and spread the group in `app.module.ts`.",
            element: "This array lists a {{what}} in the app options. `<app>.options.ts` holds what the app reads from its environment and its port bindings only; module lists, queue registrations and scheduler entries live in `apps/<app>/src/compose/<area>.ts`, which `app.module.ts` spreads.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        if (appRoleOf(hfsOf(context), filename)?.entry !== APP_OPTIONS_ROLE) return {}
        const judged = new WeakSet()
        return {
            Property(node) {
                if (node.value?.type !== "ArrayExpression") return
                const key = node.computed ? null : keyName(node.key)
                if (key === null || !COMPOSITION_KEYS.has(key)) return
                judged.add(node.value)
                context.report({ node, messageId: "list", data: { key } })
            },
            "ArrayExpression:exit"(node) {
                if (judged.has(node)) return
                const what = node.elements.map(compositionOf).find((kind) => kind !== null)
                if (what === undefined) return
                const label = { module: "Nest module", registration: "module or queue registration", scheduler: "scheduler or queue entry", list: "spread of a module, queue or scheduler list" }[what]
                context.report({ node, messageId: "element", data: { what: label } })
            },
        }
    },
}

/** Each composition file of an app stays within the line budget its app slot names. */
export const appFileBudget = {
    meta: {
        type: "problem",
        docs: { description: "`main.ts`, `app.module.ts`, `<app>.options.ts` and `compose/<area>.ts` stay within the line budget of their app slot." },
        schema: [],
        messages: {
            over: "This {{role}} has {{lines}} lines, over its budget of {{max}} (the `budget` of slot {{slot}}). {{fix}}",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const hfs = hfsOf(context)
        const role = appRoleOf(hfs, filename)
        const max = role ? hfs.slot(role.slot)?.budget?.[role.entry] : undefined
        if (!Number.isInteger(max)) return {}
        const fix = role.entry === APP_OPTIONS_ROLE
            ? "Keep env-derived options and port bindings here; move any module, queue or scheduler list into `compose/<area>.ts`."
            : "Move one area of the composition into its own group `apps/<app>/src/compose/<area>.ts` and spread it in `app.module.ts`."
        return {
            "Program:exit"(node) {
                const lines = lineCount((context.sourceCode || context.getSourceCode()).text)
                if (lines > max) context.report({ node, loc: { line: 1, column: 0 }, messageId: "over", data: { role: role.entry, lines, max, slot: role.slot, fix } })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "app-options-composition-free": appOptionsCompositionFree,
    "app-file-budget": appFileBudget,
}

/** Both start at error: every rule is an error, and an app already over a budget migrates its lists into compose/. */
export const recommended = {
    "starci-be/app-options-composition-free": "error",
    "starci-be/app-file-budget": "error",
}
