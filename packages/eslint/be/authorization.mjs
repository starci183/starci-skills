/**
 * The rule that holds the guard half of HFS default-deny (catalog R41 `BE_DEFAULT_DENY`, law `authorization`).
 *
 * Authentication and authorization are the global `APP_GUARD` chain of the app (throttler, CSRF origin guard, then the
 * `AuthGuard` of `domain/identity`), registered once and read by the architecture machine. A route therefore never picks
 * its own guard: `@UseGuards(...)` has no legitimate use in product code, and a door that names a guard is a door that
 * can also forget one. `@Public({ reason: PublicReason.X })` is the only way to open a door.
 *
 * This rule replaces `identity-needs-guard`, which asked a door that read the caller's identity to carry a guard: with
 * default-deny the guard is global, so there is nothing left for the door to carry.
 */
import { importsFrom } from "./lib/declared.mjs"

/** True when the decorator expression names `UseGuards`, however it was imported. */
const isUseGuards = (decorator, aliases) => {
    const expression = decorator.expression.type === "CallExpression" ? decorator.expression.callee : decorator.expression
    if (expression.type === "Identifier") return expression.name === "UseGuards" || aliases.get(expression.name) === "UseGuards"
    if (expression.type === "MemberExpression" && !expression.computed && expression.property.type === "Identifier") {
        return expression.property.name === "UseGuards" && expression.object.type === "Identifier" && aliases.get(expression.object.name) === "*"
    }
    return false
}

/** No route picks its own guard: the global APP_GUARD chain decides. */
export const noAuthUseGuards = {
    meta: {
        type: "problem",
        docs: { description: "`@UseGuards(...)` is not used: authentication and authorization are the global APP_GUARD chain." },
        schema: [],
        messages: {
            useGuards:
                "`@UseGuards(...)` picks a guard per door, so a door can forget it. Authentication and authorization are the global `APP_GUARD` chain of the app; delete this decorator, and open a door only with `@Public({ reason: PublicReason.X })`.",
        },
    },
    create(context) {
        let aliases = new Map()
        return {
            Program(node) {
                aliases = importsFrom(node, () => true)
            },
            Decorator(node) {
                if (isUseGuards(node, aliases)) context.report({ node, messageId: "useGuards" })
            },
        }
    },
}

/** Every rule this module ships, by the name a config switches it on under. */
export const rules = {
    "no-auth-use-guards": noAuthUseGuards,
}

/** The level a consuming repository switches this on at. */
export const recommended = {
    "starci-be/no-auth-use-guards": "error",
}
