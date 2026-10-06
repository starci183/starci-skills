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
import { hfsOf } from "./lib/hfs.mjs"
import { decoratorCallee, isImportedFrom } from "./lib/import-source.mjs"
import { isTransportSlot } from "./lib/transport-slots.mjs"
import { typed } from "./lib/types.mjs"

/** The HTTP route decorators of `@nestjs/common`. */
const HTTP_ROUTES = ["Get", "Post", "Put", "Patch", "Delete", "All", "Options", "Head"]

/** True when a declaration file is owned by the capability `operations` of a platform slot. */
const declaredByOperations = (hfs, file) => hfs.slotOf(file) === "be.platform" && hfs.ownerOf(file)?.split("/").pop() === "operations"

/** The declarations of a symbol after alias resolution. */
const declarationsOfSymbol = (checker, symbol) => {
    if (!symbol) return []
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    return target.getDeclarations?.() ?? []
}

/** True when the symbol is the canon type `name` of the operations capability. */
const isCanonType = (hfs, checker, symbol, name) => declarationsOfSymbol(checker, symbol).some((declaration) => declaration.name?.text === name && declaredByOperations(hfs, String(declaration.getSourceFile().fileName).replaceAll("\\", "/")))

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
        if (declaredByOperations(hfs, context.filename.replaceAll("\\", "/"))) return {}
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
}

/** Every rule of this law at `error`. */
export const recommended = {
    "starci-be/operation-contract-decidable": "error",
    "starci-be/operation-route-driven-by-table": "error",
}
