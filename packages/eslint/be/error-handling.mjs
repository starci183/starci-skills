/**
 * The rules that hold HFS errors and their handling (catalog R38 `BE_ERROR_HOME`, R40 `BE_LOGGER_REQUIRED`).
 *
 * TWO RULES, ONE HABIT: a failure is either named where its owner lives, or it is visible.
 *
 *   - `catch-must-account` refuses a `catch` (and a promise `.catch`) that swallows. A handler passes when it
 *     rethrows, when it logs through a logger port, or when it returns an outcome that carries the caught
 *     error as its `cause`. An empty handler, and one that returns `null` or `false` and moves on, turns a
 *     real failure into "nothing happened" - the payment error that became `unavailable` with no trace.
 *   - `error-home` keeps every error where its semantic owner is. A class deriving from `DomainError` lives in
 *     `<capability>/errors/`; the retired `exceptions/` capability, the retired `AbstractException` base, a bare
 *     `throw new Error(...)`, a framework `HttpException`, and a domain that throws a platform error are all
 *     refused. Expected business results are typed unions, not exceptions, and are outside this rule.
 *
 * This file replaces the Academy `AbstractException` laws: those rules pinned a central exception family that
 * HFS no longer has, and a rule that survives its standard as "off" is a rule nobody can trust.
 */
import { some, walk } from "./lib/ast.mjs"
import { isDeclarationFile, isTestLane, normalizePath } from "./lib/path.mjs"

const LOG_METHODS = new Set(["error", "warn", "info", "debug", "log", "fatal", "verbose", "trace"])

/** The object a member call is made on, as the last identifier of its chain (`this.logger.error` gives `logger`). */
const receiverName = (callee) => {
    const object = callee.object
    if (object.type === "Identifier") return object.name
    if (object.type === "MemberExpression" && !object.computed && object.property.type === "Identifier") return object.property.name
    return null
}

/** `logger.error(...)`, `this.log.warn(...)`: a call on a logger port. `console` is never one. */
const isLoggerCall = (node) => {
    if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression" || node.callee.computed) return false
    if (node.callee.property.type !== "Identifier" || !LOG_METHODS.has(node.callee.property.name)) return false
    const receiver = receiverName(node.callee)
    return receiver !== null && receiver !== "console" && /log/i.test(receiver)
}

/** True when `name` is used as a value in `node` (not just as the object of `name.message`). */
const carriesCaught = (node, name) => {
    if (!name) return false
    let carried = false
    walk(node, (child) => {
        if (child.type !== "Identifier" || child.name !== name) return
        const parent = child.parent
        if (parent?.type === "MemberExpression" && parent.object === child) return
        carried = true
    })
    return carried
}

/**
 * Whether a handler block accounts for the failure.
 *
 * @param {object} body - The block of the handler.
 * @param {string | null} param - The caught error's name, when the handler names it.
 * @returns {boolean} True when it rethrows, logs, or returns an outcome carrying the error.
 */
const accounts = (body, param) =>
    some(
        body,
        (node) =>
            node.type === "ThrowStatement" ||
            isLoggerCall(node) ||
            (node.type === "ReturnStatement" && node.argument !== null && carriesCaught(node.argument, param)),
        { intoFunctions: false },
    )

const paramName = (fn) => (fn.params?.[0]?.type === "Identifier" ? fn.params[0].name : null)

/** Every failure is rethrown, logged, or returned as an outcome carrying its cause. */
export const catchMustAccount = {
    meta: {
        type: "problem",
        docs: { description: "A catch rethrows, logs through a logger port, or returns an outcome that carries the cause." },
        schema: [],
        messages: {
            empty: "This `catch` is empty, so the failure vanishes. Rethrow it, log it through the logger port, or return a typed outcome carrying it as `cause`.",
            swallowed:
                "This `catch` neither rethrows, logs, nor returns an outcome carrying the caught error, so the failure leaves no trace. Rethrow it, log it through the logger port, or return a typed outcome with `cause`.",
        },
    },
    create(context) {
        const checkBlock = (reportNode, body, param) => {
            if (body.body.length === 0) context.report({ node: reportNode, messageId: "empty" })
            else if (!accounts(body, param)) context.report({ node: reportNode, messageId: "swallowed" })
        }
        return {
            CatchClause(node) {
                checkBlock(node, node.body, node.param?.type === "Identifier" ? node.param.name : null)
            },
            CallExpression(node) {
                if (node.callee.type !== "MemberExpression" || node.callee.computed) return
                if (node.callee.property.type !== "Identifier" || node.callee.property.name !== "catch") return
                const handler = node.arguments[0]
                if (!handler || (handler.type !== "ArrowFunctionExpression" && handler.type !== "FunctionExpression")) return
                if (handler.body.type === "BlockStatement") {
                    checkBlock(handler, handler.body, paramName(handler))
                } else if (!isLoggerCall(handler.body) && !carriesCaught(handler.body, paramName(handler))) {
                    context.report({ node: handler, messageId: "swallowed" })
                }
            },
        }
    },
}

/** The framework exceptions that carry an HTTP status and no identity. */
const FRAMEWORK_EXCEPTIONS = new Set([
    "BadRequestException",
    "NotFoundException",
    "UnauthorizedException",
    "ForbiddenException",
    "InternalServerErrorException",
    "HttpException",
    "ConflictException",
    "NotAcceptableException",
    "RequestTimeoutException",
    "GoneException",
    "PayloadTooLargeException",
    "UnsupportedMediaTypeException",
    "UnprocessableEntityException",
    "NotImplementedException",
    "BadGatewayException",
    "ServiceUnavailableException",
    "GatewayTimeoutException",
])

const BUILTIN_ERRORS = new Set(["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "EvalError", "URIError"])

/** `<capability>/errors/` under a module tier or a feature, or the platform `errors` capability itself. */
const ERRORS_HOME =
    /\/src\/(?:modules\/(?:domain|platform|integrations)\/[^/]+|features\/[^/]+)\/(?:[^/]+\/)*errors\/|\/src\/modules\/platform\/errors\//
const PLATFORM_ERRORS = /\/src\/modules\/platform\/errors\//
const RETIRED_HOME = /\/src\/modules\/(?:domain|platform|integrations)\/exceptions\//
const DOMAIN_TIER = /\/src\/modules\/domain\//
const HEALTH_PROBE = /\/health(?:z)?\.controller\.ts$|\/health\//

/** An error class is declared at its owner, extends `DomainError`, and is never a bare or framework throw. */
export const errorHome = {
    meta: {
        type: "problem",
        docs: { description: "Errors live in `<capability>/errors/`, extend DomainError, and no bare or framework error escapes." },
        schema: [],
        messages: {
            place: "`{{name}}` is an error of this capability but is declared outside its `errors/` folder. Move it to the `errors/` folder of the capability that owns its meaning.",
            retiredHome: "This file sits in a retired `exceptions/` capability. Errors belong to the capability that owns their meaning, in its `errors/` folder.",
            retiredBase: "`{{name}}` extends `AbstractException`, the retired central base. Extend `DomainError` from `platform/errors` and keep the class in its capability's `errors/`.",
            mustExtendDomainError: "`{{name}}` extends the built-in `{{parent}}`. Extend `DomainError` so the error carries a stable `code` and a `cause`.",
            bareError: "`throw new Error(...)` carries a sentence and no code, so nothing downstream can group or map it. Throw a `DomainError` subclass of the owning capability.",
            framework: "`throw new {{name}}(...)` carries an HTTP status and no identity. Throw a `DomainError` subclass and let the transport map its code to a status.",
            platformThrown: "A domain capability throws `{{name}}`, a platform error. Translate it into an error of this capability so platform details do not cross the boundary.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const listeners = {}
        if (RETIRED_HOME.test(filename)) {
            listeners.Program = (node) => context.report({ node, messageId: "retiredHome" })
        }
        if (isTestLane(filename)) return listeners
        const inHome = ERRORS_HOME.test(filename)
        const platformImports = new Set()
        listeners.ImportDeclaration = (node) => {
            if (typeof node.source.value !== "string" || !/(?:^|\/)platform\//.test(node.source.value)) return
            for (const specifier of node.specifiers) platformImports.add(specifier.local.name)
        }
        listeners.ClassDeclaration = (node) => {
            const parent = node.superClass
            if (!node.id || !parent || parent.type !== "Identifier") return
            if (parent.name === "AbstractException") {
                context.report({ node: parent, messageId: "retiredBase", data: { name: node.id.name } })
            } else if (BUILTIN_ERRORS.has(parent.name)) {
                if (!PLATFORM_ERRORS.test(filename)) {
                    context.report({ node: parent, messageId: "mustExtendDomainError", data: { name: node.id.name, parent: parent.name } })
                }
            } else if (/Error$/.test(parent.name) && !inHome) {
                context.report({ node: node.id, messageId: "place", data: { name: node.id.name } })
            }
        }
        listeners.ThrowStatement = (node) => {
            const thrown = node.argument
            if (!thrown || thrown.type !== "NewExpression" || thrown.callee.type !== "Identifier") return
            const name = thrown.callee.name
            if (name === "Error") {
                context.report({ node: thrown, messageId: "bareError" })
            } else if (FRAMEWORK_EXCEPTIONS.has(name) && !HEALTH_PROBE.test(filename)) {
                context.report({ node: thrown, messageId: "framework", data: { name } })
            } else if (DOMAIN_TIER.test(filename) && name !== "DomainError" && /Error$/.test(name) && platformImports.has(name)) {
                context.report({ node: thrown, messageId: "platformThrown", data: { name } })
            }
        }
        return listeners
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "catch-must-account": catchMustAccount,
    "error-home": errorHome,
}

/** Both start at error: HFS has no baseline, and the migration lanes clear the debt before a repository adopts them. */
export const recommended = {
    "starci-be/catch-must-account": "error",
    "starci-be/error-home": "error",
}
