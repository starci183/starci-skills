/**
 * The rule that holds the messages catalog (catalog R78 `BE_USER_COPY_LITERAL`).
 *
 * Text a user reads - an exception's message, a notification's subject or body, a response's `message` or
 * `description` - lives in a per-owner `messages` catalog (Vietnamese and English), reached through the typed
 * `platform/i18n` `MessageCatalog` port by a key with named interpolation. A literal in source cannot be translated,
 * cannot be found by the key a test asserts on, and drifts the moment one call site is edited and the others are not.
 *
 *   - `user-copy-through-catalog` refuses a literal string in the three places copy is written by hand:
 *       1. the message argument of a constructed error - an instance of a class that extends the language `Error`
 *          (the constructed TYPE decides, not a `*Error` name); the built-in `Error` family itself is left for
 *          internal invariants;
 *       2. a `subject`/`title`/`body`/`text`/`message` property of an object handed to an outbound port - a call on a
 *          receiver whose type is declared by an `integrations` owner or by `platform/event-bus` or `platform/queue` (the receiver's type
 *          decides, not a method name such as `send`);
 *       3. a `message`/`description`/`title` property of an object literal built in a transport slot.
 *
 * A short, code-shaped literal (`UPPER_SNAKE`, or a single bare word with no space or punctuation - `"PLAN_NOT_FOUND"`,
 * `"pending"`) is a key or an enum value, not copy, and is left alone; so is a template literal, which this reads one
 * file's syntax for and cannot split into its static and interpolated halves without guessing. Specs get the same
 * law: fixture text is a `messages` catalog key or lives in a fixture.
 */
import { isTransportSlot } from "./lib/transport-slots.mjs"
import { keyName, staticText } from "./lib/ast.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { ownerNameOf } from "./lib/ports.mjs"
import { typeOrigins, typed } from "./lib/types.mjs"
import { isDeclarationFile } from "./lib/path.mjs"

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

/** Whether a TypeScript type is a class the repository or a package declares that extends the language `Error`. */
const isCustomError = (program, checker, type) => {
    const declaredByLanguage = (candidate) => (candidate.getSymbol()?.getDeclarations() ?? []).some((declaration) => program.isSourceFileDefaultLibrary(declaration.getSourceFile()))
    if (declaredByLanguage(type)) return false
    const seen = new Set()
    const extendsError = (candidate) => {
        if (seen.has(candidate)) return false
        seen.add(candidate)
        if (!candidate.isClassOrInterface()) return false
        return checker.getBaseTypes(candidate).some((base) => (declaredByLanguage(base) && base.getSymbol()?.name === "Error") || extendsError(base))
    }
    return extendsError(type)
}

/** Whether a receiver's type is declared by an `integrations` owner or by `platform/event-bus` or `platform/queue`: an outbound port. */
const isOutboundPort = (context, hfs, node) =>
    typeOrigins(context, node).some((origin) => origin.module === null && (hfs.tierOf(origin.file) === "integrations" || (hfs.tierOf(origin.file) === "platform" && ["event-bus", "queue"].includes(ownerNameOf(hfs, origin.file) ?? ""))))

/** User-facing text is looked up in the catalog by key, never written where it is used. */
export const userCopyThroughCatalog = {
    meta: {
        type: "problem",
        docs: { description: "A literal exception message, notification text or response copy comes from the messages catalog, not from source." },
        schema: [],
        messages: {
            exception: "`{{name}}`'s message is a literal string. A user-facing exception message comes from the per-owner messages catalog (`messages.get('<key>', params)`) through the typed `MessageCatalog` port, in Vietnamese and English, not written in source.",
            notification: "`{{property}}` of this call to an outbound port is a literal string. Notification copy comes from the messages catalog through the `MessageCatalog` port, not written at the call site.",
            response: "`{{property}}` of this response is a literal string. Response copy comes from the messages catalog through the `MessageCatalog` port, not written in source.",
        },
    },
    create(context) {
        const filename = context.filename || context.getFilename()
        if (isDeclarationFile(filename)) return {}
        const hfs = hfsOf(context)
        const slot = hfs.slotOf(filename) ?? ""
        const inTransport = isTransportSlot(slot)
        const { program, checker, toTs } = typed(context)
        const isOutboundCall = (node) =>
            node?.type === "CallExpression" && node.callee.type === "MemberExpression" && !node.callee.computed && isOutboundPort(context, hfs, node.callee.object)
        return {
            NewExpression(node) {
                const first = node.arguments[0]
                if (!first) return
                const tsNode = toTs(node)
                if (!tsNode || !isCustomError(program, checker, checker.getTypeAtLocation(tsNode))) return
                const text = staticText(first)
                if (text !== null && looksLikeCopy(text)) {
                    const name = node.callee.type === "Identifier" ? node.callee.name : "the error"
                    context.report({ node: first, messageId: "exception", data: { name } })
                }
            },
            CallExpression(node) {
                if (!isOutboundCall(node)) return
                const objectArg = node.arguments.find((argument) => argument.type === "ObjectExpression")
                if (!objectArg) return
                for (const property of objectArg.properties) {
                    if (property.type !== "Property") continue
                    const key = keyName(property.key)
                    if (!key || !NOTIFY_TEXT_PROPS.has(key)) continue
                    const text = staticText(property.value)
                    if (text !== null && looksLikeCopy(text)) context.report({ node: property.value, messageId: "notification", data: { property: key } })
                }
            },
            Property(node) {
                if (!inTransport) return
                const key = keyName(node.key)
                if (!key || !RESPONSE_TEXT_PROPS.has(key)) return
                const text = staticText(node.value)
                if (text === null || !looksLikeCopy(text)) return
                if (isOutboundCall(node.parent?.parent)) return // already judged as notification copy
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
