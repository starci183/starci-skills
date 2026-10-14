/**
 * The rules that hold the transport half of HFS default-deny (catalog R41 `BE_DEFAULT_DENY`).
 *
 * Every route needs a signed-in principal unless it says otherwise, and every body has a type:
 *
 *   - `no-untyped-body` refuses a `@Body()` (or `@Args()`) parameter with no type, `unknown`, `any`, `object`,
 *     `{}` or `Record<string, unknown>`; it refuses `GraphQLJSON` as a tunnel around the schema; and it refuses
 *     a `switch (input.operation)` in a transport file, because each operation is its own typed operation.
 *   - `public-needs-reason` refuses `@Public()` without `{ reason: PublicReason.X }`, where `PublicReason` is the enum
 *     `domain/identity` exports (judged by the enum's declaring owner, type-aware). An open door states why it is open
 *     from a closed list, so the open doors can be read and reviewed; a string or another enum is refused.
 *   - `public-reason-closed` holds `PublicReason` to Health, AuthHandshake, SignedWebhook and CatalogRead.
 *     API-key and tool-token doors authenticate through their own guard instead of extending this enum.
 *
 * The `APP_GUARD` registration and the app-level guard live in the composition check, not here: a rule reading
 * one file cannot see which module the app registered.
 */
import { isTransportSlot } from "./lib/transport-slots.mjs"
import { decoratorName, keyName } from "./lib/ast.mjs"
import { isOwnedBy, isOwnedEnumMember, isOwnedType, partsOf, typeOf } from "./lib/declared.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { isDeclarationFile, normalizePath } from "./lib/path.mjs"
import { typed } from "./lib/types.mjs"

const BODY_DECORATORS = new Set(["Body", "Args"])
const PUBLIC_REASONS = new Set(["Health", "AuthHandshake", "SignedWebhook", "CatalogRead"])
const REASON_WRAPPERS = new Set(["TSAsExpression", "TSTypeAssertion", "TSNonNullExpression", "TSSatisfiesExpression"])

/** The reason expression supplied to a public decorator, or null when it supplies none. */
const publicReasonOf = (node) => {
    const expression = node.expression
    const argument = expression.type === "CallExpression" ? expression.arguments[0] : undefined
    if (argument?.type !== "ObjectExpression") return null
    const property = argument.properties.find((item) => item.type === "Property" && !item.computed && keyName(item.key) === "reason")
    return property ? property.value : null
}

/** A static member name; a computed identifier is an expression rather than the member's name. */
const staticMemberName = (node) => {
    if (node.computed && node.property.type !== "Literal") return null
    return keyName(node.property)
}

/** All declared names of the enum, including TypeScript's merged declarations. */
const publicReasonNames = (context, node) => {
    const { checker, toTs } = typed(context)
    const declaration = toTs(node)
    const symbol = checker.getSymbolAtLocation(declaration.name)
    const members = (symbol?.declarations ?? []).flatMap((part) => part.members ?? [])
    return new Set(members.map((member) => member.name.text))
}

/** Reject added enum members even when the expression is an alias or a union of reasons. */
const hasAddedPublicReason = (context, reason) => {
    let value = reason
    while (REASON_WRAPPERS.has(value.type)) value = value.expression
    // A stale or not-yet-declared member has an error type, but its enum receiver still has an owner.
    if (value.type === "MemberExpression" && isOwnedType(context, value.object, "PublicReason", "domain", "identity")) {
        const name = staticMemberName(value)
        if (name !== null && !PUBLIC_REASONS.has(name)) return true
    }
    if (isOwnedEnumMember(context, reason, "PublicReason", "domain", "identity")) {
        return partsOf(typeOf(context, reason)).some((part) => !PUBLIC_REASONS.has(part.getSymbol()?.name))
    }
    return false
}

const isUntyped = (annotation) => {
    if (!annotation) return true
    const type = annotation.typeAnnotation
    if (!type) return true
    if (["TSUnknownKeyword", "TSAnyKeyword", "TSObjectKeyword"].includes(type.type)) return true
    if (type.type === "TSTypeLiteral" && type.members.length === 0) return true
    if (type.type === "TSTypeReference" && type.typeName.type === "Identifier" && type.typeName.name === "Record") {
        const value = type.typeArguments?.params?.[1] ?? type.typeParameters?.params?.[1]
        return value?.type === "TSUnknownKeyword" || value?.type === "TSAnyKeyword"
    }
    return false
}

/** A body or argument carries a declared type, never `unknown`, `any` or GraphQLJSON. */
export const noUntypedBody = {
    meta: {
        type: "problem",
        docs: { description: "`@Body()` and `@Args()` parameters are typed; no GraphQLJSON tunnel; no `switch (input.operation)`." },
        schema: [],
        messages: {
            untyped: "This `@{{decorator}}()` parameter has no useful type. Declare a DTO class or contract type so the framework validates the input.",
            json: "`GraphQLJSON` tunnels untyped data through the schema. Declare an input type with the fields the operation needs.",
            operationSwitch: "`switch` on an `operation` field dispatches several operations through one untyped door. Make each operation its own typed resolver or controller method.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const slot = hfsOf(context).slotOf(filename) ?? ""
        const inTransport = isTransportSlot(slot) || slot.startsWith("be.feature.transport.")
        return {
            Identifier(node) {
                if (node.name === "GraphQLJSON" && !/^Import.*Specifier$/.test(node.parent?.type ?? "")) {
                    context.report({ node, messageId: "json" })
                }
            },
            SwitchStatement(node) {
                const discriminant = node.discriminant
                if (inTransport && discriminant.type === "MemberExpression" && keyName(discriminant.property) === "operation") {
                    context.report({ node, messageId: "operationSwitch" })
                }
            },
            Decorator(node) {
                const name = decoratorName(node)
                if (!BODY_DECORATORS.has(name)) return
                const parameter = node.parent
                if (!parameter) return
                const bound = parameter.type === "TSParameterProperty" ? parameter.parameter : parameter
                if (bound.type !== "Identifier" && bound.type !== "ObjectPattern" && bound.type !== "AssignmentPattern") return
                const annotated = bound.type === "AssignmentPattern" ? bound.left : bound
                if (isUntyped(annotated.typeAnnotation)) {
                    context.report({ node, messageId: "untyped", data: { decorator: name } })
                }
            },
        }
    },
}

/** An open door states why it is open, from the closed `PublicReason` list of `domain/identity`. */
export const publicNeedsReason = {
    meta: {
        type: "problem",
        docs: { description: "`@Public()` carries `{ reason: PublicReason.X }` with `PublicReason` from `domain/identity`." },
        schema: [],
        messages: {
            reason: "`@Public()` needs `{ reason: PublicReason.X }` with a member of the `PublicReason` enum exported by `domain/identity`; a string, another enum or a missing reason is refused. A new reason is a change to the canon, not to this file.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        return {
            Decorator(node) {
                if (decoratorName(node) !== "Public") return
                const reason = publicReasonOf(node)
                if (reason === null || !isOwnedEnumMember(context, reason, "PublicReason", "domain", "identity")) context.report({ node, messageId: "reason" })
            },
        }
    },
}

/** The identity enum and each public door use exactly the canon's four reasons. */
export const publicReasonClosed = {
    meta: {
        type: "problem",
        docs: { description: "`PublicReason` is closed to Health, AuthHandshake, SignedWebhook and CatalogRead in both editions." },
        schema: [],
        messages: {
            closed: "BE_PUBLIC_REASON_CLOSED: `PublicReason` has exactly Health, AuthHandshake, SignedWebhook and CatalogRead. An API-key or tool-token route authenticates with its own guard; do not add a public reason.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const inIdentity = isOwnedBy(hfsOf(context), filename, "domain", "identity")
        return {
            TSEnumDeclaration(node) {
                if (!inIdentity || node.id.name !== "PublicReason") return
                const names = publicReasonNames(context, node)
                if (names.size !== PUBLIC_REASONS.size || [...PUBLIC_REASONS].some((name) => !names.has(name))) {
                    context.report({ node, messageId: "closed" })
                }
            },
            Decorator(node) {
                if (decoratorName(node) !== "Public") return
                const reason = publicReasonOf(node)
                if (reason !== null && hasAddedPublicReason(context, reason)) context.report({ node, messageId: "closed" })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "no-untyped-body": noUntypedBody,
    "public-needs-reason": publicNeedsReason,
    "public-reason-closed": publicReasonClosed,
}

/** Every rule starts at error: public doors and typed inputs hold the default-deny boundary. */
export const recommended = {
    "starci-be/no-untyped-body": "error",
    "starci-be/public-needs-reason": "error",
    "starci-be/public-reason-closed": "error",
}
