/**
 * The rules that hold BE-CONVENTION 1.5 (R87 `BE_CQRS_SHAPE`).
 *
 * The application layer is CQRS and nothing else: a typed message (`Command<R>` / `Query<R>` carrying one `params`), a
 * handler that extends the `ICQRSHandler` template and implements `process`, and no use-case class, no forwarder
 * service and no in-process event.
 *
 * Every rule reads its scope from the HFS slot view (`be.feature.application`, `be.transport.*`) and identifies what it
 * judges by its TYPE or by the import that binds it: a handler is a class decorated with `CommandHandler` /
 * `QueryHandler` imported from `@nestjs/cqrs`, its template is the `ICQRSHandler` declared by the `platform/cqrs`
 * capability, a bus is a receiver typed `CommandBus` / `QueryBus`, an entity is a class decorated with `Entity` from
 * `typeorm`. No rule matches a variable name, a class name or a directory spelled in a path pattern.
 */
import ts from "typescript"
import { decoratorCallee, importOf, isImportedFrom, moduleReferences } from "./lib/import-source.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { walk } from "./lib/ast.mjs"
import { isLoggerType } from "./lib/ports.mjs"
import { isTransportSlot } from "./lib/transport-slots.mjs"
import { isPackageType, typeOrigins, typed } from "./lib/types.mjs"

/** The slot that holds messages and handlers. */
const APPLICATION = "be.feature.application"

/** The slots that hold application-layer code (the support folder is the same layer). */
const APPLICATION_LAYER = new Set([APPLICATION, "be.feature.application.support"])

/** The package that owns the CQRS types. */
const CQRS_PACKAGE = "@nestjs/cqrs"

/** The base name of a filename. */
const baseName = (filename) => String(filename).replaceAll("\\", "/").split("/").pop()

/** The bus receivers of `@nestjs/cqrs`. */
const isBus = (context, node) => isPackageType(context, node, "CommandBus", CQRS_PACKAGE) || isPackageType(context, node, "QueryBus", CQRS_PACKAGE)

/** True when a declaration file belongs to the capability `capability` of a platform slot. */
const declaredByCapability = (hfs, file, capability) => {
    if (hfs.slotOf(file) !== "be.platform") return false
    const owner = hfs.ownerOf(file)
    return owner !== null && owner.split("/").pop() === capability
}

/** The classes a file declares. */
const classVisitors = (visit) => ({ ClassDeclaration: visit, ClassExpression: visit })

/** The constructor of a class body, or undefined. */
const constructorOf = (node) => node.body.body.find((member) => member.type === "MethodDefinition" && member.kind === "constructor")

/** The message kind (`command` / `query`) of a file in the application slot, or null. */
const messageKindOf = (context) => {
    const filename = context.filename
    const name = baseName(filename)
    const kind = name.endsWith(".command.ts") ? "command" : name.endsWith(".query.ts") ? "query" : null
    if (kind === null) return null
    return hfsOf(context).slotOf(filename) === APPLICATION ? kind : null
}

// -- handler-overrides-process -----------------------------------------------------------------------------------

/** True when the class (transitively) extends the `ICQRSHandler` of `platform/cqrs`. */
const extendsTemplate = (context, node, hfs) => {
    const { checker, toTs } = typed(context)
    const seen = new Set()
    const reaches = (type) => {
        if (!type || seen.has(type)) return false
        seen.add(type)
        const symbol = type.getSymbol?.()
        if (symbol?.getName() === "ICQRSHandler" && (symbol.getDeclarations() ?? []).some((declaration) => declaredByCapability(hfs, declaration.getSourceFile().fileName, "cqrs"))) return true
        return (checker.getBaseTypes(type.target ?? type) ?? []).some(reaches)
    }
    return reaches(checker.getTypeAtLocation(toTs(node)))
}

/** True when `process` is still the template's abstract member (no class of the chain implemented it). */
const processIsAbstract = (context, node) => {
    const { checker, toTs } = typed(context)
    const symbol = checker.getPropertyOfType(checker.getTypeAtLocation(toTs(node)), "process")
    const declarations = symbol?.getDeclarations() ?? []
    return declarations.every((declaration) => (ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Abstract) !== 0)
}

/** A handler implements the template's `process` and never overrides its public `execute`. */
export const handlerOverridesProcess = {
    meta: {
        type: "problem",
        docs: { description: "A CQRS handler extends `ICQRSHandler` and overrides `process`, never `execute`." },
        schema: [],
        messages: {
            overridesExecute: "`{{name}}` overrides `execute`, which takes it out of the template method in `ICQRSHandler` (the one place that logs and counts a failed operation). It compiles and runs, so nothing goes red. Rename it to `protected override async process(...)`.",
            notTemplate: "`{{name}}` is a command or query handler that does not extend the `ICQRSHandler` of `platform/cqrs`. Extend `ICQRSHandler<Message, Result>` so every handler shares one `execute` that logs the failed operation.",
            noProcess: "`{{name}}` extends `ICQRSHandler` but implements no `process`; the template declares it abstract and calls it from `execute`. Add `protected override async process(message): Promise<Result>`.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        if (hfs.slotOf(context.filename) !== APPLICATION) return {}
        return classVisitors((node) => {
            if (!(node.decorators ?? []).some((decorator) => isImportedFrom(context, decoratorCallee(decorator), CQRS_PACKAGE, ["CommandHandler", "QueryHandler"]))) return
            const name = node.id?.name ?? "this handler"
            const own = (member) => node.body.body.find((candidate) => candidate.type === "MethodDefinition" && candidate.key?.type === "Identifier" && candidate.key.name === member)
            const execute = own("execute")
            if (execute) {
                context.report({ node: execute.key, messageId: "overridesExecute", data: { name } })
                return
            }
            if (!extendsTemplate(context, node, hfs)) {
                context.report({ node: node.id ?? node, messageId: "notTemplate", data: { name } })
                return
            }
            if (!own("process") && processIsAbstract(context, node)) context.report({ node: node.id ?? node, messageId: "noProcess", data: { name } })
        })
    },
}

// -- handler-is-thin ---------------------------------------------------------------------------------------------

/** Statements and expressions that are a decision or a repetition: none of them belongs in a handler. */
const DECISION_NODES = new Set(["IfStatement", "SwitchStatement", "ConditionalExpression", "LogicalExpression", "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement", "TryStatement", "ThrowStatement"])

/** The one collaborator a handler may hold: a domain service (a class named `*Service` declared in a `*.service.ts` file) or a projection (a class declared in a `*.projection.ts` file of slot `be.projections`). */
const isServiceType = (context, hfs, annotation) => typeOrigins(context, annotation).some((origin) => origin.module === null
    && ((origin.name.endsWith("Service") && origin.file.endsWith(".service.ts")) || (origin.file.endsWith(".projection.ts") && hfs.slotOf(origin.file) === "be.projections")))

/** The injected members of a class: constructor parameters and decorated properties, with the type annotation of each. */
const injectedMembers = (node) => {
    const members = []
    const constructor = constructorOf(node)
    for (const original of constructor?.value.params ?? []) {
        const param = original.type === "TSParameterProperty" ? original.parameter : original
        members.push({ report: original, param, name: original.type === "TSParameterProperty" && param.type === "Identifier" ? param.name : null, annotation: param.typeAnnotation?.typeAnnotation })
    }
    for (const member of node.body.body) {
        if (member.type !== "PropertyDefinition" || (member.decorators ?? []).length === 0) continue
        members.push({ report: member, param: member, name: member.key.type === "Identifier" ? member.key.name : null, annotation: member.typeAnnotation?.typeAnnotation })
    }
    return members
}

/** A handler maps its input, calls exactly one method of an injected service and returns its result. */
export const handlerIsThin = {
    meta: {
        type: "problem",
        docs: { description: "A CQRS handler injects only `*Service` classes or projections (and the template's Logger) and its `process` is one `return this.<service>.<method>(...)`." },
        schema: [],
        messages: {
            dependency: "`{{what}}` is injected into a handler. A handler holds services or projections (and the Logger the `ICQRSHandler` template needs) and nothing else: an `EntityManager`, a bus, a client or any other infrastructure is the business of a `*.service.ts`, which is the one file that is unit-tested. Move the work into a service and inject that.",
            branch: "`{{what}}` is a decision or a loop in a handler. The `process` of a handler only maps its input and returns what one service method answers; every branch belongs in the service, where it is covered by the service spec.",
            body: "`process` of `{{name}}` must be the single statement `return this.<service>.<method>(<mapped input>)` (with or without `await`). Any other statement is logic that no unit spec covers: move it into the service.",
            call: "`process` of `{{name}}` must call exactly one method of an injected `*Service` and return its result: this makes {{count}} call(s), or calls something that is not an injected service.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        if (hfs.slotOf(context.filename) !== APPLICATION) return {}
        const sourceCode = context.sourceCode
        return classVisitors((node) => {
            if (!(node.decorators ?? []).some((decorator) => isImportedFrom(context, decoratorCallee(decorator), CQRS_PACKAGE, ["CommandHandler", "QueryHandler"]))) return
            const name = node.id?.name ?? "this handler"
            const services = new Set()
            for (const injected of injectedMembers(node)) {
                if (injected.annotation && isServiceType(context, hfs, injected.annotation)) {
                    if (injected.name !== null) services.add(injected.name)
                } else if (!injected.annotation || !isLoggerType(context, injected.annotation)) {
                    context.report({ node: injected.report, messageId: "dependency", data: { what: sourceCode.getText(injected.param) } })
                }
            }
            const method = node.body.body.find((member) => member.type === "MethodDefinition" && member.kind === "method" && member.key.type === "Identifier" && member.key.name === "process")
            const body = method?.value.body
            if (!body) return
            let calls = 0
            walk(body, (child) => {
                if (DECISION_NODES.has(child.type)) context.report({ node: child, messageId: "branch", data: { what: child.type === "LogicalExpression" ? child.operator : child.type.replace(/(Statement|Expression)$/, "").toLowerCase() } })
                else if (child.type === "CallExpression") calls += 1
            })
            const only = body.body.length === 1 && body.body[0].type === "ReturnStatement" ? body.body[0].argument : null
            if (only === null) {
                context.report({ node: method.key, messageId: "body", data: { name } })
                return
            }
            const call = only.type === "AwaitExpression" ? only.argument : only
            const callee = call.type === "CallExpression" ? call.callee : null
            const onService = callee?.type === "MemberExpression" && !callee.computed && callee.object.type === "MemberExpression" && !callee.object.computed && callee.object.object.type === "ThisExpression" && callee.object.property.type === "Identifier" && services.has(callee.object.property.name)
            if (calls !== 1 || !onService) context.report({ node: method.key, messageId: "call", data: { name, count: String(calls) } })
        })
    },
}

// -- message-carries-params-only ---------------------------------------------------------------------------------

/** A message carries request context and nothing else. */
export const messageCarriesParamsOnly = {
    meta: {
        type: "problem",
        docs: { description: "A command or query holds one `params` constructor parameter and declares nothing else." },
        schema: [],
        messages: {
            member: "`{{name}}` declares `{{member}}`. A message that computes has moved a decision into a file nobody reads for decisions, and two dispatchers would then disagree about what it means. Keep the message to its `params`; compute in the handler.",
            shape: "`{{name}}` does not carry exactly one constructor parameter named `params`. A message is the request context handed to the handler whole; several fields make every dispatcher assemble it differently.",
            body: "`{{name}}` runs code in its constructor. The body is `super()` and nothing else: a default or a computed field is a decision the handler should make.",
        },
    },
    create(context) {
        if (messageKindOf(context) === null) return {}
        return classVisitors((node) => {
            const name = node.id?.name ?? "this message"
            const members = node.body.body
            const constructor = constructorOf(node)
            for (const member of members) {
                if (member === constructor) continue
                const key = member.key?.type === "Identifier" ? member.key.name : "a member"
                context.report({ node: member.key ?? member, messageId: "member", data: { name, member: key } })
            }
            if (!constructor) {
                context.report({ node: node.id ?? node, messageId: "shape", data: { name } })
                return
            }
            const params = constructor.value.params
            const first = params[0]?.type === "TSParameterProperty" ? params[0].parameter : params[0]
            if (params.length !== 1 || first?.type !== "Identifier" || first.name !== "params") context.report({ node: constructor, messageId: "shape", data: { name } })
            const statements = constructor.value.body?.body ?? []
            const onlySuper = statements.every((statement) => statement.type === "ExpressionStatement" && statement.expression.type === "CallExpression" && statement.expression.callee.type === "Super")
            if (!onlySuper) context.report({ node: constructor, messageId: "body", data: { name } })
        })
    },
}

// -- message-typed-result ----------------------------------------------------------------------------------------

/** A message states the type of its result: `Command<R>` / `Query<R>` from `@nestjs/cqrs`, one readonly `params`. */
export const messageTypedResult = {
    meta: {
        type: "problem",
        docs: { description: "A message extends `Command<R>` / `Query<R>` from `@nestjs/cqrs` and declares `readonly params`." },
        schema: [],
        messages: {
            base: "`{{name}}` must extend `{{base}}<Result>` imported from `@nestjs/cqrs`. The bus types `execute` from the message, so a message with no declared result hands every dispatcher an untyped answer.",
            result: "`{{name}}` extends `{{base}}` without its result type. Write `{{base}}<{{name}}Result>`; the type argument is what `execute` returns.",
            params: "`{{name}}` must declare its only constructor parameter as `readonly params: ExecuteParams<...>` (a parameter property, public, not optional, no default).",
        },
    },
    create(context) {
        const kind = messageKindOf(context)
        if (kind === null) return {}
        const base = kind === "command" ? "Command" : "Query"
        return classVisitors((node) => {
            const name = node.id?.name ?? "this message"
            if (!node.superClass || !isImportedFrom(context, node.superClass, CQRS_PACKAGE, base)) {
                context.report({ node: node.id ?? node, messageId: "base", data: { name, base } })
            } else if ((node.superTypeArguments ?? node.superTypeParameters)?.params.length !== 1) {
                context.report({ node: node.superClass, messageId: "result", data: { name, base } })
            }
            const constructor = constructorOf(node)
            if (!constructor) return
            const param = constructor.value.params[0]
            const valid = constructor.value.params.length === 1
                && param.type === "TSParameterProperty"
                && param.readonly === true
                && (param.accessibility === undefined || param.accessibility === "public")
                && param.parameter.type === "Identifier"
                && param.parameter.name === "params"
                && param.parameter.optional !== true
            if (!valid) context.report({ node: param ?? constructor, messageId: "params", data: { name } })
        })
    },
}

// -- execute-params-shape ----------------------------------------------------------------------------------------

/** True for a class declaration decorated with `Entity` from `typeorm`. */
const isEntityClass = (checker, declaration) => {
    if (!ts.isClassDeclaration(declaration)) return false
    return (ts.getDecorators(declaration) ?? []).some((decorator) => {
        const call = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression
        if (!ts.isIdentifier(call)) return false
        let symbol = checker.getSymbolAtLocation(call)
        if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) symbol = checker.getAliasedSymbol(symbol)
        return symbol?.getName() === "Entity" && (symbol.getDeclarations() ?? []).some((entity) => /\/node_modules\/typeorm\//.test(entity.getSourceFile().fileName.replaceAll("\\", "/")))
    })
}

/** The name of an `@Entity` class reachable from `root` through properties, index signatures, unions and type arguments, or null. */
const reachableEntity = (context, root) => {
    const { checker, program } = typed(context)
    const seen = new Set()
    const stack = [root]
    let steps = 0
    while (stack.length > 0 && steps < 4000) {
        steps += 1
        const type = stack.pop()
        if (seen.has(type)) continue
        seen.add(type)
        if (type.isUnionOrIntersection()) {
            stack.push(...type.types)
            continue
        }
        if ((type.flags & ts.TypeFlags.Object) !== 0 && (type.objectFlags & ts.ObjectFlags.Reference) !== 0) stack.push(...checker.getTypeArguments(type))
        const symbol = type.getSymbol() ?? type.aliasSymbol
        const declarations = symbol?.getDeclarations() ?? []
        const entity = declarations.some((declaration) => isEntityClass(checker, declaration))
        if (entity) return symbol.getName()
        const own = declarations.some((declaration) => {
            const file = declaration.getSourceFile()
            return !program.isSourceFileFromExternalLibrary(file) && !program.isSourceFileDefaultLibrary(file)
        })
        if (!own) continue
        for (const property of checker.getPropertiesOfType(type)) stack.push(checker.getTypeOfSymbol(property))
        for (const info of checker.getIndexInfosOfType(type)) stack.push(info.type)
    }
    return null
}

/** True when a type annotation is a reference to the `ExecuteParams` or `PublicExecuteParams` that `platform/cqrs` declares (the symbol the name resolves to, so a local alias or lookalike is not it). */
const namesPlatformParams = (context, hfs, annotation) => {
    if (annotation.type !== "TSTypeReference") return false
    const { checker, toTs } = typed(context)
    let symbol = checker.getSymbolAtLocation(toTs(annotation.typeName))
    if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) symbol = checker.getAliasedSymbol(symbol)
    if (!symbol || (symbol.getName() !== "ExecuteParams" && symbol.getName() !== "PublicExecuteParams")) return false
    return (symbol.getDeclarations() ?? []).some((declaration) => declaredByCapability(hfs, declaration.getSourceFile().fileName, "cqrs"))
}

/** A message's `params` is `ExecuteParams<X>` / `PublicExecuteParams<X>` of `platform/cqrs` and X holds no entity. */
export const executeParamsShape = {
    meta: {
        type: "problem",
        docs: { description: "A message's `params` is `ExecuteParams<X>` or `PublicExecuteParams<X>` from `platform/cqrs`, and no entity is reachable from X." },
        schema: [],
        messages: {
            shape: "The `params` of `{{name}}` must be typed `ExecuteParams<Request>` (authenticated) or `PublicExecuteParams<Request>` (`@Public`) from `platform/cqrs`. The type states whether the door is public; a hand-written shape or an optional principal hides that.",
            entity: "`{{name}}` carries the ORM entity `{{entity}}` in its params. Entities never travel in a message: map the transport input to a plain request type and let the handler load the entity.",
        },
    },
    create(context) {
        if (messageKindOf(context) === null) return {}
        const hfs = hfsOf(context)
        return classVisitors((node) => {
            const name = node.id?.name ?? "this message"
            const constructor = constructorOf(node)
            const param = constructor?.value.params[0]
            const annotation = (param?.type === "TSParameterProperty" ? param.parameter : param)?.typeAnnotation?.typeAnnotation
            if (!annotation) return
            if (!namesPlatformParams(context, hfs, annotation)) {
                context.report({ node: annotation, messageId: "shape", data: { name } })
                return
            }
            const argument = (annotation.typeArguments ?? annotation.typeParameters)?.params[0]
            if (!argument) return
            const { checker, toTs } = typed(context)
            const entity = reachableEntity(context, checker.getTypeFromTypeNode(toTs(argument)))
            if (entity !== null) context.report({ node: argument, messageId: "entity", data: { name, entity } })
        })
    },
}

// -- no-use-case -------------------------------------------------------------------------------------------------

/** True when every method body of the class is `return this.<bus>.execute(...)` (at least one method). */
const isForwarder = (context, node) => {
    const methods = node.body.body.filter((member) => member.type === "MethodDefinition" && member.kind === "method")
    if (methods.length === 0) return false
    return methods.every((method) => {
        const statements = method.value.body?.body ?? []
        if (statements.length !== 1 || statements[0].type !== "ReturnStatement") return false
        const call = statements[0].argument?.type === "AwaitExpression" ? statements[0].argument.argument : statements[0].argument
        return call?.type === "CallExpression" && call.callee.type === "MemberExpression" && !call.callee.computed && call.callee.property.type === "Identifier" && call.callee.property.name === "execute" && isBus(context, call.callee.object)
    })
}

/** No use-case class and no forwarder service: the transport dispatches on the bus itself. */
export const noUseCase = {
    meta: {
        type: "problem",
        docs: { description: "The application layer has no `*.use-case.ts`, no `*UseCase` class and no forwarder `<op>.service.ts`." },
        schema: [],
        messages: {
            file: "`{{file}}` is a use-case file. The application layer is CQRS: write `<action>.command.ts` (or `.query.ts`) and `<action>.handler.ts` instead.",
            klass: "`{{name}}` is a use-case class. The application layer is CQRS: write a `Command<R>` / `Query<R>` message and a handler that extends `ICQRSHandler`.",
            forwarder: "`{{name}}` only forwards to a bus. A forwarder service is indirection with no decision in it: inject the bus in the resolver, controller or consumer and call `execute(new Message(...))` there, then delete this file.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename
        const slot = hfs.slotOf(filename)
        const visitors = {}
        if (APPLICATION_LAYER.has(slot)) {
            const name = baseName(filename)
            visitors.Program = (node) => {
                if (name.endsWith(".use-case.ts")) context.report({ node, loc: { line: 1, column: 0 }, messageId: "file", data: { file: name } })
            }
            visitors.ClassDeclaration = (node) => {
                if (node.id?.name.endsWith("UseCase")) context.report({ node: node.id, messageId: "klass", data: { name: node.id.name } })
            }
        }
        if ((slot === APPLICATION || isTransportSlot(slot)) && baseName(filename).endsWith(".service.ts")) {
            const previous = visitors.ClassDeclaration
            visitors.ClassDeclaration = (node) => {
                previous?.(node)
                if (isForwarder(context, node)) context.report({ node: node.id ?? node, messageId: "forwarder", data: { name: node.id?.name ?? "this service" } })
            }
        }
        return visitors
    },
}

// -- no-event-bus ------------------------------------------------------------------------------------------------

/** The bus class a constructed or extended expression is declared as (by declaration origin), else null. `classes` is the `ruleParams.be.eventBus.classes` map: module specifier -> class names. */
const busClassOf = (context, node, classes) => {
    const origin = typeOrigins(context, node).find((entry) => entry.module !== null && classes[entry.module]?.includes(entry.name))
    return origin ? origin.name : null
}

/** The methods that register a subscriber on a collection. */
const REGISTER_METHODS = new Set(["add", "push", "unshift", "set"])

/** True for a type that is a function: it has a call signature and no construct signature. */
const isFunctionType = (type) => type.getCallSignatures().length > 0 && type.getConstructSignatures().length === 0

/** True when a collection type (Set, Array, Map) holds functions. */
const holdsFunctions = (checker, type) => {
    const symbolName = type.getSymbol()?.getName()
    if (!["Set", "Array", "ReadonlyArray", "Map", "WeakSet"].includes(symbolName ?? "")) return false
    const args = checker.getTypeArguments(type)
    return args.length > 0 && isFunctionType(args[args.length - 1])
}

/** No in-process events: a side effect that must happen anyway is an event published through the bus. */
export const noEventBus = {
    meta: {
        type: "problem",
        docs: { description: "`EventBus`, `@EventsHandler`, `IEventHandler` and `@nestjs/event-emitter` are not used." },
        schema: [],
        messages: {
            event: "`{{name}}` is an in-process event mechanism. Events die with the process and run outside the transaction: publish an event with `eventBus.publish(event, tx)` in the transaction and consume it in `transport/message/` instead.",
            bus: "`{{name}}` is constructed or extended here as an in-process event bus. A `*TransitionEmitter`, a Subject used as a channel or an EventEmitter subclass has the same failure as `EventBus`: listeners live in one process and run outside the transaction. Publish an event with `eventBus.publish(event, tx)` in the transaction and consume it in `transport/message/`; a state a caller waits for is read from the database.",
            registry: "`{{name}}` stores callbacks that other code registers and this class later calls: a hand-rolled listener list is an in-process event bus. Publish an event with `eventBus.publish(event, tx)` in the transaction and consume it in `transport/message/` instead.",
        },
    },
    create(context) {
        const report = (node, name) => context.report({ node, messageId: "event", data: { name } })
        const eventBus = hfsOf(context).ruleParams.eventBus
        const eventNames = new Set(eventBus.imports[CQRS_PACKAGE] ?? [])
        const { checker, toTs } = typed(context)
        /** Collects, per class, the functions-collection properties and the registrations made on them. */
        const checkClass = (classNode) => {
            const collections = new Map()
            for (const member of classNode.body.body) {
                if (member.type !== "PropertyDefinition" || member.computed || member.key.type !== "Identifier") continue
                const tsKey = toTs(member.key)
                if (tsKey && holdsFunctions(checker, checker.getTypeAtLocation(tsKey))) collections.set(member.key.name, member.key)
            }
            if (collections.size === 0) return
            const registered = new Set()
            const visit = (node) => {
                if (!node || typeof node.type !== "string") return
                if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && !node.callee.computed && node.callee.property.type === "Identifier" && REGISTER_METHODS.has(node.callee.property.name)) {
                    const holder = node.callee.object
                    if (holder.type === "MemberExpression" && holder.object.type === "ThisExpression" && !holder.computed && holder.property.type === "Identifier" && collections.has(holder.property.name)) {
                        const callback = node.arguments[node.arguments.length - 1]
                        const tsCallback = callback ? toTs(callback) : null
                        if (tsCallback && isFunctionType(checker.getTypeAtLocation(tsCallback)) && callback.type === "Identifier") registered.add(holder.property.name)
                    }
                }
                for (const key of Object.keys(node)) {
                    if (key === "parent") continue
                    const value = node[key]
                    if (Array.isArray(value)) for (const child of value) visit(child)
                    else if (value && typeof value.type === "string") visit(value)
                }
            }
            visit(classNode.body)
            for (const name of registered) context.report({ node: collections.get(name), messageId: "registry", data: { name } })
        }
        return {
            ClassDeclaration(node) {
                checkClass(node)
                if (node.superClass) {
                    const name = busClassOf(context, node.superClass, eventBus.classes)
                    if (name) context.report({ node: node.superClass, messageId: "bus", data: { name } })
                }
            },
            ClassExpression(node) { checkClass(node) },
            NewExpression(node) {
                const name = busClassOf(context, node.callee, eventBus.classes)
                if (name) context.report({ node, messageId: "bus", data: { name } })
            },
            ...moduleReferences(({ node, source, value, names }) => {
                const members = eventBus.imports[value]
                if (members === undefined) return
                if (members.length === 0) report(source, value)
                else for (const name of names) if (members.includes(name)) report(node, name)
            }),
            MemberExpression(node) {
                if (node.computed || node.property.type !== "Identifier" || !eventNames.has(node.property.name)) return
                if (node.object.type === "Identifier" && importOf(context, node.object)?.source === CQRS_PACKAGE && importOf(context, node.object).imported === "*") report(node, node.property.name)
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "handler-overrides-process": handlerOverridesProcess,
    "handler-is-thin": handlerIsThin,
    "message-carries-params-only": messageCarriesParamsOnly,
    "message-typed-result": messageTypedResult,
    "execute-params-shape": executeParamsShape,
    "no-use-case": noUseCase,
    "no-event-bus": noEventBus,
}

/** Every rule of this law at `error`. */
export const recommended = {
    "starci-be/handler-overrides-process": "error",
    "starci-be/handler-is-thin": "error",
    "starci-be/message-carries-params-only": "error",
    "starci-be/message-typed-result": "error",
    "starci-be/execute-params-shape": "error",
    "starci-be/no-use-case": "error",
    "starci-be/no-event-bus": "error",
}
