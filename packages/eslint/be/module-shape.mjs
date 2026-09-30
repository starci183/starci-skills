/**
 * The rules that hold the shape of a Nest module in HFS (catalog R45 `BE_MODULE_SHAPE`, BE-CONVENTION 1.2).
 *
 * Globality is a composition decision, not a property of a module: a capability is registered once per app, in the app's
 * `app.module.ts`, as `X.register({ isGlobal: true, ...options })`, and never listed in another module's `imports`.
 *
 *   - `no-global-decorator` refuses `@Global()` anywhere, specs included. (It replaces `global-module-allowlist`: the
 *     manifest no longer carries a list of modules that may be global.)
 *   - `is-global-only-in-app` refuses `isGlobal: true` (and a dynamic module literal `global: true`) outside
 *     `apps/<app>/src/app.module.ts`.
 *   - `no-cross-owner-module-import` refuses a `@Module({ imports })` entry whose module class is declared by another
 *     owner of the repository (the declaring owner is found by resolving the class, not by reading its name): a
 *     capability's representative module is reached through its `Inject*()` decorators, never by import. One owner may
 *     import its own modules (a transport module its feature's application module, a representative its sub-modules);
 *     the app composes every owner.
 *   - `typed-module-definition` requires `ConfigurableModuleBuilder<Options>` to state its options type.
 *   - `static-module-register` allows one factory name, `register`, and requires it `static`: no `forRoot`, `forFeature`
 *     or `registerAsync`, because options are parsed once in `main.ts`.
 *   - `no-new-injectable` refuses `new X()` of a class declared with a provider decorator outside a spec: the container
 *     builds providers, so construction by hand bypasses its scope and its overrides.
 *   - `no-module-let` refuses mutable module-level state (`let` and `var` at the top of a file).
 *   - `one-module-per-file` allows one `@Module` class in a file, so one transport or application module has one home.
 */
import ts from "typescript"
import { decoratorName, keyName } from "./lib/ast.mjs"
import { importsFrom } from "./lib/declared.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { isDeclarationFile, isSpecFile, normalizePath } from "./lib/path.mjs"
import { typed } from "./lib/types.mjs"

const isModuleClass = (node) => node.decorators?.some((decorator) => decoratorName(decorator) === "Module") ?? false

/** `@Global()` is banned everywhere: globality is decided at the app root. */
export const noGlobalDecorator = {
    meta: {
        type: "problem",
        docs: { description: "`@Global()` is not used anywhere, specs included." },
        schema: [],
        messages: {
            global: "`@Global()` makes a module global from inside itself. Globality is a composition decision: the app registers the capability once with `X.register({ isGlobal: true, ...options })` in `app.module.ts`.",
        },
    },
    create(context) {
        if (isDeclarationFile(context.filename || context.getFilename())) return {}
        let aliases = new Map()
        return {
            Program(node) {
                aliases = importsFrom(node, () => true)
            },
            Decorator(node) {
                const expression = node.expression.type === "CallExpression" ? node.expression.callee : node.expression
                const name = expression.type === "Identifier" ? expression.name : null
                const namespaced = expression.type === "MemberExpression" && !expression.computed && keyName(expression.property) === "Global" && expression.object.type === "Identifier" && aliases.get(expression.object.name) === "*"
                if (name === "Global" || (name !== null && aliases.get(name) === "Global") || namespaced) context.report({ node, messageId: "global" })
            },
        }
    },
}

/** The app composition file: `apps/<app>/src/app.module.ts`, judged by the app slot and the file's role name. */
const isAppModule = (hfs, filename) => (hfs.slotOf(filename) ?? "").startsWith("be.app.") && filename.split("/").at(-1) === "app.module.ts"

const isTrue = (node) => node?.type === "Literal" && node.value === true

/** `isGlobal: true` appears only in the app's `app.module.ts`. */
export const isGlobalOnlyInApp = {
    meta: {
        type: "problem",
        docs: { description: "`isGlobal: true` appears only in `apps/<app>/src/app.module.ts`." },
        schema: [],
        messages: {
            isGlobal: "`{{key}}: true` outside `apps/<app>/src/app.module.ts` makes a module global from the wrong place. Only the app registers a capability, once, with `isGlobal: true`; here keep the module's own default.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename) || isAppModule(hfsOf(context), filename)) return {}
        return {
            Property(node) {
                if (node.computed && node.key.type !== "Literal") return
                if (!isTrue(node.value)) return
                const key = keyName(node.key)
                if (key === "isGlobal") context.report({ node, messageId: "isGlobal", data: { key } })
                // a dynamic module literal `{ module: X, global: true }` is the same global registration
                else if (key === "global" && node.parent?.type === "ObjectExpression" && node.parent.properties.some((item) => item.type === "Property" && keyName(item.key) === "module")) {
                    context.report({ node, messageId: "isGlobal", data: { key } })
                }
            },
            AssignmentExpression(node) {
                if (node.left.type === "MemberExpression" && !node.left.computed && keyName(node.left.property) === "isGlobal" && isTrue(node.right)) {
                    context.report({ node, messageId: "isGlobal", data: { key: "isGlobal" } })
                }
            },
        }
    },
}

/** The module class an `imports` entry names: `X` or `X.register(...)`; null for anything else. */
const importedModule = (entry) => {
    if (entry.type === "Identifier") return entry
    if (entry.type === "CallExpression" && entry.callee.type === "MemberExpression" && !entry.callee.computed && entry.callee.object.type === "Identifier") return entry.callee.object
    return null
}

/** A module never imports another owner's module: a capability is reached through its `Inject*()` decorators. */
export const noCrossOwnerModuleImport = {
    meta: {
        type: "problem",
        docs: { description: "A `@Module({ imports })` entry is not a module declared by another owner." },
        schema: [],
        messages: {
            cross: "`{{name}}` is a module of another owner. A capability's representative module is registered once in `app.module.ts` and consumed through its `Inject*()` decorators; only a transport module may import its own feature's application module, and a representative its own sub-modules.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const hfs = hfsOf(context)
        if ((hfs.slotOf(filename) ?? "").startsWith("be.app.")) return {}
        const { checker, toTs } = typed(context)
        const here = hfs.ownerOf(filename)
        const declaringOwner = (identifier) => {
            const tsNode = toTs(identifier)
            let symbol = tsNode ? checker.getSymbolAtLocation(tsNode) : undefined
            if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
            const declaration = symbol?.declarations?.[0]
            return declaration ? hfs.ownerOf(String(declaration.getSourceFile().fileName).replace(/\\/g, "/")) : null
        }
        return {
            Decorator(node) {
                if (decoratorName(node) !== "Module" || node.expression.type !== "CallExpression") return
                const metadata = node.expression.arguments[0]
                if (metadata?.type !== "ObjectExpression") return
                const imports = metadata.properties.find((item) => item.type === "Property" && !item.computed && keyName(item.key) === "imports")
                if (imports?.value.type !== "ArrayExpression") return
                for (const entry of imports.value.elements) {
                    const reference = entry ? importedModule(entry) : null
                    if (!reference) continue
                    // a package module is R90's concern; the same owner is one owner (a transport module and its feature's application module, a representative and its sub-modules)
                    const there = declaringOwner(reference)
                    if (there !== null && there !== here) context.report({ node: entry, messageId: "cross", data: { name: reference.name } })
                }
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
                const typedArgs = (node.typeArguments ?? node.typeParameters)?.params?.length > 0
                if (!typedArgs) context.report({ node, messageId: "untyped", data: { example: "Capability" } })
            },
        }
    },
}

const OTHER_FACTORIES = new Set(["registerAsync", "forRoot", "forRootAsync", "forFeature", "forFeatureAsync"])

/** The one dynamic-module factory is `static register`. */
export const staticModuleRegister = {
    meta: {
        type: "problem",
        docs: { description: "A module's only factory is `static register`; `forRoot`, `forFeature` and `registerAsync` do not exist." },
        schema: [],
        messages: {
            notStatic: "`register` builds a dynamic module and must be `static`; an instance method cannot be called from `imports`.",
            otherName: "`{{name}}` is not a module factory of this codebase. The only factory is `static register(options)`: options are parsed once in `main.ts`, so there is no `forRoot`, `forFeature` or `registerAsync`.",
        },
    },
    create(context) {
        if (isDeclarationFile(context.filename || context.getFilename())) return {}
        return {
            ClassDeclaration(node) {
                if (!isModuleClass(node)) return
                for (const member of node.body.body) {
                    if ((member.type !== "MethodDefinition" && member.type !== "PropertyDefinition") || member.computed || member.key.type !== "Identifier") continue
                    if (OTHER_FACTORIES.has(member.key.name)) context.report({ node: member, messageId: "otherName", data: { name: member.key.name } })
                    else if (member.type === "MethodDefinition" && member.key.name === "register" && !member.static) context.report({ node: member, messageId: "notStatic" })
                }
            },
        }
    },
}

/** Decorators that make a class a provider the container builds. */
const PROVIDER_DECORATORS = new Set(["Injectable", "Controller", "Resolver", "CommandHandler", "QueryHandler"])

/** True when the declaration carries a provider decorator. */
const isProviderDeclaration = (declaration) => {
    if (!ts.isClassDeclaration(declaration) && !ts.isClassExpression(declaration)) return false
    return (ts.getDecorators(declaration) ?? []).some((decorator) => {
        const expression = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression
        return ts.isIdentifier(expression) && PROVIDER_DECORATORS.has(expression.text)
    })
}

/** Providers are built by the container, not by `new` (a spec constructs its subject with typed doubles). */
export const noNewInjectable = {
    meta: {
        type: "problem",
        docs: { description: "No `new X()` of a class declared as a provider outside a spec." },
        schema: [],
        messages: {
            construct: "`new {{name}}()` builds a provider by hand, bypassing the container's scope and overrides. Inject it, or register it as a provider.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename) || isSpecFile(filename) || (hfsOf(context).slotOf(filename) ?? "").startsWith("be.tests.")) return {}
        const { checker, toTs } = typed(context)
        return {
            NewExpression(node) {
                if (node.callee.type !== "Identifier") return
                const tsNode = toTs(node.callee)
                let symbol = tsNode ? checker.getSymbolAtLocation(tsNode) : undefined
                if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
                if (symbol?.declarations?.some(isProviderDeclaration)) context.report({ node, messageId: "construct", data: { name: node.callee.name } })
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
        if (isDeclarationFile(context.filename || context.getFilename())) return {}
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
        if (isDeclarationFile(context.filename || context.getFilename())) return {}
        let seen = 0
        return {
            ClassDeclaration(node) {
                if (!isModuleClass(node)) return
                seen += 1
                if (seen > 1) context.report({ node, messageId: "many" })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "no-global-decorator": noGlobalDecorator,
    "is-global-only-in-app": isGlobalOnlyInApp,
    "no-cross-owner-module-import": noCrossOwnerModuleImport,
    "typed-module-definition": typedModuleDefinition,
    "static-module-register": staticModuleRegister,
    "no-new-injectable": noNewInjectable,
    "no-module-let": noModuleLet,
    "one-module-per-file": oneModulePerFile,
}

/** All start at error: HFS has one module shape and no baseline. */
export const recommended = {
    "starci-be/no-global-decorator": "error",
    "starci-be/is-global-only-in-app": "error",
    "starci-be/no-cross-owner-module-import": "error",
    "starci-be/typed-module-definition": "error",
    "starci-be/static-module-register": "error",
    "starci-be/no-new-injectable": "error",
    "starci-be/no-module-let": "error",
    "starci-be/one-module-per-file": "error",
}
