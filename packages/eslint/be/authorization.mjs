/**
 * The rule that holds the guard half of HFS default-deny (catalog R41 `BE_DEFAULT_DENY`, law `authorization`).
 *
 * Authentication and authorization are the global `APP_GUARD` chain of the app (RateLimitGuard, OriginGuard, the `CredentialGuard` and the
 * `AuthGuard` of `domain/identity`, in that order), registered once and read by the architecture machine. A route therefore never picks
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

const GUARD_NAME = /Guard$/

/** The identifier a type reference or expression ends in, or undefined. */
const nameOf = (node) => {
    if (node === undefined || node === null) return undefined
    if (node.type === "Identifier") return node.name
    if (node.type === "TSQualifiedName") return node.right.name
    if (node.type === "MemberExpression" && !node.computed) return node.property.name
    return undefined
}

/** True when the class is a guard: it implements CanActivate or is named `...Guard`. */
const isGuardClass = (node) =>
    GUARD_NAME.test(node.id?.name ?? "") || (node.implements ?? []).some((item) => nameOf(item.expression) === "CanActivate")

/** True when the type mentions CanActivate or a `...Guard` class, directly or as `Type<...>` / a union member. */
const namesGuardType = (type) => {
    if (type === undefined || type === null) return false
    if (type.type === "TSTypeReference") {
        const name = nameOf(type.typeName)
        if (name === "CanActivate" || GUARD_NAME.test(name ?? "")) return true
        return (type.typeArguments ?? type.typeParameters)?.params?.some(namesGuardType) ?? false
    }
    if (type.type === "TSUnionType" || type.type === "TSIntersectionType") return type.types.some(namesGuardType)
    return false
}

const parameterOf = (parameter) => (parameter.type === "TSParameterProperty" ? parameter.parameter : parameter)

/** True when an `@Inject(SomeGuard)` style decorator names a guard class. */
const injectsGuardToken = (parameter) =>
    (parameter.decorators ?? []).some(
        (decorator) =>
            decorator.expression.type === "CallExpression" &&
            decorator.expression.arguments.some((argument) => GUARD_NAME.test(nameOf(argument) ?? "")),
    )

/** A guard never calls, extends or receives another guard: the app registers each one as its own APP_GUARD. */
export const noGuardInjectsGuard = {
    meta: {
        type: "problem",
        docs: { description: "A guard class has no constructor parameter that is another guard (no CanActivate-typed parameter)." },
        schema: [],
        messages: {
            guardInGuard:
                "A guard must not inject another guard (found a `{{name}}` constructor parameter). Each guard is its own global `APP_GUARD` in the fixed order RateLimitGuard, OriginGuard, CredentialGuard, AuthGuard; share logic through a service or a port, and let metadata (`@Credential`, `@Public`) select the behavior.",
        },
    },
    create(context) {
        const check = (node) => {
            if (!isGuardClass(node)) return
            const constructor = node.body.body.find((member) => member.type === "MethodDefinition" && member.kind === "constructor")
            for (const raw of constructor?.value.params ?? []) {
                const parameter = parameterOf(raw)
                const annotation = parameter.typeAnnotation?.typeAnnotation
                if (namesGuardType(annotation) || injectsGuardToken(raw) || injectsGuardToken(parameter)) {
                    context.report({ node: raw, messageId: "guardInGuard", data: { name: parameter.name ?? "guard" } })
                }
            }
        }
        return { ClassDeclaration: check, ClassExpression: check }
    },
}

/** Every rule this module ships, by the name a config switches it on under. */
export const rules = {
    "no-auth-use-guards": noAuthUseGuards,
    "no-guard-injects-guard": noGuardInjectsGuard,
}

/** The level a consuming repository switches this on at. */
export const recommended = {
    "starci-be/no-auth-use-guards": "error",
    "starci-be/no-guard-injects-guard": "error",
}
