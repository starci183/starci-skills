/** R261: every API entrypoint declares its browser and proxy boundary. */
import { keyName, staticText, walk } from "./lib/ast.mjs"
import { hfsOf } from "./lib/hfs.mjs"

const unwrap = (node) => {
    while (node && ["TSAsExpression", "TSTypeAssertion", "TSSatisfiesExpression", "TSNonNullExpression", "AwaitExpression", "ChainExpression"].includes(node.type)) node = node.expression ?? node.argument
    return node
}
const property = (node, name, constants = new Map(), seen = new Set()) => {
    if (node?.type !== "ObjectExpression") return undefined
    for (const entry of [...node.properties].reverse()) {
        if (entry.type === "SpreadElement") {
            const spread = resolve(entry.argument, constants, seen)
            if (spread?.type !== "ObjectExpression") return undefined
            const value = property(spread, name, constants, seen)
            if (value !== undefined) return value
        } else {
            const key = entry.computed ? staticText(entry.key) : keyName(entry.key)
            if (key === null) return undefined
            if (key === name) return entry.value
        }
    }
    return undefined
}
const method = (node) => node?.type === "MemberExpression" ? (node.computed ? staticText(node.property) : keyName(node.property)) : null

/** Only declared API entrypoints are judged; workers have no browser edge. */
const isApiMain = (context) => {
    const hfs = hfsOf(context)
    const file = hfs.relative(context.filename ?? context.getFilename())
    return hfs.slotOf(context.filename ?? context.getFilename()) === "be.app.api"
        && hfs.apps.some((app) => app.kind === "api" && file === `apps/${app.name}/src/main.ts`)
}

/** Resolve local constants without making an identifier's spelling a security proof. */
const resolve = (node, constants, seen = new Set()) => {
    node = unwrap(node)
    if (node?.type === "Identifier" && constants.has(node.name) && !seen.has(node.name)) return resolve(constants.get(node.name), constants, new Set([...seen, node.name]))
    if (node?.type === "MemberExpression" && method(node) !== null) {
        const value = property(resolve(node.object, constants, seen), method(node), constants, seen)
        if (value !== undefined) return resolve(value, constants, seen)
    }
    return node
}

const allowedOrigin = (node) => {
    const value = staticText(node)
    if (value === null || value.includes("*") || value.endsWith("/")) return false
    try {
        const url = new URL(value)
        return value === url.origin && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    } catch { return false }
}

/** Config owns a dynamic allowlist; literal lists must contain exact origins. */
const allowlist = (node, constants) => {
    node = resolve(node, constants)
    if (node?.type === "MemberExpression") return method(node) === "allowedOrigins"
    if (node?.type !== "ArrayExpression" || node.elements.length === 0) return false
    return node.elements.every((entry) => entry?.type === "SpreadElement"
        ? allowlist(entry.argument, constants)
        : allowedOrigin(resolve(entry, constants)))
}

const hopCount = (node, constants) => {
    node = resolve(node, constants)
    return node?.type === "Literal" && Number.isSafeInteger(node.value) && node.value >= 0
}

const audit = (program) => {
    const constants = new Map()
    const helpers = new Set()
    const middleware = new Set()
    const factories = new Set()
    const applications = new Set()
    const calls = []
    walk(program, (node) => {
        if (node.type === "ImportDeclaration") {
            if (node.source.value === "@nestjs/core") {
                for (const specifier of node.specifiers) if (specifier.imported?.name === "NestFactory") factories.add(specifier.local.name)
            }
            if (/^@modules\/platform\/http-security(?:\/|$)/.test(node.source.value)) {
                for (const specifier of node.specifiers) {
                    if (["applyHttpSecurity", "configureHttpSecurity"].includes(specifier.imported?.name)) helpers.add(specifier.local.name)
                    if (["securityHeaders", "createSecurityHeadersMiddleware"].includes(specifier.imported?.name)) middleware.add(specifier.local.name)
                }
            }
        }
        if (node.type === "VariableDeclarator" && node.id.type === "Identifier" && node.init) constants.set(node.id.name, node.init)
        if (node.type === "CallExpression") calls.push(node)
    })
    for (const [name, initializer] of constants) {
        const node = resolve(initializer, constants)
        if (node?.type === "CallExpression" && method(node.callee) === "create" && factories.has(node.callee.object.name)) applications.add(name)
    }
    const isApplication = (node) => {
        if (node?.type === "Identifier" && applications.has(node.name)) return true
        node = resolve(node, constants)
        if (node?.type !== "CallExpression") return false
        if (method(node.callee) === "create" && factories.has(node.callee.object.name)) return true
        return ["getInstance", "getHttpAdapter"].includes(method(node.callee)) && isApplication(node.callee.object)
    }
    const direct = calls.filter((call) => call.callee.type === "MemberExpression" && isApplication(call.callee.object))
    const applied = calls.filter((call) => call.callee.type === "Identifier" && helpers.has(call.callee.name) && isApplication(call.arguments[0]))
    const helperCors = applied.some((call) => {
        const config = resolve(call.arguments[1], constants)
        return config?.type === "MemberExpression" || allowlist(property(config, "allowedOrigins", constants), constants)
    })
    const corsCalls = direct.filter((call) => method(call.callee) === "enableCors")
    const cors = (helperCors || corsCalls.length > 0) && corsCalls.every((call) => allowlist(property(resolve(call.arguments[0], constants), "origin", constants), constants))
    const headers = applied.length > 0 || direct.some((call) => method(call.callee) === "use" && call.arguments.some((argument) => {
        const candidate = resolve(argument, constants)
        return (candidate?.type === "Identifier" && middleware.has(candidate.name))
            || (candidate?.type === "CallExpression" && candidate.callee.type === "Identifier" && middleware.has(candidate.callee.name))
    }))
    const poweredCalls = direct.filter((call) => ["set", "enable", "disable"].includes(method(call.callee)) && staticText(call.arguments[0])?.toLowerCase() === "x-powered-by")
    const poweredOff = (applied.length > 0 || poweredCalls.some((call) => method(call.callee) === "disable" || (method(call.callee) === "set" && call.arguments[1]?.value === false)))
        && poweredCalls.every((call) => method(call.callee) === "disable" || (method(call.callee) === "set" && call.arguments[1]?.value === false))
    const proxyCalls = direct.filter((call) => method(call.callee) === "set" && staticText(call.arguments[0]) === "trust proxy")
    const proxy = (proxyCalls.length > 0 || applied.length > 0)
        && proxyCalls.every((call) => hopCount(call.arguments[1], constants))
        && applied.every((call) => hopCount(property(resolve(call.arguments[2], constants), "trustProxy", constants), constants))
    return { cors, headers: headers && poweredOff, proxy }
}

const edgeRule = (field, code, description) => ({
    meta: { type: "problem", docs: { description }, schema: [], messages: { boundary: `${code}: ${description}` } },
    create(context) {
        if (!isApiMain(context)) return {}
        return { "Program:exit"(node) { if (!audit(node)[field]) context.report({ node, messageId: "boundary" }) } }
    },
})

export const corsAllowlist = edgeRule("cors", "BE_CORS_ALLOWLIST", "Configure CORS with an explicit origin allowlist from http-security config; wildcard, open and missing origins are refused.")
export const securityHeaders = edgeRule("headers", "BE_SECURITY_HEADERS", "Apply the platform/http-security response middleware and disable x-powered-by.")
export const trustProxy = edgeRule("proxy", "BE_TRUST_PROXY", "Declare trust proxy as a nonnegative integer hop count; blanket trust and undeclared proxy trust are refused.")

export const rules = { "cors-allowlist": corsAllowlist, "security-headers": securityHeaders, "trust-proxy": trustProxy }
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-be/${name}`, "error"]))
