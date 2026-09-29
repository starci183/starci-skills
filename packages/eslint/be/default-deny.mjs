/**
 * The rules that hold the transport half of HFS v2 default-deny (catalog R41 `BE_DEFAULT_DENY`).
 *
 * Every route needs a signed-in principal unless it says otherwise, and every body has a type:
 *
 *   - `no-untyped-body` refuses a `@Body()` (or `@Args()`) parameter with no type, `unknown`, `any`, `object`,
 *     `{}` or `Record<string, unknown>`; it refuses `GraphQLJSON` as a tunnel around the schema; and it refuses
 *     a `switch (input.operation)` in a transport file, because each operation is its own typed operation.
 *   - `public-needs-reason` refuses `@Public()` without `{ reason: "<why>" }`. An open door states why it is
 *     open, so the list of open doors can be read and reviewed.
 *
 * The `APP_GUARD` registration and the app-level guard live in the composition check, not here: a rule reading
 * one file cannot see which module the app registered.
 */
import { decoratorName, keyName, staticText } from "./lib/ast.mjs"
import { isDeclarationFile, normalizePath } from "./lib/path.mjs"

const BODY_DECORATORS = new Set(["Body", "Args"])

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
        const inTransport = filename.includes("/transport/")
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

/** An open door states why it is open. */
export const publicNeedsReason = {
    meta: {
        type: "problem",
        docs: { description: "`@Public()` carries `{ reason: \"<why>\" }`." },
        schema: [],
        messages: {
            reason: "`@Public()` has no reason. Write `@Public({ reason: \"<why this operation is open>\" })` so the open doors can be reviewed.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        return {
            Decorator(node) {
                if (decoratorName(node) !== "Public") return
                const expression = node.expression
                const argument = expression.type === "CallExpression" ? expression.arguments[0] : undefined
                let reason = null
                if (argument?.type === "ObjectExpression") {
                    const property = argument.properties.find((item) => item.type === "Property" && keyName(item.key) === "reason")
                    reason = property ? staticText(property.value) : null
                }
                if (reason === null || reason.trim() === "") context.report({ node, messageId: "reason" })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "no-untyped-body": noUntypedBody,
    "public-needs-reason": publicNeedsReason,
}

/** Both start at error: an untyped door and an unexplained open door are the failures this law exists for. */
export const recommended = {
    "starci-be/no-untyped-body": "error",
    "starci-be/public-needs-reason": "error",
}
