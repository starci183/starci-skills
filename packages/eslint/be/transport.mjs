/**
 * The rules that hold BE-CONVENTION 1.6 (R88 `BE_TRANSPORT_SHAPE`).
 *
 * A transport handler (a resolver method, a controller action, a gateway message handler, a consumer, a job, a CLI
 * entry) maps its input, dispatches exactly one command or query on the injected bus and maps the result. It injects
 * nothing else, wraps nothing in an envelope and accepts no free-form JSON.
 *
 * Scope comes from the HFS slot view (`be.transport.*`, `be.transport.http`); what a receiver is comes from its TYPE
 * (`CommandBus`, `QueryBus`, `RequestLocale` are judged by where they are declared); what a decorator is comes
 * from the import that binds it. No rule tests a directory spelled in a path pattern or a variable name.
 */
import ts from "typescript"
import { walk } from "./lib/ast.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { decoratorArguments, decoratorCallee, importOf, isImportedFrom, moduleReferences } from "./lib/import-source.mjs"
import { isTransportSlot, KIND_DOOR_SLOTS } from "./lib/transport-slots.mjs"
import { isPackageType, typeOrigins, typed } from "./lib/types.mjs"

/** The HTTP route decorators of `@nestjs/common`. */
const HTTP_ROUTES = ["Get", "Post", "Put", "Patch", "Delete", "All", "Options", "Head"]

/** The GraphQL operation decorators of `@nestjs/graphql`. */
const GRAPHQL_OPERATIONS = ["Query", "Mutation", "Subscription", "ResolveField"]

/** The slot of REST doors. */
const HTTP_SLOT = "be.transport.http"

/** The slot of provider webhook doors (the REST doors of the webhook kind). */
const WEBHOOK_SLOT = "be.webhooks"

/** Slots whose classes are entered through a method the framework calls on a schedule, a queue or a command line. */
const PLAIN_ENTRY_SLOTS = new Set(["be.transport.message", "be.transport.schedule", "be.feature.transport.cli"])

/** True for the decorators that make a method a transport handler (a socket handler belongs to the realtime kind, which has its own laws). */
const isRouteDecorator = (context, decorator) => {
    const callee = decoratorCallee(decorator)
    return isImportedFrom(context, callee, "@nestjs/common", HTTP_ROUTES)
        || isImportedFrom(context, callee, "@nestjs/graphql", GRAPHQL_OPERATIONS)
}

/** True when the class declares (transitively through its members' decorators) nothing but is a transport door: it has handler methods. */
const handlerMethods = (context, node, slot) => node.body.body.filter((member) => {
    if (member.type !== "MethodDefinition" || member.kind !== "method" || member.static) return false
    if ((member.decorators ?? []).some((decorator) => isRouteDecorator(context, decorator))) return true
    return PLAIN_ENTRY_SLOTS.has(slot) && member.accessibility !== "private" && member.accessibility !== "protected"
})

/** The bus receivers of `@nestjs/cqrs`. */
const isBus = (context, node) => isPackageType(context, node, "CommandBus", "@nestjs/cqrs") || isPackageType(context, node, "QueryBus", "@nestjs/cqrs")

/** True when a declaration file is owned by the capability `capability` of a platform slot. */
const declaredByCapability = (hfs, file, capability) => hfs.slotOf(file) === "be.platform" && hfs.ownerOf(file)?.split("/").pop() === capability

// -- transport-is-thin -------------------------------------------------------------------------------------

/** What a transport class may hold, by the type of the injected value. */
const isAllowedInjection = (context, hfs, slot, annotation) => {
    const origins = typeOrigins(context, annotation)
    return origins.some((origin) => {
        if ((origin.name === "CommandBus" || origin.name === "QueryBus") && origin.module === "@nestjs/cqrs") return true
        if (origin.name === "RequestLocale" && slot === HTTP_SLOT && declaredByCapability(hfs, origin.file, "i18n")) return true
        return false
    })
}

/** True for a decorator that injects: `Inject` of Nest, or a function declared in a `*.decorators.ts` file, or a `@nestjs/typeorm` injector. */
const isInjectorDecorator = (context, decorator) => {
    const callee = decoratorCallee(decorator)
    if (callee?.type !== "Identifier") return false
    const found = importOf(context, callee)
    if (found?.source === "@nestjs/common" && found.imported === "Inject") return true
    if (found?.source === "@nestjs/typeorm") return true
    const { checker, toTs } = typed(context)
    let symbol = checker.getSymbolAtLocation(toTs(callee))
    if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) symbol = checker.getAliasedSymbol(symbol)
    return (symbol?.getDeclarations() ?? []).some((declaration) => declaration.getSourceFile().fileName.replace(/\\/g, "/").endsWith(".decorators.ts"))
}

/** Counts the bus dispatches (`<bus>.execute(...)`) a method makes, closures included. */
const dispatchesOf = (context, method) => {
    let count = 0
    walk(method.value.body, (node) => {
        if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && !node.callee.computed && node.callee.property.type === "Identifier" && node.callee.property.name === "execute" && isBus(context, node.callee.object)) count += 1
    })
    return count
}

/** Statements and expressions that are a decision or a repetition: none of them belongs in a door. */
const DECISION_NODES = new Set(["IfStatement", "SwitchStatement", "ConditionalExpression", "LogicalExpression", "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement", "TryStatement", "ThrowStatement"])

/** What an injected type is to a door: `bus`, `locale`, or null. */
const injectedKind = (context, annotation) => {
    const origins = typeOrigins(context, annotation)
    if (origins.some((origin) => (origin.name === "CommandBus" || origin.name === "QueryBus") && origin.module === "@nestjs/cqrs")) return "bus"
    if (origins.some((origin) => origin.name === "RequestLocale" && origin.module === null)) return "locale"
    return null
}

/** True for `this.<name>` where name is one of `names`. */
const isThisMember = (expression, names) => expression?.type === "MemberExpression" && !expression.computed && expression.object.type === "ThisExpression" && expression.property.type === "Identifier" && names.has(expression.property.name)

/** A door maps its input, dispatches exactly one message on the injected bus and returns the (mapped) result. */
export const transportIsThin = {
    meta: {
        type: "problem",
        docs: { description: "A transport class injects only `CommandBus`/`QueryBus`, and every handler method maps its input, dispatches exactly one command or query and returns the result: no decision, no loop, no other call." },
        schema: [],
        messages: {
            injects: "`{{what}}` is injected into a transport class. A door maps its input and dispatches: it injects only `CommandBus` and `QueryBus` (plus `RequestLocale` in a REST door). Move whatever this needs into a service and dispatch a command or query; an `EntityManager` never reaches a door.",
            none: "`{{name}}` never dispatches. A transport handler calls `execute(new <Message>(...))` on the injected bus exactly once; anything it does instead belongs in a handler.",
            many: "`{{name}}` dispatches {{count}} times. A transport handler dispatches exactly one command or query; a second dispatch is orchestration that belongs in the handler of one message.",
            branch: "`{{what}}` is a decision or a loop in a door. A transport method only maps its input, dispatches one message and returns the result; a branch here is business logic that no unit spec covers. Move it into the service the handler calls. The inbox claim of a delivery is made by the service the handler calls.",
            call: "`{{what}}` is a call a door does not make. A door calls the injected bus (`execute`), `unwrapOutcome` of `platform/primitives`, and pure mapper functions imported from a `*.mapper.ts`; everything else is logic that belongs in a service.",
            noReturn: "`{{name}}` dispatches but never returns the result. A resolver or controller action returns what the bus answered (mapped by a pure mapper function if it must change shape).",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const slot = hfs.slotOf(context.filename)
        // a webhook or realtime door answers to its own kind laws (webhooks.mjs, realtime.mjs), not to the one-dispatch shape
        if (!isTransportSlot(slot) || KIND_DOOR_SLOTS.includes(slot)) return {}
        const sourceCode = context.sourceCode
        const isMapper = (callee) => {
            if (callee.type !== "Identifier") return false
            const found = importOf(context, callee)
            return found !== null && /(?:^|\/)[^/]+\.mapper(?:\.[cm]?[jt]s)?$/.test(found.source.replace(/\\/g, "/"))
        }
        /** `unwrapOutcome` of `platform/primitives`, resolved by the symbol the name binds to, not by its spelling. */
        const isUnwrapOutcome = (callee) => {
            if (callee.type !== "Identifier") return false
            const { checker, toTs } = typed(context)
            const tsNode = toTs(callee)
            let symbol = tsNode && checker.getSymbolAtLocation(tsNode)
            if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) symbol = checker.getAliasedSymbol(symbol)
            return symbol?.getName() === "unwrapOutcome" && (symbol.getDeclarations() ?? []).some((declaration) => declaredByCapability(hfs, declaration.getSourceFile().fileName, "primitives"))
        }
        return {
            ClassDeclaration(node) {
                // A Nest module class (`@Module`) wires the door into the container (registers consumers and jobs); it is not a door.
                if ((node.decorators ?? node.parent?.decorators ?? []).some((decorator) => isImportedFrom(context, decoratorCallee(decorator), "@nestjs/common", "Module"))) return
                const locales = new Set()
                const classify = (name, annotation) => {
                    const kind = name === null ? null : injectedKind(context, annotation)
                    if (kind === "locale") locales.add(name)
                }
                const constructor = node.body.body.find((member) => member.type === "MethodDefinition" && member.kind === "constructor")
                for (const original of constructor?.value.params ?? []) {
                    const param = original.type === "TSParameterProperty" ? original.parameter : original
                    const annotation = param.typeAnnotation?.typeAnnotation
                    if (!annotation || !isAllowedInjection(context, hfs, slot, annotation)) context.report({ node: original, messageId: "injects", data: { what: sourceCode.getText(param) } })
                    else classify(original.type === "TSParameterProperty" && param.type === "Identifier" ? param.name : null, annotation)
                }
                for (const member of node.body.body) {
                    if (member.type !== "PropertyDefinition" || !(member.decorators ?? []).some((decorator) => isInjectorDecorator(context, decorator))) continue
                    const annotation = member.typeAnnotation?.typeAnnotation
                    if (!annotation || !isAllowedInjection(context, hfs, slot, annotation)) context.report({ node: member, messageId: "injects", data: { what: sourceCode.getText(member) } })
                    else classify(member.key.type === "Identifier" ? member.key.name : null, annotation)
                }
                const handlers = handlerMethods(context, node, slot)
                if (handlers.length === 0) return
                for (const method of node.body.body) {
                    if (method.type !== "MethodDefinition" || method.kind !== "method" || !method.value.body) continue
                    walk(method.value.body, (child) => {
                        if (DECISION_NODES.has(child.type)) {
                            context.report({ node: child, messageId: "branch", data: { what: child.type === "LogicalExpression" ? child.operator : child.type.replace(/(Statement|Expression)$/, "").toLowerCase() } })
                            return
                        }
                        if (child.type !== "CallExpression") return
                        const callee = child.callee
                        const member = callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" ? callee : null
                        const allowed = (member !== null && member.property.name === "execute" && isBus(context, member.object))
                            || (member !== null && isThisMember(member.object, locales))
                            || isMapper(callee)
                            || isUnwrapOutcome(callee)
                        if (!allowed) context.report({ node: child, messageId: "call", data: { what: sourceCode.getText(callee) } })
                    })
                }
                for (const method of handlers) {
                    const count = dispatchesOf(context, method)
                    const name = method.key.type === "Identifier" ? method.key.name : "this handler"
                    if (count === 0) context.report({ node: method.key, messageId: "none", data: { name } })
                    else if (count > 1) context.report({ node: method.key, messageId: "many", data: { name, count: String(count) } })
                    else if ((method.decorators ?? []).some((decorator) => isRouteDecorator(context, decorator))) {
                        let returns = false
                        walk(method.value.body, (child) => {
                            if (child.type === "ReturnStatement" && child.argument) returns = true
                        }, { intoFunctions: false })
                        if (!returns) context.report({ node: method.key, messageId: "noReturn", data: { name } })
                    }
                }
            },
        }
    },
}

// -- no-response-envelope ----------------------------------------------------------------------------------------

/** The envelope classes and decorators BE-CONVENTION 1.6 names. */
const ENVELOPE_NAMES = new Set(["GraphQLTransformInterceptor", "GraphQLSuccessMessage", "AbstractGraphQLResponse", "RestTransformInterceptor"])

/** True when a class of this repository has an `intercept` that returns `map(...)` from rxjs over the handled response. */
const interceptorMapsResponse = (context, argument) => {
    const { checker, toTs, program } = typed(context)
    const callee = argument.type === "NewExpression" ? argument.callee : argument
    if (callee.type !== "Identifier") return false
    let symbol = checker.getSymbolAtLocation(toTs(callee))
    if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) symbol = checker.getAliasedSymbol(symbol)
    const declaration = (symbol?.getDeclarations() ?? []).find((candidate) => ts.isClassDeclaration(candidate) && !program.isSourceFileFromExternalLibrary(candidate.getSourceFile()) && !program.isSourceFileDefaultLibrary(candidate.getSourceFile()))
    const intercept = declaration?.members.find((member) => ts.isMethodDeclaration(member) && member.name.getText() === "intercept")
    if (!intercept) return false
    let mapped = false
    const visit = (node) => {
        if (mapped) return
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && importedFromRxjs(checker, node.expression)) mapped = true
        ts.forEachChild(node, visit)
    }
    visit(intercept)
    return mapped
}

/** True when an identifier is bound by an import of `rxjs` (or `rxjs/operators`) whose exported name is `map`. */
const importedFromRxjs = (checker, identifier) => {
    const symbol = checker.getSymbolAtLocation(identifier)
    const declaration = symbol?.getDeclarations()?.[0]
    if (!declaration || !ts.isImportSpecifier(declaration)) return false
    const imported = (declaration.propertyName ?? declaration.name).text
    const module = ts.findAncestor(declaration, ts.isImportDeclaration)?.moduleSpecifier
    return imported === "map" && ts.isStringLiteral(module) && (module.text === "rxjs" || module.text.startsWith("rxjs/"))
}

/** The expression a return statement hands back, without `await`, casts and parentheses. */
const returned = (expression) => {
    let current = expression
    while (current && (current.type === "AwaitExpression" || current.type === "TSAsExpression" || current.type === "TSSatisfiesExpression" || current.type === "TSNonNullExpression")) current = current.type === "AwaitExpression" ? current.argument : current.expression
    return current
}

/** No response envelope: a door returns its typed payload and failures travel as GraphQL errors. */
export const noResponseEnvelope = {
    meta: {
        type: "problem",
        docs: { description: "No `{ success, data }` response envelope: no envelope class or decorator, no mapping interceptor, no envelope literal." },
        schema: [],
        messages: {
            named: "`{{name}}` is part of the response envelope the convention removed. A door returns its typed payload; failures travel as `errors[].extensions.{code,kind}` and success copy is front-end i18n.",
            interceptor: "This interceptor maps the response (`map(...)` over the handled stream), which is an envelope by another name. Remove it: the transport returns the payload the handler produced.",
            literal: "This door returns an object with `success` and `data`. Return the typed payload itself; a refusal is an error, not a flag.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const slot = hfs.slotOf(context.filename)
        const transport = isTransportSlot(slot)
        const declared = (node, id) => {
            if (id?.type === "Identifier" && ENVELOPE_NAMES.has(id.name)) context.report({ node: id, messageId: "named", data: { name: id.name } })
        }
        const visitors = {
            ClassDeclaration: (node) => declared(node, node.id),
            FunctionDeclaration: (node) => declared(node, node.id),
            VariableDeclarator: (node) => declared(node, node.id),
            ImportSpecifier(node) {
                const name = node.imported.type === "Identifier" ? node.imported.name : node.imported.value
                if (ENVELOPE_NAMES.has(name)) context.report({ node, messageId: "named", data: { name } })
            },
        }
        if (!transport) return visitors
        return {
            ...visitors,
            Decorator(node) {
                if (!isImportedFrom(context, decoratorCallee(node), "@nestjs/common", "UseInterceptors")) return
                for (const argument of decoratorArguments(node)) if (interceptorMapsResponse(context, argument)) context.report({ node: argument, messageId: "interceptor" })
            },
            ReturnStatement(node) {
                let owner = node.parent
                while (owner && owner.type !== "FunctionExpression" && owner.type !== "ArrowFunctionExpression" && owner.type !== "FunctionDeclaration") owner = owner.parent
                if (owner?.parent?.type !== "MethodDefinition") return
                const value = returned(node.argument)
                if (value?.type !== "ObjectExpression") return
                const keys = new Set(value.properties.map((property) => (property.type === "Property" && !property.computed && property.key.type === "Identifier" ? property.key.name : property.type === "Property" && property.key.type === "Literal" ? String(property.key.value) : null)))
                if (keys.has("success") && keys.has("data")) context.report({ node: value, messageId: "literal" })
            },
        }
    },
}

// -- no-graphql-json ---------------------------------------------------------------------------------------------

/** The names of the JSON scalar exports of `graphql-scalars`. */
const JSON_SCALARS = new Set(["GraphQLJSON", "GraphQLJSONObject", "JSON", "JSONObject", "JSONResolver", "JSONObjectResolver"])

/** True when the type is `unknown` or an object with a string index signature of `unknown`. */
const isUnknownBag = (checker, type) => {
    if ((type.flags & ts.TypeFlags.Unknown) !== 0) return true
    return checker.getIndexInfosOfType(type).some((info) => (info.type.flags & ts.TypeFlags.Unknown) !== 0)
}

/** No free-form JSON in a door: no `GraphQLJSON`, no untyped `@Body()`, no `switch (input.operation)`. */
export const noGraphqlJson = {
    meta: {
        type: "problem",
        docs: { description: "A transport file takes no `GraphQLJSON` scalar, no `unknown` body and no `switch (input.operation)` dispatch." },
        schema: [],
        messages: {
            scalar: "`{{name}}` is the free-form JSON scalar. An input or output of a door is a typed class: declare the fields (the schema is the contract) instead of accepting any JSON.",
            body: "This `@Body()` is typed `unknown` or as a bag of unknowns, so nothing validates it. Declare a request class with validated properties.",
            operation: "`switch` on an `operation` field is a second dispatcher inside one endpoint. Give each operation its own resolver or controller action and its own typed input.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        if (!isTransportSlot(hfs.slotOf(context.filename))) return {}
        const { checker, toTs } = typed(context)
        const scalar = (node, local, importedName, source) => {
            if (source === "graphql-type-json") return context.report({ node, messageId: "scalar", data: { name: importedName } })
            if (source === "graphql-scalars" && JSON_SCALARS.has(importedName)) return context.report({ node, messageId: "scalar", data: { name: importedName } })
            let symbol = checker.getSymbolAtLocation(toTs(local))
            if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) symbol = checker.getAliasedSymbol(symbol)
            const origin = (symbol?.getDeclarations() ?? []).some((declaration) => /\/node_modules\/(?:graphql-type-json|graphql-scalars)\//.test(declaration.getSourceFile().fileName.replace(/\\/g, "/")) && (JSON_SCALARS.has(symbol.getName()) || symbol.getName() === "default"))
            if (origin) context.report({ node, messageId: "scalar", data: { name: importedName } })
        }
        return {
            ImportSpecifier(node) {
                scalar(node, node.local, node.imported.type === "Identifier" ? node.imported.name : node.imported.value, node.parent.source.value)
            },
            ImportDefaultSpecifier(node) {
                scalar(node, node.local, node.local.name, node.parent.source.value)
            },
            MethodDefinition(node) {
                for (const param of node.value.params) {
                    const target = param.type === "AssignmentPattern" ? param.left : param
                    if (!(target.decorators ?? []).some((decorator) => isImportedFrom(context, decoratorCallee(decorator), "@nestjs/common", "Body"))) continue
                    const annotation = target.typeAnnotation?.typeAnnotation
                    if (annotation && isUnknownBag(checker, checker.getTypeFromTypeNode(toTs(annotation)))) context.report({ node: target, messageId: "body" })
                }
            },
            SwitchStatement(node) {
                const discriminant = node.discriminant
                if (discriminant.type !== "MemberExpression") return
                const key = discriminant.computed ? (discriminant.property.type === "Literal" ? String(discriminant.property.value) : null) : discriminant.property.name
                if (key === "operation") context.report({ node: discriminant, messageId: "operation" })
            },
        }
    },
}

// -- door-lives-in-features --------------------------------------------------------------------------------------

/** True for a `@Controller` decorator of `@nestjs/common`. */
const isController = (context, decorator) => isImportedFrom(context, decoratorCallee(decorator), "@nestjs/common", "Controller")

/** A door is a door whatever its protocol, and every REST door lives in the `transport/http` slot of a feature or in the door slot of the webhook kind. */
export const doorLivesInFeatures = {
    meta: {
        type: "problem",
        docs: { description: "A `@Controller` is declared in the `transport/http` slot of a feature." },
        schema: [],
        messages: {
            wrongSlot: "A `@Controller` belongs in `src/features/<feature>/transport/http/` (slot `be.transport.http`) or, for a provider webhook, in `src/features/webhooks/<provider>/` (slot `be.webhooks`); this file is in slot `{{slot}}`. A door parked among the capabilities it calls reads as one and gets imported like one.",
        },
    },
    create(context) {
        const slot = hfsOf(context).slotOf(context.filename)
        if (slot === HTTP_SLOT || slot === WEBHOOK_SLOT) return {}
        return {
            Decorator(node) {
                if (isController(context, node)) context.report({ node, messageId: "wrongSlot", data: { slot: slot ?? "none" } })
            },
        }
    },
}

// -- no-capability-imports-features ------------------------------------------------------------------------------

/** A capability under `modules/` never imports a feature: a door calls into a capability, never the other way round. */
export const noCapabilityImportsFeatures = {
    meta: {
        type: "problem",
        docs: { description: "A domain, platform or integrations file never imports a file of a feature." },
        schema: [],
        messages: {
            reversed: "`{{specifier}}` resolves into a feature (tier `feature`), and this file is in tier `{{tier}}`. A capability is called by a door and stays ignorant of who calls it. Move the shared code under `modules/`, or invert the call so the door reaches in.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const tier = hfs.tierOf(context.filename)
        if (tier !== "domain" && tier !== "platform" && tier !== "integrations") return {}
        const { program } = typed(context)
        return moduleReferences(({ source, value }) => {
            const resolved = ts.resolveModuleName(value, context.filename, program.getCompilerOptions(), ts.sys).resolvedModule?.resolvedFileName
            if (resolved && hfs.tierOf(resolved) === "feature") context.report({ node: source, messageId: "reversed", data: { specifier: value, tier } })
        })
    },
}

// -- rest-door-needs-a-reason ------------------------------------------------------------------------------------

/** The `PublicReason` members that justify a REST door: a probe, a handshake and a signed webhook. */
const REST_REASONS = new Set(["Health", "AuthHandshake", "SignedWebhook"])

/** Nest and Express exports whose presence shows a byte stream or a redirect. */
const BYTE_EVIDENCE = [
    { source: "@nestjs/common", names: ["StreamableFile", "Redirect"] },
    { source: "@nestjs/platform-express", names: ["FileInterceptor", "FilesInterceptor", "AnyFilesInterceptor", "FileFieldsInterceptor"] },
    { source: "node:fs", names: ["createReadStream"] },
    { source: "fs", names: ["createReadStream"] },
]

/** True when the class shows one of the four reasons a door is REST: a public reason, a byte stream, or an OAuth redirect. */
const showsReason = (context, controller) => {
    let shown = false
    walk(controller, (node) => {
        if (shown) return
        if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier" && REST_REASONS.has(node.property.name) && node.object.type === "Identifier" && importOf(context, node.object)?.imported === "PublicReason") shown = true
        if (node.type === "Identifier" && !(node.parent?.type === "MemberExpression" && node.parent.property === node && !node.parent.computed)) {
            const found = importOf(context, node)
            if (found && BYTE_EVIDENCE.some((evidence) => evidence.source === found.source && evidence.names.includes(found.imported))) shown = true
        }
    })
    return shown
}

/** A REST door exists only where GraphQL cannot go, and the class has to show which case it is. */
export const restDoorNeedsAReason = {
    meta: {
        type: "problem",
        docs: { description: "A `@Controller` shows a public reason (Health, AuthHandshake, SignedWebhook) or a byte stream or redirect." },
        schema: [],
        messages: {
            unjustified: "This REST door shows none of the reasons a door may not be GraphQL: a probe, an auth handshake (OAuth redirect) or a signed webhook (`@Public({ reason: PublicReason.X })`), or a byte stream. A plain JSON read belongs in the GraphQL schema, where the client already is.",
        },
    },
    create(context) {
        hfsOf(context)
        return {
            ClassDeclaration(node) {
                const controller = (node.decorators ?? []).find((decorator) => isController(context, decorator))
                if (controller && !showsReason(context, node)) context.report({ node: controller, messageId: "unjustified" })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "rest-door-needs-a-reason": restDoorNeedsAReason,
    "door-lives-in-features": doorLivesInFeatures,
    "no-capability-imports-features": noCapabilityImportsFeatures,
    "transport-is-thin": transportIsThin,
    "no-response-envelope": noResponseEnvelope,
    "no-graphql-json": noGraphqlJson,
}

/** Every rule of this law at `error`. */
export const recommended = {
    "starci-be/rest-door-needs-a-reason": "error",
    "starci-be/door-lives-in-features": "error",
    "starci-be/no-capability-imports-features": "error",
    "starci-be/transport-is-thin": "error",
    "starci-be/no-response-envelope": "error",
    "starci-be/no-graphql-json": "error",
}
