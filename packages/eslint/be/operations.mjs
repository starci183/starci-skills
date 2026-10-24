/**
 * The rules that hold BE-OPERATIONS-1 (R95 `BE_OPERATION_CONTRACT`).
 *
 * A versioned operation is declared once, in the app's typed operation table (`platform/operations`: `query<Input, Output,
 * RefusalCode>()` and `mutation<...>()` registered by `defineOperations`), and the contract emit derives `contracts/<app>/openapi.json`
 * from that table with the type checker. An operation whose input or output the checker cannot express (`any`, `unknown`,
 * `Record<string, unknown>`, an unbound generic) says nothing to a client, and a route that takes or answers those types by another
 * road than the table's own `OperationRequest` and `OperationReply` is a second, untyped contract.
 *
 * What the table IS comes from where its types are declared (the `operations` capability of the platform slot), never from a name in
 * a path pattern.
 */
import ts from "typescript"
import { keyName, walk } from "./lib/ast.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { decoratorArguments, decoratorCallee, isImportedFrom } from "./lib/import-source.mjs"
import { isTransportSlot } from "./lib/transport-slots.mjs"
import { typed } from "./lib/types.mjs"

/** The HTTP route decorators of `@nestjs/common` (`Sse` is a route too: a `text/event-stream` GET that needs its own evidence). */
const HTTP_ROUTES = ["Get", "Post", "Put", "Patch", "Delete", "All", "Options", "Head", "Sse"]

/** The slot of server-sent-events doors: the one place an `@Sse` route is evidence of itself. */
const SSE_SLOT = "be.feature.realtime.sse"

/** True when a declaration file is owned by the capability `operations` of a platform slot. */
const declaredByOperations = (hfs, file) => hfs.slotOf(file) === "be.platform" && hfs.ownerOf(file)?.split("/").pop() === "operations"

/** The declarations of a symbol after alias resolution. */
const declarationsOfSymbol = (checker, symbol) => {
    if (!symbol) return []
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    return target.getDeclarations?.() ?? []
}

/** True when the symbol is the canon type `name` of the operations capability. */
const isCanonType = (hfs, checker, symbol, name) => declarationsOfSymbol(checker, symbol).some((declaration) => declaration.name?.text === name && declaredByOperations(hfs, String(declaration.getSourceFile().fileName).replace(/\\/g, "/")))

const F = ts.TypeFlags

/**
 * Why a type says nothing on the wire, or null when the checker can express it.
 *
 * @param {object} checker - The program's type checker.
 * @param {object} type - A TypeScript type.
 * @param {Set<object>} seen - The types already judged (recursive types).
 * @returns {string | null} The reason, or null.
 */
const whyUndecidable = (checker, type, seen = new Set()) => {
    if (seen.has(type)) return null
    seen.add(type)
    const flags = type.flags
    if (flags & F.Any) return "any"
    if (flags & F.Unknown) return "unknown"
    if (flags & F.Never) return "never"
    if (flags & F.TypeParameter) return "an unbound generic"
    if (flags & F.NonPrimitive) return "object with no declared members"
    if (flags & (F.BigInt | F.BigIntLiteral | F.ESSymbol | F.UniqueESSymbol)) return "bigint or symbol"
    if (type.isUnion() || type.isIntersection()) {
        for (const member of type.types) {
            if (member.flags & (F.Undefined | F.Void)) continue
            const why = whyUndecidable(checker, member, seen)
            if (why) return why
        }
        return null
    }
    if (flags & F.Object) {
        if (type.getCallSignatures().length || type.getConstructSignatures().length) return "a function"
        if (checker.isArrayType(type) || checker.isTupleType(type)) {
            for (const item of checker.getTypeArguments(type)) {
                const why = whyUndecidable(checker, item, seen)
                if (why) return why
            }
            return null
        }
        const own = type.getSymbol()
        if (own && !own.getName().startsWith("__") && (own.getDeclarations() ?? []).some((declaration) => /[\\/]typescript[\\/]lib[\\/]lib\./.test(declaration.getSourceFile().fileName))) return `${own.getName()}, which is not a JSON value`
        const props = checker.getPropertiesOfType(type)
        const index = checker.getIndexInfosOfType(type)
        if (props.length === 0 && index.length === 0) return "an object type with no members"
        for (const info of index) {
            const why = whyUndecidable(checker, info.type, seen)
            if (why) return `a record of ${why}`
        }
        for (const prop of props) {
            const why = whyUndecidable(checker, checker.getTypeOfSymbol(prop), seen)
            if (why) return `${prop.getName()}: ${why}`
        }
    }
    return null
}

// -- operation-contract-decidable --------------------------------------------------------------------------------

/** No operation contract with an input, an output or a refusal set the contract emit cannot express. */
export const operationContractDecidable = {
    meta: {
        type: "problem",
        docs: { description: "An OperationContract names a closed input type, a closed output type and a closed union of refusal codes." },
        schema: [],
        messages: {
            type: "The {{label}} of this operation is {{why}}, which says nothing to a client. Declare a named, closed type for it (no `any`, `unknown`, `Record<string, unknown>`, unbound generic or function).",
            refusal: "The refusal codes of this operation are `{{found}}`. Declare a closed union of string literals (`\"DENIED\" | \"INVALID\"`), or omit the third type argument for an operation that never refuses.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const { checker, toTs } = typed(context)
        if (declaredByOperations(hfs, context.filename.replace(/\\/g, "/"))) return {}
        const judge = (node, contract) => {
            const symbol = contract.aliasSymbol ?? contract.getSymbol()
            if (!isCanonType(hfs, checker, symbol, "OperationContract")) return
            const [input, output, refusal] = (contract.objectFlags & ts.ObjectFlags.Reference) !== 0 ? checker.getTypeArguments(contract) : (contract.aliasTypeArguments ?? [])
            for (const [label, type] of [["input", input], ["output", output]]) {
                const why = type ? whyUndecidable(checker, type) : null
                if (why) context.report({ node, messageId: "type", data: { label, why } })
            }
            if (refusal && !(refusal.flags & F.Never)) {
                const members = refusal.isUnion() ? refusal.types : [refusal]
                if (!members.every((member) => member.isStringLiteral())) context.report({ node, messageId: "refusal", data: { found: checker.typeToString(refusal) } })
            }
        }
        return {
            TSTypeReference(node) {
                const tsNode = toTs(node)
                const type = checker.getTypeFromTypeNode(tsNode)
                if (type.getSymbol() || type.aliasSymbol) judge(node, type)
            },
            CallExpression(node) {
                const type = checker.getTypeAtLocation(toTs(node))
                if (type.getSymbol()) judge(node, type)
            },
        }
    },
}

// -- operation-route-driven-by-table -----------------------------------------------------------------------------

/** The canon alias a type annotation node names (`OperationRequest`, `OperationReply`), with its table type argument. */
const canonReference = (hfs, checker, toTs, annotation) => {
    let node = annotation
    if (node?.type === "TSTypeAnnotation") node = node.typeAnnotation
    if (node?.type !== "TSTypeReference") return null
    const tsNode = toTs(node)
    const symbol = checker.getSymbolAtLocation(tsNode.typeName)
    for (const name of ["OperationRequest", "OperationReply"]) {
        if (isCanonType(hfs, checker, symbol, name)) {
            const argument = tsNode.typeArguments?.[0]
            return { name, table: argument ? checker.getTypeFromTypeNode(argument) : null }
        }
    }
    return null
}

/** The type annotation a return type wraps: `Promise<X>` gives `X`. */
const unwrapPromise = (annotation) => {
    const node = annotation?.type === "TSTypeAnnotation" ? annotation.typeAnnotation : annotation
    if (node?.type === "TSTypeReference" && node.typeName?.type === "Identifier" && node.typeName.name === "Promise") return node.typeArguments?.params?.[0] ?? node.typeParameters?.params?.[0] ?? null
    return node ?? null
}

/** The canon request and reply annotations of one HTTP method. */
const operationReferences = (context, method) => {
    const hfs = hfsOf(context)
    const { checker, toTs } = typed(context)
    const params = method.value.params.filter((param) => (param.decorators ?? []).some((decorator) => isImportedFrom(context, decoratorCallee(decorator), "@nestjs/common", "Body")))
    return {
        request: params.map((param) => canonReference(hfs, checker, toTs, param.typeAnnotation ?? param.parameter?.typeAnnotation)).find((reference) => reference?.name === "OperationRequest") ?? null,
        reply: canonReference(hfs, checker, toTs, unwrapPromise(method.value.returnType)),
    }
}

/** A route's table must be the nonempty result of the canon defineOperations, including an imported app table. */
export const operationRouteEvidence = (context) => {
    const hfs = hfsOf(context)
    const { program, checker } = typed(context)
    let tables
    const declaredTables = () => {
        if (tables) return tables
        tables = new Set()
        const visit = (node) => {
            if (ts.isCallExpression(node) && isCanonType(hfs, checker, checker.getSymbolAtLocation(node.expression), "defineOperations")) {
                const table = checker.getTypeAtLocation(node)
                if (checker.getPropertiesOfType(table).length > 0) tables.add(table)
            }
            ts.forEachChild(node, visit)
        }
        for (const source of program.getSourceFiles()) {
            if (!source.isDeclarationFile && hfs.slotOf(source.fileName)) visit(source)
        }
        return tables
    }
    return (method) => {
        const { request, reply } = operationReferences(context, method)
        return request?.table != null && reply?.name === "OperationReply" && request.table === reply.table && declaredTables().has(request.table)
    }
}

/** A symbol declared by the app's domain identity capability, rather than a same-named local decorator or enum. */
const identityExport = (context, node, name) => {
    if (!node) return false
    const hfs = hfsOf(context)
    const { checker, toTs } = typed(context)
    const target = toTs(node)
    if (!target) return false
    return declarationsOfSymbol(checker, checker.getSymbolAtLocation(target)).some((declaration) => {
        const file = declaration.getSourceFile().fileName
        return declaration.name?.text === name && hfs.tierOf(file) === "domain" && hfs.ownerOf(file)?.split("/").pop() === "identity"
    })
}

const REST_REASONS = new Set(["Health", "AuthHandshake", "SignedWebhook"])
const FILE_INTERCEPTORS = ["FileInterceptor", "FilesInterceptor", "AnyFilesInterceptor", "FileFieldsInterceptor"]

/** A stream actually returned by this method; importing or mentioning a stream constructor proves nothing. */
const returnsBytes = (context, method) => {
    const seen = new Set()
    const isBytes = (expression) => {
        if (!expression || seen.has(expression)) return false
        seen.add(expression)
        if (["AwaitExpression", "TSAsExpression", "TSTypeAssertion", "TSNonNullExpression"].includes(expression.type)) return isBytes(expression.argument ?? expression.expression)
        if (expression.type === "NewExpression" && isImportedFrom(context, expression.callee, "@nestjs/common", "StreamableFile")) return true
        if (expression.type === "CallExpression" && isImportedFrom(context, expression.callee, ["node:fs", "fs"], "createReadStream")) return true
        if (expression.type !== "Identifier") return false
        for (let scope = context.sourceCode.getScope(expression); scope; scope = scope.upper) {
            const variable = scope.set.get(expression.name)
            if (variable) return variable.defs.some((definition) => definition.type === "Variable" && isBytes(definition.node.init))
        }
        return false
    }
    let found = false
    walk(method.value.body, (node) => {
        if (node.type === "ReturnStatement" && isBytes(node.argument)) found = true
    }, { intoFunctions: false })
    return found
}

/** True when a class declaration implements the `CanActivate` of `@nestjs/common` (resolved by symbol, not by spelling). */
const implementsCanActivate = (checker, declaration) =>
    (declaration.heritageClauses ?? []).some((clause) => clause.token === ts.SyntaxKind.ImplementsKeyword && clause.types.some((type) => {
        const symbol = checker.getSymbolAtLocation(type.expression)
        return declarationsOfSymbol(checker, symbol).some((found) => found.name?.text === "CanActivate" && /[\/]@nestjs[\/]common[\/]/.test(String(found.getSourceFile().fileName)))
    }))

/**
 * True when the identity capability that declares `Credential` also declares the canon `CredentialGuard`, a class implementing
 * `CanActivate`. The decorator only selects the credential kind; this guard is what authenticates it.
 */
const credentialGuardDeclared = (context, decoratorCallee_) => {
    const hfs = hfsOf(context)
    const { program, checker, toTs } = typed(context)
    const target = toTs(decoratorCallee_)
    const home = declarationsOfSymbol(checker, target ? checker.getSymbolAtLocation(target) : undefined).find((declaration) => declaration.name?.text === "Credential")
    const owner = home && hfs.ownerOf(home.getSourceFile().fileName)
    if (!owner) return false
    for (const source of program.getSourceFiles()) {
        if (source.isDeclarationFile || hfs.ownerOf(source.fileName) !== owner) continue
        const found = source.statements.some((statement) => ts.isClassDeclaration(statement) && statement.name?.text === "CredentialGuard" && implementsCanActivate(checker, statement))
        if (found) return true
    }
    return false
}

/**
 * Credential-guarded route (BE_REST_DOOR_EVIDENCE, owner delegation 2026-10-16): the route, or its controller class, carries
 * `@Credential({ kind: "<literal>" })` imported from the domain identity capability, and that capability declares a
 * `CredentialGuard implements CanActivate`. A same-named local decorator, a `@UseGuards` of any other guard and a non-literal kind prove nothing.
 */
const credentialGuardEvidence = (context, method) => {
    const carriers = [...(method.decorators ?? []), ...(method.parent?.parent?.decorators ?? [])]
    for (const decorator of carriers) {
        const callee = decoratorCallee(decorator)
        if (!identityExport(context, callee, "Credential")) continue
        const options = decoratorArguments(decorator)[0]
        const kind = options?.type === "ObjectExpression" ? options.properties.find((property) => property.type === "Property" && keyName(property.key) === "kind")?.value : null
        if (kind?.type === "Literal" && typeof kind.value === "string" && kind.value !== "" && credentialGuardDeclared(context, callee)) return true
    }
    return false
}

/**
 * Event-stream evidence (BE_REST_DOOR_EVIDENCE, owner:lite-sse-door): the route is an `@Sse` method of `@nestjs/common` inside the sse slot of a
 * realtime channel. It is structural, not a name list: the same `@Sse` anywhere else, or any other route inside the sse slot, proves nothing.
 */
const eventStreamEvidence = (context, method) =>
    hfsOf(context).slotOf(context.filename) === SSE_SLOT
    && (method.decorators ?? []).some((decorator) => isImportedFrom(context, decoratorCallee(decorator), "@nestjs/common", "Sse"))

/** Route-level evidence for probes, auth handshakes, signed webhooks, redirects, byte transfers, event streams and credential-guarded routes. */
export const restExceptionEvidence = (context, method) => {
    if (credentialGuardEvidence(context, method) || eventStreamEvidence(context, method)) return true
    for (const decorator of method.decorators ?? []) {
        const callee = decoratorCallee(decorator)
        if (isImportedFrom(context, callee, "@nestjs/common", "Redirect")) return true
        if (identityExport(context, callee, "Public")) {
            const options = decoratorArguments(decorator)[0]
            const reason = options?.type === "ObjectExpression" ? options.properties.find((property) => property.type === "Property" && keyName(property.key) === "reason")?.value : null
            if (reason?.type === "MemberExpression" && !reason.computed && REST_REASONS.has(keyName(reason.property)) && identityExport(context, reason.object, "PublicReason")) return true
        }
        if (isImportedFrom(context, callee, "@nestjs/common", "UseInterceptors") && decoratorArguments(decorator).some((argument) => argument.type === "CallExpression" && isImportedFrom(context, argument.callee, "@nestjs/platform-express", FILE_INTERCEPTORS))) return true
    }
    return returnsBytes(context, method)
}

/** Public REST JSON is exposed through the app's declared operation table. */
export const restRouteDeclared = {
    meta: {
        type: "problem",
        docs: { description: "Every REST route outside probes, auth handshakes, signed webhooks and byte transfers uses a declared operation table." },
        schema: [],
        messages: {
            undeclared: "[BE_REST_ROUTE_UNDECLARED] This REST route is absent from the app's defineOperations table. Serve public v1 JSON through @Body() request: OperationRequest<Table> and Promise<OperationReply<Table>> of the same declared table; otherwise expose it through GraphQL.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        if (!isTransportSlot(hfs.slotOf(context.filename))) return {}
        const declared = operationRouteEvidence(context)
        return {
            MethodDefinition(node) {
                if (node.kind !== "method" || node.static) return
                if (!(node.decorators ?? []).some((decorator) => isImportedFrom(context, decoratorCallee(decorator), "@nestjs/common", HTTP_ROUTES))) return
                const controller = node.parent?.parent
                if (!(controller?.decorators ?? []).some((decorator) => isImportedFrom(context, decoratorCallee(decorator), "@nestjs/common", "Controller"))) return
                if (!restExceptionEvidence(context, node) && !declared(node)) context.report({ node: node.key, messageId: "undeclared" })
            },
        }
    },
}

/** An operation route takes the table's `OperationRequest` and answers its `OperationReply`, of one table. */
export const operationRouteDrivenByTable = {
    meta: {
        type: "problem",
        docs: { description: "A route that takes or answers the operation table's types takes OperationRequest<Table> and answers Promise<OperationReply<Table>> of the same table." },
        schema: [],
        messages: {
            half: "This route takes or answers `{{one}}` but not `{{other}}`. An operation route is driven by the table on both sides: `@Body() request: OperationRequest<Table>` and `Promise<OperationReply<Table>>`.",
            table: "The request and the reply of this route name different operation tables. One route serves one table.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        if (!isTransportSlot(hfs.slotOf(context.filename))) return {}
        const { checker, toTs } = typed(context)
        return {
            MethodDefinition(node) {
                if (node.kind !== "method" || node.static) return
                if (!(node.decorators ?? []).some((decorator) => isImportedFrom(context, decoratorCallee(decorator), "@nestjs/common", HTTP_ROUTES))) return
                const params = node.value.params.filter((param) => (param.decorators ?? []).some((decorator) => isImportedFrom(context, decoratorCallee(decorator), "@nestjs/common", "Body")))
                const request = params.map((param) => canonReference(hfs, checker, toTs, param.typeAnnotation ?? param.parameter?.typeAnnotation)).find(Boolean) ?? null
                const reply = canonReference(hfs, checker, toTs, unwrapPromise(node.value.returnType))
                if (!request && !reply) return
                if (!request || !reply) {
                    context.report({ node: node.key, messageId: "half", data: request ? { one: "OperationRequest", other: "OperationReply" } : { one: "OperationReply", other: "OperationRequest" } })
                    return
                }
                if (request.table !== reply.table) context.report({ node: node.key, messageId: "table" })
            },
        }
    },
}

/** Every rule of this law. */
export const rules = {
    "operation-contract-decidable": operationContractDecidable,
    "operation-route-driven-by-table": operationRouteDrivenByTable,
    "rest-route-declared": restRouteDeclared,
}

/** Every rule of this law at `error`. */
export const recommended = {
    "starci-be/operation-contract-decidable": "error",
    "starci-be/operation-route-driven-by-table": "error",
    "starci-be/rest-route-declared": "error",
}
