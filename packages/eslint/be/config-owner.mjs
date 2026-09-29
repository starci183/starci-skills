/**
 * The rules that hold HFS configuration and secrets (catalog R43 `BE_CONFIG_OWNER`, R44 `BE_SECRET_DEFAULT`,
 * and the secret-comparison half of R41 `BE_DEFAULT_DENY`).
 *
 *   - `no-direct-env-read` keeps `process.env` inside `platform/config`. Everything else receives typed options
 *     from `<capability>.config.ts`; a `readEnvironment()` call inside a `useFactory` is the same read in
 *     disguise and is refused too.
 *   - `no-secret-default` refuses a literal default for a secret, password, token, key or URL: an `env.X ?? "..."`
 *     fallback, a property or variable of that name holding a non-empty string, a `.default("...")` on a
 *     schema of that name, and a path built from `process.cwd()` and `src` or `.starcistacks`. A missing value
 *     must stop the boot, naming the key.
 *   - `secret-compare-timing-safe` refuses `===` and `!==` on a secret-named identifier. A secret compares with
 *     `timingSafeEqual`, because the length of the matching prefix is a measurable side channel.
 *
 * Test lanes are outside the default and env rules: a spec arranges its own environment and fake credentials.
 * They are not outside the comparison rule.
 */
import { keyName, staticText, walk, wordsOf } from "./lib/ast.mjs"
import { isDeclarationFile, isTestLane, normalizePath } from "./lib/path.mjs"

const PLATFORM_CONFIG = /\/src\/modules\/platform\/config\//

/** `process.env` or `process["env"]`. */
const isProcessEnv = (node) =>
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "process" &&
    (node.computed ? node.property.type === "Literal" && node.property.value === "env" : keyName(node.property) === "env")

/** Only the platform config capability reads the process environment. */
export const noDirectEnvRead = {
    meta: {
        type: "problem",
        docs: { description: "`process.env` is read only inside `platform/config`." },
        schema: [],
        messages: {
            env: "`process.env` is read outside `platform/config`. Add the key to the capability's `<capability>.config.ts` (zod) and receive the value through its `<capability>.options.ts`.",
            factory: "`readEnvironment()` inside a `useFactory` reads the environment per module. `main.ts` reads it once and passes options through `AppModule.register`.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename) || isTestLane(filename) || PLATFORM_CONFIG.test(filename)) return {}
        return {
            MemberExpression(node) {
                if (isProcessEnv(node)) context.report({ node, messageId: "env" })
            },
            CallExpression(node) {
                if (node.callee.type !== "Identifier" || node.callee.name !== "readEnvironment") return
                for (let parent = node.parent; parent; parent = parent.parent) {
                    if (parent.type === "Property" && keyName(parent.key) === "useFactory") {
                        context.report({ node, messageId: "factory" })
                        return
                    }
                }
            },
        }
    },
}

const SECRET_WORDS = new Set(["password", "passwd", "passphrase", "secret", "token", "credential", "credentials", "apikey", "signature", "hmac"])
const KEY_PREFIXES = new Set(["api", "secret", "private", "access", "signing", "encryption", "master", "auth", "jwt", "session"])
const URL_WORDS = new Set(["url", "uri", "dsn", "endpoint"])
const NOT_A_VALUE_WORDS = new Set(["type", "kind", "length", "count", "ttl", "name", "prefix", "header", "scheme", "field", "path", "regex", "pattern"])

/** Whether a config name is a secret, or an infrastructure URL: `POSTGRES_PASSWORD`, `webhookSecret`, `redisUrl`. */
const configKind = (name) => {
    const words = wordsOf(name)
    const last = words.at(-1)
    if (!last || NOT_A_VALUE_WORDS.has(last)) return null
    if (SECRET_WORDS.has(last)) return "secret"
    if (last === "key" && words.length > 1 && KEY_PREFIXES.has(words.at(-2))) return "secret"
    if (URL_WORDS.has(last)) return "url"
    return null
}

/** The name an env read spells: `process.env.X`, `env.X`, `env["X"]`, `config.get("X")`. */
const envReadName = (node) => {
    if (node.type === "MemberExpression") {
        const object = node.object
        const isEnvObject = isProcessEnv(object) || (object.type === "Identifier" && /^env$/i.test(object.name))
        if (!isEnvObject) return null
        return node.computed ? staticText(node.property) : keyName(node.property)
    }
    if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && keyName(node.callee.property) === "get") {
        return staticText(node.arguments[0])
    }
    return null
}

const isNonEmptyText = (node) => {
    const text = staticText(node)
    return text !== null && text.trim() !== ""
}

/** An UPPER_SNAKE literal is the NAME of an environment key (`const API_KEY = "API_KEY"`), not a secret value. */
const isKeyName = (node, name) => {
    const text = staticText(node) ?? ""
    if (/^[A-Z][A-Z0-9_]*$/.test(text)) return true
    // `const MEDIA_SIGNING_SECRET_KEY = "mediaSigningSecret"`: a constant that names a lookup key holds the key's name
    return /^[A-Z][A-Z0-9_]*_KEY$/.test(name ?? "") && /^[a-z][A-Za-z0-9]*$/.test(text)
}

const hasScheme = (node) => /^[a-z][a-z0-9+.-]*:\/\//i.test(staticText(node) ?? "")

const targetName = (node) => {
    if (node.type === "Property" || node.type === "PropertyDefinition") return keyName(node.key)
    if (node.type === "VariableDeclarator" && node.id.type === "Identifier") return node.id.name
    if (node.type === "AssignmentPattern" && node.left.type === "Identifier") return node.left.name
    return null
}

/** No secret, password, token, key or URL config has a literal default; a missing value stops the boot. */
export const noSecretDefault = {
    meta: {
        type: "problem",
        docs: { description: "A secret or URL config value never has a literal default." },
        schema: [],
        messages: {
            fallback: "`{{name}}` falls back to a literal. A missing {{kind}} must stop the boot with an error naming `{{name}}`, not start the app with a value from source.",
            literal: "`{{name}}` holds a literal {{kind}}. A {{kind}} is supplied by configuration, never written in source.",
            schemaDefault: "`.default(...)` gives `{{name}}` a value in source. Remove the default so a missing {{kind}} fails validation at boot.",
            cwdPath: "A path built from `process.cwd()` and `{{segment}}` depends on where the process was started. Resolve it from a configured root.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename) || isTestLane(filename)) return {}
        const report = (node, messageId, name, kind) => context.report({ node, messageId, data: { name, kind: kind === "url" ? "URL" : "secret" } })
        const checkLiteralTarget = (node, value) => {
            const name = targetName(node)
            const kind = name ? configKind(name) : null
            if (kind && value && isNonEmptyText(value) && (kind === "url" ? hasScheme(value) : !isKeyName(value, name))) report(node, "literal", name, kind)
        }
        return {
            LogicalExpression(node) {
                if (node.operator !== "??" && node.operator !== "||") return
                const name = envReadName(node.left)
                const kind = name ? configKind(name) : null
                if (kind && isNonEmptyText(node.right) && (kind === "url" ? hasScheme(node.right) : !isKeyName(node.right, name))) report(node, "fallback", name, kind)
            },
            Property(node) {
                checkLiteralTarget(node, node.value)
            },
            PropertyDefinition(node) {
                checkLiteralTarget(node, node.value)
            },
            VariableDeclarator(node) {
                checkLiteralTarget(node, node.init)
            },
            AssignmentPattern(node) {
                checkLiteralTarget(node, node.right)
            },
            CallExpression(node) {
                const callee = node.callee
                if (callee.type === "MemberExpression" && keyName(callee.property) === "default" && isNonEmptyText(node.arguments[0])) {
                    for (let parent = node.parent; parent; parent = parent.parent) {
                        if (parent.type === "Property") {
                            const name = keyName(parent.key)
                            const kind = name ? configKind(name) : null
                            if (kind && (kind !== "url" || hasScheme(node.arguments[0]))) report(node, "schemaDefault", name, kind)
                            return
                        }
                    }
                    return
                }
                if (callee.type === "MemberExpression" && ["join", "resolve"].includes(keyName(callee.property) ?? "")) {
                    let cwd = false
                    walk(node, (child) => {
                        if (child.type === "CallExpression" && child.callee.type === "MemberExpression" && keyName(child.callee.property) === "cwd") cwd = true
                    })
                    if (!cwd) return
                    for (const argument of node.arguments) {
                        const text = staticText(argument)
                        const segment = text === null ? null : text.split(/[\\/]/).find((part) => part === "src" || part === ".starcistacks")
                        if (segment) context.report({ node, messageId: "cwdPath", data: { segment } })
                    }
                }
            },
        }
    },
}

const SECRET_COMPARE_WORDS = new Set(["secret", "password", "passwd", "passphrase", "token", "signature", "hmac", "credential", "credentials", "apikey"])

/** The identifier or property a comparison operand ends in, else null. */
const operandName = (node) => {
    if (node.type === "Identifier") return node.name
    if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") return node.property.name
    return null
}

/** Words before the last one that make a token a counter or a cursor, not a credential. */
const NOT_A_CREDENTIAL_QUALIFIERS = new Set(["fencing", "idempotency", "cursor", "page", "next", "continuation", "pagination", "sync", "csrf"])

const isSecretName = (name) => {
    // an UPPER_SNAKE name is a constant naming a key, not the value it names
    if (/^[A-Z][A-Z0-9_]*$/.test(name)) return false
    const words = wordsOf(name)
    const last = words.at(-1)
    if (!last || NOT_A_VALUE_WORDS.has(last) || words.some((word) => NOT_A_CREDENTIAL_QUALIFIERS.has(word))) return false
    return SECRET_COMPARE_WORDS.has(last) || (last === "key" && words.length > 1 && KEY_PREFIXES.has(words.at(-2)))
}

/** An emptiness or presence check reveals nothing a timing attack could use. */
const isPresenceOperand = (node) =>
    (node.type === "Literal" && (node.value === null || node.value === "" || typeof node.value === "boolean")) ||
    (node.type === "Identifier" && node.name === "undefined") ||
    (node.type === "UnaryExpression" && node.operator === "typeof")

/** A secret is compared with `timingSafeEqual`, never with an equality operator. */
export const secretCompareTimingSafe = {
    meta: {
        type: "problem",
        docs: { description: "A secret-named value is compared with `timingSafeEqual`, not `===` or `!==`." },
        schema: [],
        messages: {
            compare: "`{{name}}` is a secret compared with `{{operator}}`. Compare secrets with `crypto.timingSafeEqual` on equal-length buffers so the comparison time does not leak the match.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        return {
            BinaryExpression(node) {
                if (!["===", "!==", "==", "!="].includes(node.operator)) return
                if (isPresenceOperand(node.left) || isPresenceOperand(node.right)) return
                for (const side of [node.left, node.right]) {
                    const name = operandName(side)
                    if (name && isSecretName(name)) {
                        context.report({ node, messageId: "compare", data: { name, operator: node.operator } })
                        return
                    }
                }
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "no-direct-env-read": noDirectEnvRead,
    "no-secret-default": noSecretDefault,
    "secret-compare-timing-safe": secretCompareTimingSafe,
}

/** All three start at error: a secret in source or a timing leak is never a warning. */
export const recommended = {
    "starci-be/no-direct-env-read": "error",
    "starci-be/no-secret-default": "error",
    "starci-be/secret-compare-timing-safe": "error",
}
