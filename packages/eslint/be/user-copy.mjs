/**
 * The rule that holds the messages catalog (catalog R78 `BE_USER_COPY_LITERAL`).
 *
 * Text a user reads - an exception's message, a notification's subject or body, a response's
 * `message` or `description` - lives in a per-capability `messages` catalog (Vietnamese and
 * English), reached through the typed `platform/i18n` `MessageCatalog` port by a key with named
 * interpolation. A literal in source cannot be translated, cannot be found by the key a test
 * asserts on, and drifts the moment one call site is edited and the others are not.
 *
 *   - `user-copy-through-catalog` refuses a literal string in the three places copy is written by
 *     hand: the message argument of a `*Error`/`*Exception` constructor, a `subject`/`title`/
 *     `body`/`text`/`message` property of an object passed to `notify`/`send`/`publish`, and a
 *     `message`/`description`/`title` property of an object literal built in a `transport/` file.
 *
 * A short, code-shaped literal (`UPPER_SNAKE`, or a single bare word with no space or punctuation -
 * `"PLAN_NOT_FOUND"`, `"pending"`) is a key or an enum value, not copy, and is left alone; so is a
 * template literal, which this reads one file's syntax for and cannot split into its static and
 * interpolated halves without guessing. `no-non-ascii-source` already refuses Vietnamese text
 * anywhere; this rule is the English half, scoped to the three places copy is written.
 */
import { keyName, staticText } from "./lib/ast.mjs"
import { isDeclarationFile, isTestLane, normalizePath } from "./lib/path.mjs"

const BUILTIN_ERRORS = new Set(["Error", "TypeError", "RangeError", "SyntaxError", "EvalError", "URIError", "ReferenceError", "AggregateError"])
const NOTIFY_METHODS = new Set(["notify", "send", "publish"])
const NOTIFY_TEXT_PROPS = new Set(["subject", "title", "body", "text", "message"])
const RESPONSE_TEXT_PROPS = new Set(["message", "description", "title"])

/** A literal that reads as prose rather than a code, an enum value or a key. */
const looksLikeCopy = (text) => {
    const trimmed = text.trim()
    if (!trimmed) return false
    if (/^[A-Z][A-Z0-9_]*$/.test(trimmed)) return false // a code: PLAN_NOT_FOUND
    if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(trimmed)) return false // a single bare word: pending, plan-not-found
    return true
}

const isNotifyCall = (node) =>
    node?.type === "CallExpression"
    && node.callee.type === "MemberExpression"
    && !node.callee.computed
    && node.callee.property.type === "Identifier"
    && NOTIFY_METHODS.has(node.callee.property.name)

/** User-facing text is looked up in the catalog by key, never written where it is used. */
export const userCopyThroughCatalog = {
    meta: {
        type: "problem",
        docs: { description: "A literal exception message, notification text or response copy comes from the messages catalog, not from source." },
        schema: [],
        messages: {
            exception: "`{{name}}`'s message is a literal string. A user-facing exception message comes from the per-capability messages catalog (`messages.get('<key>', params)`) through the typed `MessageCatalog` port, in Vietnamese and English, not written in source.",
            notification: "`{{property}}` of this {{call}} call is a literal string. Notification copy comes from the messages catalog through the `MessageCatalog` port, not written at the call site.",
            response: "`{{property}}` of this response is a literal string. Response copy comes from the messages catalog through the `MessageCatalog` port, not written in source.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename) || isTestLane(filename)) return {}
        const inTransport = filename.includes("/transport/")
        return {
            NewExpression(node) {
                const name = node.callee.type === "Identifier" ? node.callee.name : null
                if (!name || BUILTIN_ERRORS.has(name) || !/(?:Error|Exception)$/.test(name)) return
                const first = node.arguments[0]
                if (!first) return
                const text = staticText(first)
                if (text !== null && looksLikeCopy(text)) context.report({ node: first, messageId: "exception", data: { name } })
            },
            CallExpression(node) {
                if (!isNotifyCall(node)) return
                const callName = node.callee.property.name
                const objectArg = node.arguments.find((argument) => argument.type === "ObjectExpression")
                if (!objectArg) return
                for (const property of objectArg.properties) {
                    if (property.type !== "Property") continue
                    const key = keyName(property.key)
                    if (!key || !NOTIFY_TEXT_PROPS.has(key)) continue
                    const text = staticText(property.value)
                    if (text !== null && looksLikeCopy(text)) {
                        context.report({ node: property.value, messageId: "notification", data: { property: key, call: callName } })
                    }
                }
            },
            Property(node) {
                if (!inTransport) return
                const key = keyName(node.key)
                if (!key || !RESPONSE_TEXT_PROPS.has(key)) return
                const text = staticText(node.value)
                if (text === null || !looksLikeCopy(text)) return
                if (isNotifyCall(node.parent?.parent)) return // already judged as notification copy
                context.report({ node: node.value, messageId: "response", data: { property: key } })
            },
        }
    },
}

/** The rule this law contributes to the plugin. */
export const rules = {
    "user-copy-through-catalog": userCopyThroughCatalog,
}

/** Starts at error: a hand-written user-facing string is never a warning. */
export const recommended = {
    "starci-be/user-copy-through-catalog": "error",
}
