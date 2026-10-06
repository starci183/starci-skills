/**
 * The rule that holds the cookie half of the back-end transport law (catalog R141 `BE_COOKIE_ATTRIBUTES`).
 *
 * No back-end door writes a cookie under the canon today (the session travels as a bearer or as the front end's own httpOnly
 * cookie), so this law is built ahead of the first one: a cookie a door writes through the response of Express or Fastify
 * states `httpOnly: true`, carries `secure` and has `sameSite` `lax` or `strict`, judged on the TYPE of its options (a spread
 * `as const` constant keeps its literals), and a `Set-Cookie` header is never written by hand, because a hand-written header
 * states none of the three. The call is recognised by where its signature is declared (the `express` or `fastify` family of
 * packages), never by the name of the receiver.
 */
import ts from "typescript"
import { moduleOf, typed } from "./lib/types.mjs"

/** The packages whose response types declare the cookie writers: Express with its typings, and Fastify with its cookie plugin. */
const RESPONSE_PACKAGES = new Set([
    "express",
    "express-serve-static-core",
    "@types/express",
    "@types/express-serve-static-core",
    "fastify",
    "@fastify/cookie",
])

/** The response methods that write a cookie by name, value and options, and the ones that write a header by name. */
const COOKIE_WRITERS = new Set(["cookie", "setCookie"])
const HEADER_WRITERS = new Set(["setHeader", "append", "header", "set", "appendHeader"])
const SAME_SITE = new Set(["lax", "strict"])

/** The declaration a call resolves to, when it is a method of a response type of the express or fastify family; else null. */
const responseMethodOf = (checker, toTs, call) => {
    const tsCall = toTs(call)
    const declaration = tsCall ? checker.getResolvedSignature(tsCall)?.declaration : undefined
    if (!declaration || !(ts.isMethodSignature(declaration) || ts.isMethodDeclaration(declaration)) || !declaration.name) return null
    const file = String(declaration.getSourceFile().fileName).replaceAll("\\", "/")
    const pkg = moduleOf(declaration, file)
    return pkg !== null && RESPONSE_PACKAGES.has(pkg) ? declaration.name.getText() : null
}

/** The present (non-nullish) members of a property's type on an options type, or [] when the property is absent or only nullish. */
const presentParts = (checker, type, name, at) => {
    const symbol = type.getProperty(name)
    if (!symbol) return []
    const propertyType = checker.getTypeOfSymbolAtLocation(symbol, at)
    const parts = propertyType.isUnion() ? propertyType.types : [propertyType]
    return parts.filter((part) => !(part.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)))
}

const isBooleanLiteral = (part, value) => Boolean(part.flags & ts.TypeFlags.BooleanLiteral) && part.intrinsicName === String(value)

/** The attributes a written cookie is missing, judged on the type of its options. */
const missingAttributes = (checker, type, at) => {
    const missing = []
    const httpOnly = presentParts(checker, type, "httpOnly", at)
    if (httpOnly.length === 0 || !httpOnly.every((part) => isBooleanLiteral(part, true))) missing.push("`httpOnly: true`")
    const secure = presentParts(checker, type, "secure", at)
    if (secure.length === 0 || !secure.every((part) => isBooleanLiteral(part, true))) missing.push("`secure: true`")
    const sameSite = presentParts(checker, type, "sameSite", at)
    if (sameSite.length === 0 || !sameSite.every((part) => part.isStringLiteral() && SAME_SITE.has(part.value))) missing.push('`sameSite: "lax"` or `"strict"`')
    return missing
}

/** A cookie a door writes states httpOnly, secure and sameSite, and no door writes `Set-Cookie` by hand. */
export const responseCookieAttributes = {
    meta: {
        type: "problem",
        docs: { description: "A cookie written through an Express or Fastify response states `httpOnly: true`, `secure: true` and `sameSite` `lax` or `strict`; `Set-Cookie` is never written as a header." },
        schema: [],
        messages: {
            attributes:
                "This cookie is written without {{missing}}. A cookie left to the defaults is readable by page script, travels over plain HTTP and is sent on cross-site requests: pass one options constant, declared `as const` by the owner of the cookie, that states `httpOnly: true`, `secure: true` and `sameSite` `lax` or `strict`.",
            raw: "`Set-Cookie` is written here as a header, which states none of `httpOnly`, `secure` and `sameSite`. Write the cookie through the response's `cookie(name, value, options)` with an options constant that states all three.",
        },
    },
    create(context) {
        const { checker, toTs } = typed(context)
        return {
            CallExpression(node) {
                if (node.callee.type !== "MemberExpression") return
                const method = responseMethodOf(checker, toTs, node)
                if (method === null) return
                if (COOKIE_WRITERS.has(method)) {
                    const options = node.arguments[2]
                    const tsOptions = options ? toTs(options) : undefined
                    const missing = tsOptions ? missingAttributes(checker, checker.getTypeAtLocation(tsOptions), tsOptions) : ["`httpOnly: true`", "`secure: true`", '`sameSite: "lax"` or `"strict"`']
                    if (missing.length > 0) context.report({ node, messageId: "attributes", data: { missing: missing.join(", ") } })
                    return
                }
                if (!HEADER_WRITERS.has(method)) return
                const name = node.arguments[0]
                const tsName = name ? toTs(name) : undefined
                const type = tsName ? checker.getTypeAtLocation(tsName) : undefined
                if (type?.isStringLiteral() && type.value.toLowerCase() === "set-cookie") context.report({ node, messageId: "raw" })
            },
        }
    },
}

/** Every rule this module ships, by the name a config switches it on under. */
export const rules = {
    "response-cookie-attributes": responseCookieAttributes,
}

/** The level a consuming repository switches this on at. */
export const recommended = {
    "starci-be/response-cookie-attributes": "error",
}
