/**
 * The rules that hold HFS configuration and secrets (catalog R43 `BE_CONFIG_OWNER`, R44 `BE_SECRET_DEFAULT`,
 * and the secret-comparison half of R41 `BE_DEFAULT_DENY`).
 *
 *   - `no-direct-env-read` keeps the process environment inside the one file that declares the `EnvSource` class of
 *     `platform/config`. Everything else receives typed options from `<capability>.config.ts`. `process.env` in any form
 *     (member access, destructuring, `Reflect.get(process, "env")`, an `env` import of `node:process`), an import of
 *     `@nestjs/config` or `dotenv`, and a `process.cwd()` path joined into `src` or
 *     `.starcistacks` are refused everywhere else. The test world (slot `be.tests.world`) may read and write `process.env`:
 *     it hands the run state file path to the jest workers. A config getter that reads `process.env` itself is caught here at its
 *     definition.
 *   - `config-parsed-in-main` keeps the parsing of configuration in `main.ts`: a call of a function exported by a
 *     `<capability>.config.ts` (or of a function returning a `<capability>.options.ts` type, at module scope) is refused
 *     outside the app entry (`main.ts` and `<app>.options.ts`), the config file itself, its own spec, the test world and a provider contract spec. The callee is found through the type
 *     checker, so no function name is matched.
 *   - `no-secret-default` refuses a default for a value typed `Secret` or `Url` by `platform/config`: a default argument
 *     to an `EnvSource` reader, a `??`/`||` fallback on such a value, and a string literal default (`""`, `"localhost"`,
 *     `"127.0.0.1"`, `"0.0.0.0"`, `http(s)://...`) given to any reader that returns one. The TYPE decides; no key name is
 *     matched. A missing value must stop the boot, naming the key.
 *   - `secret-compare-timing-safe` refuses `===` and `!==` on a value typed by the `Secret` brand of `platform/config` (or
 *     read out of one, `secret.reveal()`) and on a secret-named identifier. A secret compares with
 *     `timingSafeEqual`, because the length of the matching prefix is a measurable side channel.
 *
 * No test lane is exempt: a spec builds its `EnvSource` from a literal record and never touches the process environment.
 */
import ts from "typescript"
import { keyName, staticText, walk, wordsOf } from "./lib/ast.mjs"
import { isOwnedBy, isOwnedType, originsOf } from "./lib/declared.mjs"
import { hfsOf, inTestWorld } from "./lib/hfs.mjs"
import { isDeclarationFile, normalizePath } from "./lib/path.mjs"
import { moduleOf, originsOfType, typed } from "./lib/types.mjs"

/** The test composition root (slot `be.tests.world`): it composes app options like `main.ts` and hands run state to jest workers through the environment. */
const isTestWorld = inTestWorld

const PROCESS_MODULES = new Set(["process", "node:process"])

/** `@nestjs/config`, `dotenv` and their subpaths. */
const isConfigPackage = (source) => /^(?:@nestjs\/config|dotenv)(?:\/|$)/.test(source)

/** `globalThis.process` and `global.process`. */
const isGlobalProcess = (node) =>
    node.type === "MemberExpression" &&
    !node.computed &&
    keyName(node.property) === "process" &&
    node.object.type === "Identifier" &&
    (node.object.name === "globalThis" || node.object.name === "global")

/** True when the property of a member expression spells `env`. */
const spellsEnv = (node) => (node.computed ? staticText(node.property) === "env" : keyName(node.property) === "env")

/** Only the file that declares `EnvSource` (and the test world) reads the process environment. */
export const noDirectEnvRead = {
    meta: {
        type: "problem",
        docs: { description: "The process environment is read only by the `EnvSource` class of `platform/config`." },
        schema: [],
        messages: {
            env: "The process environment is read outside the `EnvSource` of `platform/config`. Add the key to the capability's `<capability>.config.ts` (`parse<C>Config(env: EnvSource)`) and receive the value through its `<capability>.options.ts`.",
            package: "`{{source}}` is a second config path. Configuration is parsed once in `main.ts` by `platform/config` typed readers and reaches a module through `register(options)`.",
            cwdPath: "A path built from `process.cwd()` and `{{segment}}` depends on where the process was started. Resolve it from a configured root.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const hfs = hfsOf(context)
        const inConfigOwner = isOwnedBy(hfs, filename, "platform", "config")
        let declaresEnvSource = false
        const processNames = new Set(["process"])
        const isLocal = (identifier) => {
            for (let scope = context.sourceCode.getScope(identifier); scope; scope = scope.upper) {
                const variable = scope.set.get(identifier.name)
                if (variable) return variable.defs.length > 0 && !variable.defs.every((definition) => definition.type === "ImportBinding")
            }
            return false
        }
        const isProcess = (node) => (node.type === "Identifier" && processNames.has(node.name) && !isLocal(node)) || isGlobalProcess(node)
        const isEnvSourceFile = () => inConfigOwner && declaresEnvSource
        const inWorld = isTestWorld(hfs, filename)
        const reportEnv = (node) => {
            if (!isEnvSourceFile() && !inWorld) context.report({ node, messageId: "env" })
        }
        const reportSource = (node, source) => {
            if (isConfigPackage(source)) context.report({ node, messageId: "package", data: { source } })
        }
        return {
            Program(program) {
                declaresEnvSource = program.body.some((statement) => {
                    const declaration = statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration" ? statement.declaration : statement
                    return declaration?.type === "ClassDeclaration" && declaration.id?.name === "EnvSource"
                })
            },
            ImportDeclaration(node) {
                const source = String(node.source.value)
                reportSource(node, source)
                if (!PROCESS_MODULES.has(source)) return
                for (const specifier of node.specifiers) {
                    if (specifier.type === "ImportSpecifier" && (specifier.imported.name ?? specifier.imported.value) === "env") reportEnv(specifier)
                    else if (specifier.type !== "ImportSpecifier") processNames.add(specifier.local.name)
                }
            },
            ImportExpression(node) {
                const source = staticText(node.source)
                if (source !== null) reportSource(node, source)
            },
            MemberExpression(node) {
                if (isProcess(node.object) && spellsEnv(node)) reportEnv(node)
            },
            VariableDeclarator(node) {
                if (!node.init || !isProcess(node.init) || node.id.type !== "ObjectPattern") return
                if (node.id.properties.some((property) => property.type === "Property" && keyName(property.key) === "env")) reportEnv(node)
            },
            CallExpression(node) {
                const callee = node.callee
                if (callee.type === "Identifier" && callee.name === "require") {
                    const source = staticText(node.arguments[0])
                    if (source !== null) reportSource(node, source)
                }
                if (callee.type !== "MemberExpression") return
                if (callee.object.type === "Identifier" && callee.object.name === "Reflect" && keyName(callee.property) === "get") {
                    if (node.arguments[0] && isProcess(node.arguments[0]) && staticText(node.arguments[1]) === "env") reportEnv(node)
                }
                if (["join", "resolve"].includes(keyName(callee.property) ?? "") && !isEnvSourceFile()) {
                    let cwd = false
                    walk(node, (child) => {
                        if (child.type === "CallExpression" && child.callee.type === "MemberExpression" && isProcess(child.callee.object) && keyName(child.callee.property) === "cwd") cwd = true
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

const CONFIG_SUFFIX = ".config.ts"
const OPTIONS_SUFFIX = ".options.ts"
const CONFIG_SPEC_SUFFIX = ".config.spec.ts"

const baseOf = (file) => normalizePath(file).split("/").at(-1) ?? ""

/** A file in a slot of the repository whose role is `<c>.config.ts` (a file with the suffix that no slot claims is not one). */
const isConfigFile = (hfs, file) => baseOf(file).endsWith(CONFIG_SUFFIX) && hfs.slotOf(file) !== null

/** A file in a slot of the repository whose role is `<c>.options.ts`. */
const isOptionsFile = (hfs, file) => baseOf(file).endsWith(OPTIONS_SUFFIX) && hfs.slotOf(file) !== null

/** The declaration of a plain function (declaration, or arrow/function expression bound to a variable), else null: a method is not a getter. */
const functionDeclarationOf = (declaration) => {
    if (!declaration) return null
    if (ts.isFunctionDeclaration(declaration)) return declaration
    if ((ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration)) && ts.isVariableDeclaration(declaration.parent)) return declaration
    return null
}

/** True when the node is evaluated when the module loads: no function, method or class member body encloses it. */
const isModuleScope = (node) => {
    for (let parent = node.parent; parent; parent = parent.parent) {
        if (/Function|MethodDefinition|PropertyDefinition|StaticBlock/.test(parent.type)) return false
    }
    return true
}

/** Config is parsed once, in `main.ts`; nothing else calls a config parser or getter. */
export const configParsedInMain = {
    meta: {
        type: "problem",
        docs: { description: "A function of a `<capability>.config.ts` is called only from the app entry, its own config file or spec, and the test world." },
        schema: [],
        messages: {
            parsed: "`{{name}}` is declared by `{{file}}` and parses configuration. Configuration is parsed once in `apps/<app>/src/main.ts` and reaches a module through `register(options)`; read it here with `Inject<C>Options()`.",
            moduleScope: "`{{name}}` returns configuration options and is called when the module loads. Options are built once in `main.ts` and injected with `Inject<C>Options()`.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const hfs = hfsOf(context)
        const slot = hfs.slotOf(filename) ?? ""
        // the composition roots: the app entry and its `<app>.options.ts` (which `main.ts` calls to build `AppOptions`), the test world,
        // and a provider contract spec (it registers one module with options parsed from the declared sandbox keys, as the world does)
        const isEntry = slot.startsWith("be.app.") && (baseOf(filename) === "main.ts" || baseOf(filename).endsWith(OPTIONS_SUFFIX))
        const isComposingTest = isTestWorld(hfs, filename) || slot === "be.tests.contract"
        const isOwnSpec = baseOf(filename).endsWith(CONFIG_SPEC_SUFFIX)
        if (isEntry || isComposingTest || isOwnSpec) return {}
        const { checker, toTs } = typed(context)
        return {
            CallExpression(node) {
                const tsCall = toTs(node)
                if (!tsCall) return
                const signature = checker.getResolvedSignature(tsCall)
                const declaration = functionDeclarationOf(signature?.declaration)
                if (!declaration) return
                const declaredIn = normalizePath(declaration.getSourceFile().fileName)
                const name = context.sourceCode.getText(node.callee)
                if (isConfigFile(hfs, declaredIn)) {
                    if (declaredIn !== filename) context.report({ node, messageId: "parsed", data: { name, file: baseOf(declaredIn) } })
                    return
                }
                if (!isModuleScope(node)) return
                const returned = originsOfType(checker, checker.getReturnTypeOfSignature(signature))
                if (returned.some((origin) => isOptionsFile(hfs, origin.file))) context.report({ node, messageId: "moduleScope", data: { name } })
            },
        }
    },
}

/** The brand classes of `platform/config` a default must never be given to. */
const BRANDS = new Set(["Secret", "Url"])
const SECRET_READERS = new Set(["secret", "url", "host"])
const DEFAULT_LITERAL = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|https?:\/\/.*)?$/i

/** No secret or URL value has a default of any kind: a missing value stops the boot. */
export const noSecretDefault = {
    meta: {
        type: "problem",
        docs: { description: "A value typed `Secret` or `Url` never has a default, argument or fallback." },
        schema: [],
        messages: {
            fallback: "This `{{operator}}` gives a `Secret` or `Url` a value from source. A missing secret or URL must stop the boot with an error naming the key, not start the app with a fallback.",
            argument: "`{{method}}` is given a default. A secret, credential, key, host or URL has no default of any kind: remove the second argument so a missing key fails naming itself.",
            literal: "A string default (`\"\"`, `\"localhost\"`, `\"127.0.0.1\"`, `\"0.0.0.0\"` or an `http(s)://` URL) is given to a reader that returns a `Secret` or `Url`. Remove it so a missing key fails naming itself.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const hfs = hfsOf(context)
        /** True when the node's type is (or contains) `Secret` or `Url` as `platform/config` declares them. */
        const isBrand = (node) => originsOf(context, node).some((origin) => BRANDS.has(origin.name) && isOwnedBy(hfs, origin.file, "platform", "config"))
        const isEnvSource = (node) => originsOf(context, node).some((origin) => origin.name === "EnvSource" && isOwnedBy(hfs, origin.file, "platform", "config"))
        const checkFallback = (node, operator, left) => {
            if (isBrand(left)) context.report({ node, messageId: "fallback", data: { operator } })
        }
        return {
            LogicalExpression(node) {
                if (node.operator === "??" || node.operator === "||") checkFallback(node, node.operator, node.left)
            },
            AssignmentExpression(node) {
                if (node.operator === "??=" || node.operator === "||=") checkFallback(node, node.operator, node.left)
            },
            CallExpression(node) {
                if (node.arguments.length < 2) return
                const callee = node.callee
                const method = callee.type === "MemberExpression" && !callee.computed ? keyName(callee.property) : null
                const onEnvSource = method !== null && isEnvSource(callee.object)
                if (onEnvSource && (SECRET_READERS.has(method) || isBrand(node))) {
                    context.report({ node: node.arguments[1], messageId: "argument", data: { method } })
                    return
                }
                if (!isBrand(node)) return
                const literal = node.arguments.slice(1).find((argument) => {
                    const text = staticText(argument)
                    return text !== null && DEFAULT_LITERAL.test(text)
                })
                if (literal) context.report({ node: literal, messageId: "literal" })
            },
        }
    },
}

const SECRET_COMPARE_WORDS = new Set(["secret", "password", "passwd", "passphrase", "token", "signature", "hmac", "credential", "credentials", "apikey", "authorization"])
const KEY_PREFIXES = new Set(["api", "secret", "private", "access", "signing", "encryption", "master", "auth", "jwt", "session"])
const NOT_A_VALUE_WORDS = new Set(["type", "kind", "length", "count", "ttl", "name", "prefix", "header", "scheme", "field", "path", "regex", "pattern"])

/** The identifier or property a comparison operand ends in, else null. */
const operandName = (node) => {
    if (node.type === "Identifier") return node.name
    if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") return node.property.name
    return null
}

/** Words before the last one that make a token a counter or a cursor, not a credential. */
const NOT_A_CREDENTIAL_QUALIFIERS = new Set(["fencing", "idempotency", "cursor", "page", "next", "continuation", "pagination", "sync", "csrf"])

/**
 * Whether a value's own name says it IS a credential: its last word is one (`password`, `accessToken`, `clientSecret`,
 * `signingKey`), unless the name is an UPPER_SNAKE constant naming a key or a counter or cursor qualifies it. Shared by the
 * comparison rule here and the error rule of R71.
 */
export const isCredentialName = (name) => {
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

/** A value typed by the `Secret` brand of `platform/config`, or read out of one (`secret.reveal()`, `secret.value`): the TYPE says it is a secret. */
const isSecretValue = (context, node) => {
    const holder = node.type === "CallExpression" && node.callee.type === "MemberExpression" ? node.callee.object : node.type === "MemberExpression" ? node.object : null
    return isOwnedType(context, node, "Secret", "platform", "config") || (holder !== null && isOwnedType(context, holder, "Secret", "platform", "config"))
}

/** The packages that declare the Node crypto types: a digest read out of a `Hash` or `Hmac` is secret-derived material. */
const CRYPTO_PACKAGES = new Set(["crypto", "node:crypto"])

/** A `.digest(...)` of a `Hash` or `Hmac` of Node's crypto, found by where the called signature is declared, never by the receiver's name. */
const isCryptoDigest = (context, node) => {
    if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression") return false
    const { checker, toTs } = typed(context)
    const tsCall = toTs(node)
    const declaration = tsCall ? checker.getResolvedSignature(tsCall)?.declaration : undefined
    if (!declaration || !declaration.name || declaration.name.getText() !== "digest") return false
    const owner = declaration.parent
    const ownerName = (ts.isInterfaceDeclaration(owner) || ts.isClassDeclaration(owner)) && owner.name ? owner.name.text : ""
    if (ownerName !== "Hash" && ownerName !== "Hmac") return false
    return CRYPTO_PACKAGES.has(moduleOf(declaration, String(declaration.getSourceFile().fileName).split("\\").join("/")))
}

/** A secret is compared with `timingSafeEqual`, never with an equality operator. */
export const secretCompareTimingSafe = {
    meta: {
        type: "problem",
        docs: { description: "A `Secret`-typed or secret-named value is compared with `timingSafeEqual`, not `===` or `!==`." },
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
                    if (isSecretValue(context, side) || isCryptoDigest(context, side)) {
                        context.report({ node, messageId: "compare", data: { name: context.sourceCode.getText(side), operator: node.operator } })
                        return
                    }
                    const name = operandName(side)
                    if (name && isCredentialName(name)) {
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
    "config-parsed-in-main": configParsedInMain,
    "no-secret-default": noSecretDefault,
    "secret-compare-timing-safe": secretCompareTimingSafe,
}

/** All four start at error: a secret in source or a timing leak is never a warning. */
export const recommended = {
    "starci-be/no-direct-env-read": "error",
    "starci-be/config-parsed-in-main": "error",
    "starci-be/no-secret-default": "error",
    "starci-be/secret-compare-timing-safe": "error",
}
