/**
 * The rule that holds inbox dedupe (catalog R80 `BE_INBOX_DEDUPE_MISSING`).
 *
 * A sender that gets no timely reply resends: a payment provider retries a webhook, a queue
 * redelivers a message it never saw acknowledged. The standard is one inbox table keyed by
 * `(source, event id)` in front of every door delivery can repeat through, so a repeat is a no-op
 * instead of a second charge, a second email or a second state transition.
 *
 *   - `inbox-dedupe-required` refuses a `@Public()` webhook controller method, or an outbox/queue
 *     consumer (`<event>.consumer.ts`, the `be.transport.message` slot), whose file shows no
 *     reference to an inbox or dedupe port.
 *
 * This reads one file's text for the shape of a claim (`inbox`, `dedupe`, `idempoten*` naming a
 * port, a field or a call) - it cannot see whether the call actually runs before the side effect,
 * which needs the call graph and stays a review question, same as `no-outer-manager-in-transaction`
 * says for its own undecidable half.
 */
import { decoratorName, keyName, staticText } from "./lib/ast.mjs"
import { isTestLane, normalizePath } from "./lib/path.mjs"

const INBOX_REFERENCE = /inbox|dedupe|idempoten/i
const CONSUMER_FILE = /\/transport\/message\/[^/]+\.consumer\.ts$/
const WEBHOOK_FILE = /\/transport\/http\/[^/]*webhook[^/]*\.controller\.ts$/i

/** The route or reason text a `@Public()` decorator's argument carries, lower-cased. */
const publicReason = (node) => {
    const expression = node.expression
    const argument = expression.type === "CallExpression" ? expression.arguments[0] : undefined
    if (argument?.type !== "ObjectExpression") return ""
    const property = argument.properties.find((item) => item.type === "Property" && keyName(item.key) === "reason")
    return (property ? staticText(property.value) : null)?.toLowerCase() ?? ""
}

/** A webhook door: the file is named for one, the open door names its reason, or the route itself does. */
const isWebhookController = (filename, sourceText, publicDecorators) =>
    WEBHOOK_FILE.test(filename)
    || publicDecorators.some((node) => /webhook/.test(publicReason(node)))
    || /@Controller\(\s*["'`][^"'`]*webhook/i.test(sourceText)

/** Delivery this instance can receive more than once shows a claim against the inbox before it acts. */
export const inboxDedupeRequired = {
    meta: {
        type: "problem",
        docs: { description: "A `@Public()` webhook handler and an outbox/queue consumer claim the event through the shared inbox before they act." },
        schema: [],
        messages: {
            webhook: "This webhook controller has no reference to an inbox or dedupe port. A sender that gets no timely reply resends the same event; claim `(source, event id)` in the shared inbox before acting, so a repeat delivery is a no-op.",
            consumer: "This consumer has no reference to an inbox or dedupe port. A queue redelivers a message it never saw acknowledged; claim `(source, event id)` in the shared inbox before acting, so a redelivery is a no-op.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isTestLane(filename)) return {}
        const isConsumer = CONSUMER_FILE.test(filename)
        const publicDecorators = []
        return {
            Decorator(node) {
                if (decoratorName(node) === "Public") publicDecorators.push(node)
            },
            "Program:exit"(node) {
                const sourceCode = context.sourceCode || context.getSourceCode()
                const text = sourceCode.getText()
                if (INBOX_REFERENCE.test(text)) return
                if (isConsumer) {
                    context.report({ node, messageId: "consumer" })
                    return
                }
                if (publicDecorators.length && isWebhookController(filename, text, publicDecorators)) {
                    context.report({ node, messageId: "webhook" })
                }
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
