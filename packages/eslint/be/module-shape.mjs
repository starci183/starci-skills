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
 *   - `capability-module-shape` holds the files of a capability: its representative `<c>.module.ts` extends the
 *     `ConfigurableModuleClass` of its own `<c>.module-definition.ts` (and may override only
 *     `static register(options: typeof OPTIONS_TYPE): DynamicModule`); that definition is a typed
 *     `ConfigurableModuleBuilder` with `.setExtras({ isGlobal: false }, ...)` and `.build()`; every sub-module and every
 *     feature module is a plain `@Module` class, and a feature has no module definition.
 *   - `typed-module-definition` requires `ConfigurableModuleBuilder<Options>` to state its options type.
 *   - `static-module-register` allows one factory name, `register`, and requires it `static`: no `forRoot`, `forFeature`
 *     or `registerAsync`, because options are parsed once in `main.ts`.
 *   - `no-new-injectable` refuses `new X()` of a class declared with a provider decorator outside a spec: the container
 *     builds providers, so construction by hand bypasses its scope and its overrides.
 *   - `no-module-let` refuses mutable module-level state (`let` and `var` at the top of a file).
 *   - `one-module-per-file` allows one `@Module` class in a file, so one transport or application module has one home.
 */
import ts from "typescript"
import { decoratorName, keyName, walk } from "./lib/ast.mjs"
import { importsFrom } from "./lib/declared.mjs"
import { hfsOf, inTestWorld } from "./lib/hfs.mjs"
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

/**
 * The test world (slot `be.tests.world`, `src/tests/world`) is the TEST COMPOSITION ROOT: `use-test-world.ts` assembles
 * capability modules with `isGlobal: true` the way `apps/<app>/src/app.module.ts` does in production. A spec (integration,
 * contract, e2e) does not compose and stays refused: it calls `useTestWorld(...)` only.
 */
const isWorld = inTestWorld

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
        if (isDeclarationFile(filename) || isAppModule(hfsOf(context), filename) || isWorld(hfsOf(context), filename)) return {}
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
            return declaration ? hfs.ownerOf(String(declaration.getSourceFile().fileName).replaceAll("\\", "/")) : null
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

const CAPABILITY_TIERS = new Set(["domain", "platform", "integrations"])

/** `{ inside, name }`: the owner-relative path of a file and the owner's directory name, or null outside an owner. */
const insideOwner = (hfs, filename) => {
    const root = hfs.ownerOf(filename)
    if (!root) return null
    return { inside: hfs.relative(filename).slice(root.length + 1), name: root.split("/").at(-1), tier: hfs.tierOf(filename) }
}

/** True for `static register(options: typeof OPTIONS_TYPE): DynamicModule`, the one allowed override. */
const isRegisterOverride = (member) => {
    if (!member.static) return false
    const fn = member.value
    const parameter = fn.params?.[0]
    const annotation = parameter?.type === "Identifier" ? parameter.typeAnnotation?.typeAnnotation : null
    const returns = fn.returnType?.typeAnnotation
    return (
        fn.params.length === 1 &&
        annotation?.type === "TSTypeQuery" &&
        annotation.exprName.type === "Identifier" &&
        annotation.exprName.name === "OPTIONS_TYPE" &&
        returns?.type === "TSTypeReference" &&
        returns.typeName.type === "Identifier" &&
        returns.typeName.name === "DynamicModule"
    )
}

/** The method names a builder chain calls, from the `new ConfigurableModuleBuilder<...>()` outward, with each call. */
const builderChain = (newExpression) => {
    const calls = []
    for (let node = newExpression; node.parent?.type === "MemberExpression" && node.parent.object === node && node.parent.parent?.type === "CallExpression"; node = node.parent.parent) {
        calls.push({ name: keyName(node.parent.property), call: node.parent.parent })
    }
    return calls
}

/**
 * The shape of a capability's module files (BE-CONVENTION 1.2): the representative `<c>.module.ts` extends the
 * `ConfigurableModuleClass` of its own `<c>.module-definition.ts`; that definition builds a typed
 * `ConfigurableModuleBuilder` with `.setExtras({ isGlobal: false }, ...)` and `.build()`; every other module of the
 * capability, and every feature module, is a plain static `@Module` class with no definition and no `register`.
 */
export const capabilityModuleShape = {
    meta: {
        type: "problem",
        docs: { description: "A capability's representative module extends its module definition's `ConfigurableModuleClass`; sub-modules and feature modules are plain." },
        schema: [],
        messages: {
            extendsBase: "The representative module of `{{name}}` must be `@Module({...}) export class X extends ConfigurableModuleClass {}` with `ConfigurableModuleClass` imported from `./{{name}}.module-definition`.",
            registerSignature: "The only `register` a capability module may declare is the override `static register(options: typeof OPTIONS_TYPE): DynamicModule`, with `OPTIONS_TYPE` from `./{{name}}.module-definition`.",
            plain: "`{{class}}` is a sub-module or a feature module: a plain static `@Module` class with no base class, no `register` and no module definition. Only the capability's representative module `{{name}}.module.ts` is configurable.",
            chain: "The module definition must be `new ConfigurableModuleBuilder<XOptions>().setExtras({ isGlobal: false }, (d, e) => ({ ...d, global: e.isGlobal })).build()`: {{missing}}.",
            featureDefinition: "A feature has no module definition: feature modules are static. Delete this file and register the feature's providers in its `@Module`.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const hfs = hfsOf(context)
        const where = insideOwner(hfs, filename)
        if (!where) return {}
        const base = filename.split("/").at(-1)
        const isDefinition = base.endsWith(".module-definition.ts")
        const isModuleFile = base.endsWith(".module.ts")
        if (where.tier === "feature" && isDefinition) return { Program: (program) => context.report({ node: program, loc: { line: 1, column: 0 }, messageId: "featureDefinition" }) }
        if (CAPABILITY_TIERS.has(where.tier) && isDefinition) {
            return {
                Program(program) {
                    let found = false
                    walk(program, (node) => {
                        if (node.type !== "NewExpression" || node.callee.type !== "Identifier" || node.callee.name !== "ConfigurableModuleBuilder") return
                        found = true
                        const calls = builderChain(node)
                        const extras = calls.find((entry) => entry.name === "setExtras")
                        const defaults = extras?.call.arguments[0]
                        const localByDefault =
                            defaults?.type === "ObjectExpression" &&
                            defaults.properties.some((item) => item.type === "Property" && keyName(item.key) === "isGlobal" && item.value.type === "Literal" && item.value.value === false)
                        const missing = []
                        if (!localByDefault) missing.push("`.setExtras({ isGlobal: false }, ...)` is missing or does not default `isGlobal` to a literal `false`")
                        if (calls.at(-1)?.name !== "build") missing.push("the chain does not end in `.build()`")
                        if (missing.length > 0) context.report({ node, messageId: "chain", data: { missing: missing.join("; ") } })
                    })
                    if (!found) context.report({ node: program, loc: { line: 1, column: 0 }, messageId: "chain", data: { missing: "no `new ConfigurableModuleBuilder<XOptions>()` is built here" } })
                },
            }
        }
        if (!isModuleFile || (where.tier !== "feature" && !CAPABILITY_TIERS.has(where.tier))) return {}
        const importedFrom = new Map()
        const representative = CAPABILITY_TIERS.has(where.tier) && where.inside === `${where.name}.module.ts`
        return {
            ClassDeclaration(node) {
                if (!isModuleClass(node)) return
                if (!representative) {
                    const hasRegister = node.body.body.some((member) => member.type === "MethodDefinition" && member.key.type === "Identifier" && member.key.name === "register")
                    if (node.superClass || hasRegister) context.report({ node: node.id ?? node, messageId: "plain", data: { class: node.id?.name ?? "This class", name: where.name } })
                    return
                }
                const base = node.superClass
                const imported = base?.type === "Identifier" ? importedFrom.get(base.name) : null
                if (imported?.name !== "ConfigurableModuleClass" || imported.source !== `./${where.name}.module-definition`) {
                    context.report({ node: node.id ?? node, messageId: "extendsBase", data: { name: where.name } })
                }
                for (const member of node.body.body) {
                    if (member.type === "MethodDefinition" && member.key.type === "Identifier" && member.key.name === "register" && !isRegisterOverride(member)) {
                        context.report({ node: member, messageId: "registerSignature", data: { name: where.name } })
                    }
                }
            },
            ImportDeclaration(node) {
                for (const specifier of node.specifiers) {
                    if (specifier.type === "ImportSpecifier") importedFrom.set(specifier.local.name, { name: specifier.imported.name ?? specifier.imported.value, source: String(node.source.value) })
                }
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "no-global-decorator": noGlobalDecorator,
    "is-global-only-in-app": isGlobalOnlyInApp,
    "no-cross-owner-module-import": noCrossOwnerModuleImport,
    "capability-module-shape": capabilityModuleShape,
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
    "starci-be/capability-module-shape": "error",
    "starci-be/typed-module-definition": "error",
    "starci-be/static-module-register": "error",
    "starci-be/no-new-injectable": "error",
    "starci-be/no-module-let": "error",
    "starci-be/one-module-per-file": "error",
}
