/**
 * The rules that hold the composition files of a back-end app (catalog R245 `BE_APP_OPTIONS_COMPOSITION`, R265
 * `BE_COMPOSITION_UNTYPED` and R246
 * `BE_APP_COMPOSITION_BUDGET`, owner ruling 2026-10-14). An app's `src/` holds five roles, named by the entries of its `be.app.*` slot (`lib/app-roles.mjs`):
 * `main.ts`, `app.module.ts`, `<app>.env.ts`, `<app>.options.ts` and the composition groups `compose/<area>.ts`.
 *
 *   - `app-options-composition-free` (`BE_APP_OPTIONS_COMPOSITION`) keeps `<app>.env.ts` to typed, fail-fast environment
 *     parsing only and `<app>.options.ts` to options types and port bindings (provider maps such as `{ approvalGate: X }`): an array that lists Nest modules (a
 *     `*Module` class, a `X.register(...)`/`forRoot(...)`/`registerQueue(...)` call), queue registrations or scheduler entries
 *     (a `*SchedulerOf(...)`, `*Scheduler(...)` or `*Queue(...)` call), a spread of such a list, and an `imports`, `modules`,
 *     `schedulers` or `processors` array are refused. Those lists are composition: they live in `compose/<area>.ts`, one
 *     group per area, which `app.module.ts` spreads. The env role also refuses registration and scheduler calls outside arrays.
 *     `config-owner.mjs` keeps process environment access and owned `EnvSource` reads in `main.ts` or the matching env role;
 *     options files and composition groups receive the typed result of `read<App>Env(env: EnvSource)`.
 *   - `app-file-budget` (`BE_APP_COMPOSITION_BUDGET`) holds each composition file to the line budget its app slot names
 *     (`budget` of the slot, keyed by the same entry: `app.module.ts` 250, `<app>.env.ts` 150, `<app>.options.ts` 200, `compose/<area>.ts` 120,
 *     `main.ts` 80). The budget is absolute, not a ratchet: an app root that outgrows it moves an area into a new group.
 *
 * R265 resolves composition from types, including renamed constructors, factories, maps and scheduler tables. All
 * three rules ask the slot view which entry a file matches; none keeps a path of its own.
 */
import { lineCount } from "./runtime/scripts/lib/line-count.mjs"
import ts from "typescript"
import { APP_ENV_ROLE, APP_OPTIONS_ROLE, appRoleOf } from "./lib/app-roles.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { isOwnedBy } from "./lib/declared.mjs"
import { keyName, staticText } from "./lib/ast.mjs"
import { isDeclarationFile, normalizePath } from "./lib/path.mjs"
import { moduleOf, originsOfType, packageOfExport, typed } from "./lib/types.mjs"

/** Static factories that register a Nest module (a dynamic module), a queue or a flow producer. */
const REGISTRATION_CALLS = new Set([
    "register",
    "registerAsync",
    "forRoot",
    "forRootAsync",
    "forFeature",
    "forFeatureAsync",
    "registerQueue",
    "registerQueueAsync",
    "registerFlowProducer",
])

/** Keys whose array value is a composition list whatever it holds. */
const COMPOSITION_KEYS = new Set(["imports", "modules", "schedulers", "processors"])

/** A name that is a Nest module class. */
const MODULE_NAME = /Module$/
/** A name that is a list of modules, queues, schedulers or processors (the operand of a spread). */
const LIST_NAME = /(?:Modules|Queues|Schedulers|Processors)$/
/** A call that builds a scheduler entry or a queue registration: `orderExpirySchedulerOf(...)`, `ordersQueue(...)`. */
const ENTRY_CALL = /(?:Scheduler|Queue)(?:Of)?$/

/** Type-only wrappers do not change whether an expression composes modules. */
const WRAPPERS = new Set(["TSAsExpression", "TSTypeAssertion", "TSSatisfiesExpression", "TSNonNullExpression", "TSInstantiationExpression", "ChainExpression"])
const unwrap = (node) => {
    while (node && WRAPPERS.has(node.type)) node = node.expression
    return node
}

/** The known name of a member, including a static computed string. */
const memberName = (node) => node.computed ? staticText(node.property) : keyName(node.property)

/** The last name of an identifier or a statically named member expression, else null. */
const lastName = (node) => {
    node = unwrap(node)
    if (node?.type === "Identifier") return node.name
    if (node?.type === "MemberExpression") return memberName(node)
    return null
}

/** What an array element composes (`module`, `registration`, `scheduler`, `list`), or null when it is plain options data. */
const compositionOf = (element) => {
    element = unwrap(element)
    if (!element) return null
    if (element.type === "SpreadElement") {
        const argument = unwrap(element.argument)
        const spread = argument?.type === "CallExpression" ? lastName(argument.callee) : lastName(argument)
        return spread !== null && (LIST_NAME.test(spread) || MODULE_NAME.test(spread)) ? "list" : null
    }
    if (element.type === "CallExpression") {
        const callee = unwrap(element.callee)
        if (callee.type === "MemberExpression" && REGISTRATION_CALLS.has(memberName(callee))) return "registration"
        const name = lastName(callee)
        return name !== null && ENTRY_CALL.test(name) ? "scheduler" : null
    }
    const name = lastName(element)
    return name !== null && MODULE_NAME.test(name) ? "module" : null
}

/** Env parsing and options bindings hold no module, queue or scheduler composition. */
export const appOptionsCompositionFree = {
    meta: {
        type: "problem",
        docs: { description: "`<app>.env.ts` holds environment parsing only and `<app>.options.ts` holds options types and port bindings; module, queue and scheduler composition lives in `compose/<area>.ts`." },
        schema: [],
        messages: {
            list: "`{{key}}` is a composition list in {{role}}. `<app>.env.ts` holds typed, fail-fast environment parsing only and `<app>.options.ts` holds options types and port bindings; move this list into `apps/<app>/src/compose/<area>.ts` (one group per area) and spread the group in `app.module.ts`.",
            element: "This array lists a {{what}} in {{role}}. `<app>.env.ts` holds environment parsing only and `<app>.options.ts` holds options types and port bindings; module lists, queue registrations and scheduler entries live in `apps/<app>/src/compose/<area>.ts`, which `app.module.ts` spreads.",
            call: "This {{what}} composes modules, queues or schedulers in `<app>.env.ts`. Keep typed, fail-fast environment parsing here and move composition into `apps/<app>/src/compose/<area>.ts`, which `app.module.ts` spreads.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const role = appRoleOf(hfsOf(context), filename)?.entry
        if (role !== APP_OPTIONS_ROLE && role !== APP_ENV_ROLE) return {}
        const judged = new WeakSet()
        return {
            CallExpression(node) {
                if (role !== APP_ENV_ROLE) return
                let element = node
                while (WRAPPERS.has(element.parent?.type)) element = element.parent
                if (element.parent?.type === "ArrayExpression") return
                const what = compositionOf(node)
                if (what !== "registration" && what !== "scheduler") return
                context.report({ node, messageId: "call", data: { what: what === "registration" ? "registration call" : "scheduler or queue call" } })
            },
            Property(node) {
                const value = unwrap(node.value)
                if (value?.type !== "ArrayExpression") return
                const key = node.computed ? staticText(node.key) : keyName(node.key)
                if (key === null || !COMPOSITION_KEYS.has(key)) return
                judged.add(value)
                context.report({ node, messageId: "list", data: { key, role } })
            },
            "ArrayExpression:exit"(node) {
                if (judged.has(node)) return
                const what = node.elements.map(compositionOf).find((kind) => kind !== null)
                if (what === undefined) return
                const label = { module: "Nest module", registration: "module or queue registration", scheduler: "scheduler or queue entry", list: "spread of a module, queue or scheduler list" }[what]
                context.report({ node, messageId: "element", data: { what: label, role } })
            },
        }
    },
}

/** Composition is a value's type, independent of the spelling of its class, factory or helper. */
const compositionTypes = (checker) => {
    const propertyType = (type, name) => {
        const property = type.getProperty(name)
        const declaration = property?.valueDeclaration ?? property?.getDeclarations?.()?.[0]
        return declaration ? checker.getTypeOfSymbolAtLocation(property, declaration) : null
    }
    const constructor = (type) => (type?.getConstructSignatures().length ?? 0) > 0
    const dynamicModule = (type) => constructor(propertyType(type, "module"))
    const moduleConstructor = (type) => {
        if (!constructor(type)) return false
        for (const declaration of type.getSymbol()?.getDeclarations?.() ?? []) {
            if (!ts.isClassDeclaration(declaration) && !ts.isClassExpression(declaration)) continue
            for (const decorator of ts.getDecorators(declaration) ?? []) {
                const expression = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression
                const symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(expression) ? expression.name : expression)
                const resolved = symbol?.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
                if (resolved?.name === "Module" && resolved.getDeclarations()?.some((origin) => moduleOf(origin, normalizePath(origin.getSourceFile().fileName)) === "@nestjs/common")) return true
            }
        }
        // A factory returning DynamicModule identifies a module even if it has no decorator or conventional name.
        return type.getProperties().some((property) => {
            const factory = propertyType(type, property.name)
            return factory?.getCallSignatures().some((signature) => dynamicModule(checker.getReturnTypeOfSignature(signature)))
        })
    }
    const arrayElement = (type) => checker.isArrayType(type) || checker.isTupleType(type)
        ? checker.getIndexTypeOfType(type, ts.IndexKind.Number)
        : type.getSymbol()?.name === "ReadonlyArray" ? checker.getTypeArguments(type)[0] : null
    const MAX_DEPTH = 12
    const contains = (type, constructors = false, seen = new Set(), depth = 0) => {
        // A library type graph (the application, an HTTP adapter) can be deep and cyclic through member types: a bounded walk never overflows the stack.
        if (depth > MAX_DEPTH) return false
        if (!type || seen.has(type) || type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.TypeParameter)) return false
        seen.add(type)
        if (type.isUnionOrIntersection()) return type.types.some((part) => contains(part, constructors, new Set(seen), depth + 1))
        // Async bootstrap returns Promise<void>; walk its result rather than recursively instantiating .then/.catch.
        const awaited = checker.getAwaitedType(type)
        if (awaited && awaited !== type) return contains(awaited, constructors, seen, depth + 1)
        const origins = originsOfType(checker, type)
        if (origins.some((origin) => origin.module === "@nestjs/common" && ["DynamicModule", "Type", "Provider"].includes(origin.name))) return true
        if (constructor(type)) return constructors || moduleConstructor(type)
        if (dynamicModule(type)) return true
        const properties = new Set(type.getProperties().map((property) => property.name))
        if (properties.has("provide") && ["useClass", "useFactory", "useValue", "useExisting"].some((key) => properties.has(key))) return true
        if (properties.has("queue") && ["cron", "everyMs", "pattern", "repeat"].some((key) => properties.has(key))) return true
        // Primitive options values and their library methods never compose an app.
        if (!(type.flags & ts.TypeFlags.Object)) return false
        const element = arrayElement(type)
        if (element) return contains(element, true, seen, depth + 1)
        // Index signatures retain the Type<unknown> contract of a module map, unlike a plain adapter port map.
        for (const index of checker.getIndexInfosOfType(type)) {
            if (contains(index.type, false, new Set(seen), depth + 1)) return true
        }
        for (const signature of type.getCallSignatures()) {
            if (contains(checker.getReturnTypeOfSignature(signature), false, new Set(seen), depth + 1)) return true
        }
        return type.getProperties().some((property) => contains(propertyType(type, property.name), false, new Set(seen), depth + 1))
    }
    const typedList = (type) => {
        const element = arrayElement(type)
        if (!element || element.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return false
        const parts = element.isUnion() ? element.types : [element]
        return parts.every((part) => contains(part, true))
    }
    return { arrayElement, contains, typedList }
}

/** R265: app values compose only in typed groups, never in env/options/bootstrap lists. */
export const appCompositionTyped = {
    meta: {
        type: "problem",
        docs: { description: "Module, provider, queue and scheduler composition is judged by its resolved type and lives in typed compose groups." },
        schema: [],
        messages: {
            outside: "[BE_COMPOSITION_UNTYPED] This value composes modules, providers, queues or schedules in `{{role}}`. Move it into a typed `compose/<area>.ts` group and spread the group in `app.module.ts`.",
            group: "[BE_COMPOSITION_UNTYPED] Declare this composition group's array type or return type explicitly (for example `Array<DynamicModule | Type<unknown>>`); every element must be a module, provider, queue or scheduler entry.",
            business: "[BE_APP_BUSINESS_ROLE] Composition groups only wire modules, providers, queues and schedules. Move business functions and branching into their owning feature or module.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const role = appRoleOf(hfsOf(context), filename)?.entry
        if (![APP_ENV_ROLE, APP_OPTIONS_ROLE, "main.ts", "compose/<area>.ts"].includes(role)) return {}
        const { checker, toTs } = typed(context)
        const { arrayElement, contains, typedList } = compositionTypes(checker)
        const reported = new WeakSet()
        const hasReport = (node) => {
            for (let ancestor = node; ancestor; ancestor = ancestor.parent) if (reported.has(ancestor)) return true
            return false
        }
        const report = (node, messageId) => {
            if (hasReport(node)) return
            reported.add(node)
            context.report({ node, messageId, data: { role } })
        }
        const typeOf = (node) => checker.getTypeAtLocation(toTs(node))
        const bootstrapArgument = (node) => {
            // The root module's registration belongs here; inline lists and metadata still belong in compose/.
            if (role !== "main.ts" || node.type !== "CallExpression") return false
            let expression = node
            while (WRAPPERS.has(expression.parent?.type)) expression = expression.parent
            const parent = expression.parent
            return parent?.type === "CallExpression" && parent.arguments.includes(expression)
                && parent.callee.type === "MemberExpression"
                && ["create", "createApplicationContext", "createMicroservice"].includes(memberName(parent.callee))
                && (packageOfExport(context, parent.callee) === "@nestjs/core" || packageOfExport(context, parent.callee.object) === "@nestjs/core")
        }
        const checkValue = (node) => {
            if (role === "compose/<area>.ts" || hasReport(node) || bootstrapArgument(node)) return
            if (contains(typeOf(node))) report(node, "outside")
        }
        const checkGroup = (node, value, annotation) => {
            if (role !== "compose/<area>.ts") return
            const type = typeOf(value)
            const signatures = type.getCallSignatures()
            const result = signatures.length ? checker.getReturnTypeOfSignature(signatures[0]) : type
            if (signatures.length && !arrayElement(result) && !contains(result)) {
                report(node, "business")
                return
            }
            if (!annotation || !typedList(result)) report(node, "group")
        }
        const annotationOf = (node) => {
            if (!node) return null
            if (node.type === "TSSatisfiesExpression") return node.typeAnnotation
            if (WRAPPERS.has(node.type)) return annotationOf(node.expression)
            if (node.type === "VariableDeclarator") return node.id.typeAnnotation ?? annotationOf(node.init)
            if (node.returnType) return node.returnType
            if (node.type !== "Identifier") return null
            const symbol = checker.getSymbolAtLocation(toTs(node))
            const resolved = symbol?.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
            return resolved?.getDeclarations()?.some((declaration) => {
                const initializer = declaration.initializer
                return declaration.type || initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer) || ts.isSatisfiesExpression(initializer)) && initializer.type
            }) ?? false
        }
        return {
            ExportNamedDeclaration(node) {
                if (role !== "compose/<area>.ts" || node.exportKind === "type") return
                const declaration = node.declaration
                if (!declaration) {
                    for (const specifier of node.specifiers) {
                        if (specifier.exportKind !== "type") checkGroup(specifier, specifier.local, annotationOf(specifier.local))
                    }
                    return
                }
                if (declaration.type === "FunctionDeclaration" && declaration.body) checkGroup(declaration, declaration, declaration.returnType)
                if (declaration.type !== "VariableDeclaration") return
                for (const binding of declaration.declarations) {
                    if (!binding.init) continue
                    checkGroup(binding, binding.id, annotationOf(binding))
                }
            },
            ExportDefaultDeclaration(node) {
                if (role === "compose/<area>.ts") checkGroup(node, node.declaration, annotationOf(node.declaration))
            },
            VariableDeclarator(node) {
                if (node.init) checkValue(node.init)
            },
            FunctionDeclaration(node) {
                if (node.body && role !== "compose/<area>.ts" && contains(typeOf(node))) report(node, "outside")
            },
            ArrowFunctionExpression(node) {
                if (role !== "compose/<area>.ts" || hasReport(node)) return
                const signature = typeOf(node).getCallSignatures()[0]
                if (signature && !contains(checker.getReturnTypeOfSignature(signature))) report(node, "business")
            },
            IfStatement(node) { if (role === "compose/<area>.ts") report(node, "business") },
            SwitchStatement(node) { if (role === "compose/<area>.ts") report(node, "business") },
            ConditionalExpression(node) { if (role === "compose/<area>.ts") report(node, "business") },
            ForStatement(node) { if (role === "compose/<area>.ts") report(node, "business") },
            ForOfStatement(node) { if (role === "compose/<area>.ts") report(node, "business") },
            WhileStatement(node) { if (role === "compose/<area>.ts") report(node, "business") },
            ArrayExpression: checkValue,
            ObjectExpression: checkValue,
            CallExpression: checkValue,
            ReturnStatement(node) {
                if (node.argument) checkValue(node.argument)
            },
        }
    },
}

/** Resolve an imported or local binding without relying on its local spelling. */
const resolvedSymbol = (checker, node) => {
    const symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node) ? node.name : node)
    return symbol?.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
}

/** The app's declared name comes from its matching env filename, not its kind's slot name. */
const appEnvNames = (filename, role) => {
    const root = filename.slice(0, filename.lastIndexOf("/"))
    const app = role === APP_ENV_ROLE ? filename.split("/").at(-1).slice(0, -".env.ts".length) : root.split("/").at(-2)
    const pascal = app.replace(/(?:^|[-_])([a-z\d])/g, (_, letter) => letter.toUpperCase())
    return { file: `${root}/${app}.env.ts`, reader: `read${pascal}Env` }
}

/** R289: the typed app env reader owns parsing; main acquires one source and delegates once. */
export const appEnvRequired = {
    meta: {
        type: "problem",
        docs: { description: "Every app exports its typed EnvSource reader; main builds one source and delegates parsing to that reader." },
        schema: [],
        messages: {
            shape: "[BE_APP_ENV_REQUIRED] Export an environment interface and `{{reader}}(env: EnvSource)` returning that interface from the matching app env file.",
            inline: "[BE_APP_ENV_REQUIRED] Bootstrap builds EnvSource once and delegates environment parsing only to the matching app env reader. Move this environment read or parser into `<app>.env.ts`.",
            delegate: "[BE_APP_ENV_REQUIRED] Main must build EnvSource once and call `{{reader}}` from `{{file}}` with that source once.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const hfs = hfsOf(context)
        const role = appRoleOf(hfs, filename)?.entry
        if (role !== APP_ENV_ROLE && role !== "main.ts") return {}
        const { checker, toTs } = typed(context)
        const names = appEnvNames(filename, role)
        const ownedEnv = (type) => originsOfType(checker, type).some((origin) => origin.name === "EnvSource" && isOwnedBy(hfs, origin.file, "platform", "config"))
        const envValue = (node) => node && ownedEnv(checker.getTypeAtLocation(toTs(node)))
        const matchingReader = (node) => {
            const symbol = resolvedSymbol(checker, toTs(node))
            return symbol?.name === names.reader && symbol.getDeclarations()?.some((declaration) => normalizePath(declaration.getSourceFile().fileName) === names.file)
        }
        const envContract = (node) => {
            const source = toTs(node)
            if (!source.symbol) return false
            const exported = checker.getExportsOfModule(source.symbol)
            const reader = exported.find((symbol) => symbol.name === names.reader)
            const declaration = reader?.valueDeclaration ?? reader?.getDeclarations()?.[0]
            if (!declaration) return false
            const signatures = checker.getTypeOfSymbolAtLocation(reader, declaration).getCallSignatures()
            return signatures.some((signature) => {
                const parameters = signature.getParameters()
                if (parameters.length !== 1 || !signature.declaration?.type) return false
                const parameter = parameters[0]
                if (!parameter.valueDeclaration?.type || !ownedEnv(checker.getTypeOfSymbolAtLocation(parameter, parameter.valueDeclaration))) return false
                const result = checker.getReturnTypeOfSignature(signature)
                return result.getSymbol()?.getDeclarations()?.some((item) => ts.isInterfaceDeclaration(item)
                    && item.getSourceFile() === source && exported.some((symbol) => symbol.name === item.name.text))
            })
        }
        let sources = 0
        let delegates = 0
        let inline = false
        const reported = new WeakSet()
        const reportInline = (node) => {
            for (let parent = node; parent; parent = parent.parent) if (reported.has(parent)) return
            reported.add(node)
            inline = true
            context.report({ node, messageId: "inline" })
        }
        return {
            CallExpression(node) {
                if (role !== "main.ts") return
                const declaration = checker.getResolvedSignature(toTs(node))?.declaration
                if (declaration && ts.isMethodDeclaration(declaration) && declaration.name.getText() === "fromProcess"
                    && envValue(node) && isOwnedBy(hfs, normalizePath(declaration.getSourceFile().fileName), "platform", "config")) {
                    sources += 1
                    if (sources > 1 || node.arguments.length) reportInline(node)
                    return
                }
                if (matchingReader(node.callee) && node.arguments.length === 1 && envValue(node.arguments[0])) {
                    delegates += 1
                    if (delegates > 1) reportInline(node)
                    return
                }
                const callee = unwrap(node.callee)
                if (callee.type === "MemberExpression" && envValue(callee.object) || node.arguments.some(envValue)) reportInline(node)
            },
            MemberExpression(node) {
                if (role !== "main.ts") return
                if (memberName(node) === "env" && lastName(node.object) === "process") reportInline(node)
                if (envValue(node.object) && !node.parent?.type.startsWith("CallExpression") && memberName(node) !== "fromProcess") reportInline(node)
            },
            "Program:exit"(node) {
                if (role === APP_ENV_ROLE) {
                    if (!envContract(node)) context.report({ node, messageId: "shape", data: names })
                } else if (!inline && (sources !== 1 || delegates !== 1)) context.report({ node, messageId: "delegate", data: names })
            },
        }
    },
}

/** R289: module lists in the app root contain only spreads of its own compose groups. */
export const appModuleListInline = {
    meta: {
        type: "problem",
        docs: { description: "The app root spreads compose groups; its only inline provider registrations are app-wide guards and filters." },
        schema: [],
        messages: {
            inline: "[BE_APP_MODULE_LIST_INLINE] Move module, provider, queue or schedule entries into typed `compose/<area>.ts` groups and spread those groups here. Only app-wide guards and filters may be inline.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const hfs = hfsOf(context)
        if (appRoleOf(hfs, filename)?.entry !== "app.module.ts") return {}
        const { checker, toTs } = typed(context)
        const { contains } = compositionTypes(checker)
        const composeRoot = filename.slice(0, filename.lastIndexOf("/")) + "/compose/"
        const groupSpread = (node) => {
            if (node.type !== "SpreadElement") return false
            const value = unwrap(node.argument)
            const reference = value.type === "CallExpression" ? unwrap(value.callee) : value
            const symbol = resolvedSymbol(checker, toTs(reference))
            return symbol?.getDeclarations()?.some((declaration) => {
                const file = normalizePath(declaration.getSourceFile().fileName)
                return file.startsWith(composeRoot) && appRoleOf(hfs, file)?.entry === "compose/<area>.ts"
            }) ?? false
        }
        const globalProvider = (node) => {
            node = unwrap(node)
            if (node?.type !== "ObjectExpression") return false
            const binding = node.properties.find((property) => property.type === "Property" && keyName(property.key) === "provide")
            const value = binding && unwrap(binding.value)
            if (!value || !["APP_GUARD", "APP_FILTER"].includes(resolvedSymbol(checker, toTs(value))?.name)) return false
            return packageOfExport(context, value) === "@nestjs/core"
        }
        return {
            ArrayExpression(node) {
                const parent = node.parent
                const key = parent?.type === "Property" ? parent.computed ? staticText(parent.key) : keyName(parent.key) : null
                if (![...COMPOSITION_KEYS, "providers"].includes(key) && !contains(checker.getTypeAtLocation(toTs(node)))) return
                const violation = node.elements.find((element) => !element || !groupSpread(element) && !(key === "providers" && globalProvider(element)))
                if (violation || node.elements.includes(null)) context.report({ node: violation ?? node, messageId: "inline" })
            },
        }
    },
}

/** Each composition file of an app stays within the line budget its app slot names. */
export const appFileBudget = {
    meta: {
        type: "problem",
        docs: { description: "`main.ts`, `app.module.ts`, `<app>.env.ts`, `<app>.options.ts` and `compose/<area>.ts` stay within the line budget of their app slot." },
        schema: [],
        messages: {
            over: "This {{role}} has {{lines}} lines, over its budget of {{max}} (the `budget` of slot {{slot}}). {{fix}}",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const hfs = hfsOf(context)
        const role = appRoleOf(hfs, filename)
        const max = role ? hfs.slot(role.slot)?.budget?.[role.entry] : undefined
        if (!Number.isInteger(max)) return {}
        const fix = role.entry === APP_ENV_ROLE
            ? "Keep typed, fail-fast environment parsing only here; move module composition into `compose/<area>.ts` and business code into its owning module."
            : role.entry === APP_OPTIONS_ROLE
            ? "Keep options types and port bindings here; move environment parsing into `<app>.env.ts` and module, queue or scheduler lists into `compose/<area>.ts`."
            : role.entry === "main.ts"
            ? "Move environment parsing into `<app>.env.ts` and module composition into `compose/<area>.ts`; keep the bootstrap here."
            : "Move one area of the composition into its own group `apps/<app>/src/compose/<area>.ts` and spread it in `app.module.ts`."
        return {
            "Program:exit"(node) {
                const lines = lineCount((context.sourceCode || context.getSourceCode()).text)
                if (lines > max) context.report({ node, loc: { line: 1, column: 0 }, messageId: "over", data: { role: role.entry, lines, max, slot: role.slot, fix } })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "app-options-composition-free": appOptionsCompositionFree,
    "app-composition-typed": appCompositionTyped,
    "app-env-required": appEnvRequired,
    "app-module-list-inline": appModuleListInline,
    "app-file-budget": appFileBudget,
}

/** Every rule starts at error; an app already over a budget migrates its lists into compose/. */
export const recommended = {
    "starci-be/app-options-composition-free": "error",
    "starci-be/app-composition-typed": "error",
    "starci-be/app-env-required": "error",
    "starci-be/app-module-list-inline": "error",
    "starci-be/app-file-budget": "error",
}
