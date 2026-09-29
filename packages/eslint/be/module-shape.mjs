/**
 * The rules that hold the shape of a Nest module in HFS v2 (catalog R45 `BE_MODULE_SHAPE`).
 *
 *   - `global-module-allowlist` lets `@Global()` appear only on the platform capabilities the slot manifest
 *     names (`platform/config`, `platform/logging`, `platform/database` by default; read through `lib/slots.mjs`).
 *     A global module hides who depends on whom, so it is reserved for the three every capability needs.
 *   - `typed-module-definition` requires `ConfigurableModuleBuilder<Options>` to state its options type.
 *   - `static-module-register` requires `register`, `registerAsync`, `forRoot` and `forFeature` to be `static`.
 *   - `no-new-injectable` refuses `new SomeService()` (and other injectable-shaped names) outside specs: the
 *     container builds providers, so construction by hand bypasses its scope and its overrides.
 *   - `no-module-let` refuses mutable module-level state (`let` and `var` at the top of a file).
 *   - `one-module-per-file` allows one `@Module` class in a file, so one transport or application module has
 *     one home.
 *
 * `no-self-global-module` of the earlier canon is gone: it refused `@Global()` everywhere, which also refused
 * the three platform capabilities HFS v2 requires to be global.
 */
import { decoratorName } from "./lib/ast.mjs"
import { isDeclarationFile, isTestLane, normalizePath } from "./lib/path.mjs"
import { hfsParams } from "./lib/slots.mjs"

/** `platform/<capability>` of a file inside `src/modules/platform`, else null. */
const platformCapability = (filename) => {
    const match = /\/src\/modules\/(platform\/[^/]+)\//.exec(filename)
    return match ? match[1] : null
}

/** `@Global()` only on an allowlisted platform capability. */
export const globalModuleAllowlist = {
    meta: {
        type: "problem",
        docs: { description: "`@Global()` only for the manifest's platform allowlist." },
        schema: [
            {
                type: "object",
                properties: { allowed: { type: "array", items: { type: "string" } } },
                additionalProperties: false,
            },
        ],
        messages: {
            global: "`@Global()` is allowed only on {{allowed}}. A global module hides its dependants; import the module where it is used, or pass options through `register`.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename) || isTestLane(filename)) return {}
        const allowed = context.options[0]?.allowed ?? hfsParams.globalModules
        const capability = platformCapability(filename)
        if (capability !== null && allowed.includes(capability)) return {}
        return {
            Decorator(node) {
                if (decoratorName(node) === "Global") context.report({ node, messageId: "global", data: { allowed: allowed.map((name) => `\`${name}\``).join(", ") } })
            },
        }
    },
}

/** A configurable module builder names its options type. */
export const typedModuleDefinition = {
    meta: {
        type: "problem",
        docs: { description: "`new ConfigurableModuleBuilder<Options>()` states its options type." },
        schema: [],
        messages: {
            untyped: "`ConfigurableModuleBuilder` has no options type. Write `new ConfigurableModuleBuilder<{{example}}Options>()` so `register` is checked.",
        },
    },
    create(context) {
        if (isDeclarationFile(context.filename || context.getFilename())) return {}
        return {
            NewExpression(node) {
                if (node.callee.type !== "Identifier" || node.callee.name !== "ConfigurableModuleBuilder") return
                const typed = (node.typeArguments ?? node.typeParameters)?.params?.length > 0
                if (!typed) context.report({ node, messageId: "untyped", data: { example: "Capability" } })
            },
        }
    },
}

const REGISTER_NAMES = new Set(["register", "registerAsync", "forRoot", "forRootAsync", "forFeature"])

/** The dynamic-module factory methods are `static`. */
export const staticModuleRegister = {
    meta: {
        type: "problem",
        docs: { description: "`register`, `registerAsync`, `forRoot` and `forFeature` are static." },
        schema: [],
        messages: {
            notStatic: "`{{name}}` builds a dynamic module and must be `static`; an instance method cannot be called from `imports`.",
        },
    },
    create(context) {
        if (isDeclarationFile(context.filename || context.getFilename())) return {}
        return {
            ClassDeclaration(node) {
                if (!node.decorators?.some((decorator) => decoratorName(decorator) === "Module")) return
                for (const member of node.body.body) {
                    if (member.type !== "MethodDefinition" || member.static || member.computed) continue
                    if (member.key.type === "Identifier" && REGISTER_NAMES.has(member.key.name)) {
                        context.report({ node: member, messageId: "notStatic", data: { name: member.key.name } })
                    }
                }
            },
        }
    },
}

const INJECTABLE_SUFFIX = /(?:Service|Repository|Guard|Interceptor|Resolver|Consumer|UseCase)$/

/** Providers are built by the container, not by `new`. */
export const noNewInjectable = {
    meta: {
        type: "problem",
        docs: { description: "No `new SomeService()` for an injectable-shaped class outside a spec." },
        schema: [],
        messages: {
            construct: "`new {{name}}()` builds a provider by hand, bypassing the container's scope and overrides. Inject it, or register it as a provider.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename) || isTestLane(filename)) return {}
        return {
            NewExpression(node) {
                if (node.callee.type === "Identifier" && INJECTABLE_SUFFIX.test(node.callee.name)) {
                    context.report({ node, messageId: "construct", data: { name: node.callee.name } })
                }
            },
        }
    },
}

/** No mutable state at module scope. */
export const noModuleLet = {
    meta: {
        type: "problem",
        docs: { description: "No `let` or `var` at module scope." },
        schema: [],
        messages: {
            mutable: "`{{kind}}` at module scope is process-wide mutable state shared by every request and test. Keep the state in an injected provider.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename) || isTestLane(filename)) return {}
        const check = (node) => {
            if (node.type === "VariableDeclaration" && node.kind !== "const") context.report({ node, messageId: "mutable", data: { kind: node.kind } })
        }
        return {
            Program(node) {
                for (const statement of node.body) {
                    check(statement)
                    if (statement.type === "ExportNamedDeclaration" && statement.declaration) check(statement.declaration)
                }
            },
        }
    },
}

/** One `@Module` class per file. */
export const oneModulePerFile = {
    meta: {
        type: "problem",
        docs: { description: "A file declares at most one `@Module` class." },
        schema: [],
        messages: {
            many: "This file declares a second `@Module` class. One transport or application module has one file; split this one out.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename) || isTestLane(filename)) return {}
        let seen = 0
        return {
            ClassDeclaration(node) {
                if (!node.decorators?.some((decorator) => decoratorName(decorator) === "Module")) return
                seen += 1
                if (seen > 1) context.report({ node, messageId: "many" })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "global-module-allowlist": globalModuleAllowlist,
    "typed-module-definition": typedModuleDefinition,
    "static-module-register": staticModuleRegister,
    "no-new-injectable": noNewInjectable,
    "no-module-let": noModuleLet,
    "one-module-per-file": oneModulePerFile,
}

/** All start at error: HFS v2 has one module shape and no baseline. */
export const recommended = {
    "starci-be/global-module-allowlist": "error",
    "starci-be/typed-module-definition": "error",
    "starci-be/static-module-register": "error",
    "starci-be/no-new-injectable": "error",
    "starci-be/no-module-let": "error",
    "starci-be/one-module-per-file": "error",
}
