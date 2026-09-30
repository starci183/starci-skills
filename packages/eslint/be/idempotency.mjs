/**
 * The rule that holds inbox dedupe (catalog R80 `BE_INBOX_DEDUPE_MISSING`).
 *
 * A sender that gets no timely reply resends: a payment provider retries a webhook, a queue redelivers a message it
 * never saw acknowledged. The standard is one inbox table keyed by `(source, event id)` in front of every door
 * delivery can repeat through, so a repeat is a no-op instead of a second charge, a second email or a second state
 * transition.
 *
 *   - `inbox-dedupe-required` judges every delivery handler: each public method of a consumer (a `*.consumer.ts` file
 *     of slot `be.transport.message`) and each method under `@Public({ reason: PublicReason.SignedWebhook })` (the
 *     decorator on the method or on its class; the reason is read by its TYPE, the enum member `SignedWebhook` of
 *     `PublicReason`). The FIRST awaited expression of the handler must be `claim(source, eventId)` on a receiver whose
 *     type is the `Inbox` port of `platform/inbox`, and the handler must return early when the claim answers `false`.
 *     A lookalike `Inbox` declared by another owner, a renamed receiver and a property injection are all judged by the
 *     receiver's type, so only the real port satisfies the rule; a keyword or a class name never does.
 *
 * Accepted shapes of "claim, then return on false":
 *   if (!(await this.inbox.claim(source, id))) return
 *   if ((await this.inbox.claim(source, id)) === false) { return }
 *   const fresh = await this.inbox.claim(source, id)
 *   if (!fresh) return
 * Whether the handler has side effects BEFORE its first await stays a review question (the call graph is not read).
 */
import { hfsOf } from "./lib/hfs.mjs"
import { walk } from "./lib/ast.mjs"
import { baseName, enumMemberOf, isOwnedType } from "./lib/ports.mjs"

/** The `Inbox` port of `platform/inbox`. */
const isInboxType = (context, node) => isOwnedType(context, node, { name: "Inbox", capability: "inbox", tier: "platform" })

/** Whether a decorator is `@<anything>({ reason: <PublicReason.SignedWebhook> })`, judged by the type of the reason value. */
const isSignedWebhookDecorator = (context, decorator) => {
    const expression = decorator.expression
    if (expression.type !== "CallExpression") return false
    const options = expression.arguments[0]
    if (options?.type !== "ObjectExpression") return false
    const reason = options.properties.find((property) => property.type === "Property" && !property.computed && property.key.type === "Identifier" && property.key.name === "reason")
    if (!reason) return false
    const member = enumMemberOf(context, reason.value)
    return member?.enumName === "PublicReason" && member.member === "SignedWebhook"
}

/** A `return` statement, or a block that ends in one. */
const returns = (statement) =>
    statement?.type === "ReturnStatement"
    || (statement?.type === "BlockStatement" && statement.body.at(-1)?.type === "ReturnStatement")

/** Whether `test` is `!<expression>` or `<expression> === false` around `target` (the awaited claim, or the identifier holding it). */
const refusesOn = (test, target) => {
    if (test.type === "UnaryExpression" && test.operator === "!") return test.argument === target || (test.argument.type === "Identifier" && target.type === "Identifier" && test.argument.name === target.name)
    if (test.type === "BinaryExpression" && (test.operator === "===" || test.operator === "==")) {
        const [left, right] = [test.left, test.right]
        const isFalse = (node) => node.type === "Literal" && node.value === false
        return (left === target && isFalse(right)) || (right === target && isFalse(left))
    }
    return false
}

/** Where the awaited claim sits: the statement that tests it, or the declaration that stores it followed by that test. */
const returnsOnFalse = (awaited) => {
    const node = awaited
    const parent = node.parent
    if (parent.type === "UnaryExpression" || parent.type === "BinaryExpression") {
        const statement = parent.parent
        return statement.type === "IfStatement" && statement.test === parent && refusesOn(parent, node) && returns(statement.consequent)
    }
    if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
        const declaration = parent.parent
        const siblings = declaration.parent?.body
        if (!Array.isArray(siblings)) return false
        const next = siblings[siblings.indexOf(declaration) + 1]
        return next?.type === "IfStatement" && refusesOn(next.test, parent.id) && returns(next.consequent)
    }
    return false
}

/** The awaited expression that completes first in a body, ignoring nested functions; null when the body awaits nothing. */
const firstAwait = (body) => {
    let first = null
    walk(body, (node) => {
        if (node.type === "AwaitExpression" && (first === null || node.range[1] < first.range[1])) first = node
    }, { intoFunctions: false })
    return first
}

/** A delivery handler claims the event through the shared inbox before it acts. */
export const inboxDedupeRequired = {
    meta: {
        type: "problem",
        docs: { description: "A consumer and a `SignedWebhook` handler claim `(source, eventId)` on the `Inbox` port first and return early when it answers `false`." },
        schema: [],
        messages: {
            noClaim: "This {{kind}} handler's first awaited expression is not `claim(source, eventId)` on the `Inbox` port of `platform/inbox` (`@InjectInbox() private readonly inbox: Inbox`). A sender that gets no timely reply resends the same event: claim it before anything else so a repeat delivery is a no-op.",
            noEarlyReturn: "This {{kind}} handler claims the event but does not return when the claim answers `false`. Write `if (!(await this.inbox.claim(source, eventId))) return` (or store the answer and return on `!fresh` straight after), so a repeat does none of the work again.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        const consumerFile = hfs.slotOf(filename) === "be.transport.message" && baseName(filename).endsWith(".consumer.ts")
        const judged = new Set()
        return {
            MethodDefinition(node) {
                if (node.kind !== "method" || node.static || node.key.type === "PrivateIdentifier" || !node.value.body) return
                if (node.accessibility === "private" || node.accessibility === "protected") return
                const klass = node.parent.parent
                const webhook = [...(node.decorators ?? []), ...(klass.decorators ?? [])].some((decorator) => isSignedWebhookDecorator(context, decorator))
                if (!consumerFile && !webhook) return
                if (judged.has(node)) return
                judged.add(node)
                const kind = webhook ? "SignedWebhook" : "consumer"
                const awaited = firstAwait(node.value.body)
                const call = awaited?.argument
                const claims = call?.type === "CallExpression"
                    && call.callee.type === "MemberExpression"
                    && !call.callee.computed
                    && call.callee.property.type === "Identifier"
                    && call.callee.property.name === "claim"
                    && call.arguments.length === 2
                    && isInboxType(context, call.callee.object)
                if (!claims) context.report({ node: node.key, messageId: "noClaim", data: { kind } })
                else if (!returnsOnFalse(awaited)) context.report({ node: node.key, messageId: "noEarlyReturn", data: { kind } })
            },
        }
    },
}

/** The rule this law contributes to the plugin. */
export const rules = {
    "inbox-dedupe-required": inboxDedupeRequired,
}

/** Starts at error: a duplicate charge or a duplicate side effect is never a warning. */
export const recommended = {
    "starci-be/inbox-dedupe-required": "error",
}
