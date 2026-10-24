/**
 * The rules that keep `zod` to the boundary of untrusted data and keep every schema bounded (catalog R304 `BE_SCHEMA_PLACE`,
 * R305 `BE_SCHEMA_BOUNDED`, BE-TYPING-8).
 *
 * The back end validates by zone. A transport door (GraphQL `@InputType`, REST request class) is validated by
 * `class-validator` (R42). Data that never reaches a DTO is read through a `zod` schema: a provider's HTTP response, a tool
 * argument, structured model output, a queue or outbox payload. The two territories are kept disjoint by lint, never by memory.
 *
 *   - `schema-place` (R304) holds the territory. `zod` is imported only from a `<name>.schema.ts` file (or its spec) that sits
 *     in a `domain`, `platform` or `integrations` owner; never in a feature (a transport door answers to `class-validator`), never
 *     in a `dto/` folder, and a schema file does not also carry `class-validator` or a GraphQL type.
 *   - `schema-bounded` (R305) holds the cost. Every string, array, set, map and record a schema builds has an upper bound
 *     (`.max(n)`, `.length(n)`, `.size(n)`, or for a record and a map a `.refine`/`.check` on its entry count), and `z.any()`,
 *     `z.unknown()` and `z.json()` are refused: an unbounded array whose elements all fail validation allocates an issue each
 *     (GHSA-mrhx-c7xc-m3w5), and an unbounded string is an unbounded cost whatever the zod version.
 */
import { hfsOf } from "./lib/hfs.mjs"
import { normalizePath } from "./lib/path.mjs"
import { isTransportSlot } from "./lib/transport-slots.mjs"

const ZOD = /^zod(?:\/|$)/
/** The imports of the other validation layer, which never share a file with a schema. */
const MIXED = new Set(["class-validator", "class-transformer", "@nestjs/graphql"])
const SCHEMA_FILE = /\.schema(?:\.spec)?\.ts$/
/** Tiers a schema file may live in: the owners of boundary data. */
const SCHEMA_TIERS = new Set(["domain", "platform", "integrations"])

/** Constructors that build a string-valued schema and owe a `.max(n)` or `.length(n)`. */
const STRINGY = new Set(["string", "email", "url", "httpUrl", "hostname", "base64", "base64url", "jwt", "emoji", "hex"])
/** Constructors that build a counted container: bounded by `.max(n)`, `.length(n)` or `.size(n)`. */
const COUNTED = new Set(["array", "set"])
/** Constructors whose entry count only a refinement can bound. */
const REFINED = new Set(["record", "looseRecord", "partialRecord", "map"])
/** Constructors that accept anything: refused outright. */
const OPEN = new Set(["any", "unknown", "json"])
/** The chain members that bound a string or a counted container. */
const BOUNDING = new Set(["max", "length", "size"])
const REFINING = new Set(["refine", "superRefine", "check"])

/** The member names a `z.coerce.string()` style callee passes through before its constructor. */
const PASS_THROUGH = new Set(["coerce"])

/** True for a bound argument that is not a way to say "no bound": absent, `Infinity`, `NaN`, a non-positive literal, `Number.MAX_*`. */
const isRealBound = (argument) => {
    if (argument === undefined) return false
    if (argument.type === "Identifier") return argument.name !== "Infinity" && argument.name !== "NaN" && argument.name !== "undefined"
    if (argument.type === "Literal") return typeof argument.value === "number" && Number.isFinite(argument.value) && argument.value > 0
    if (argument.type === "MemberExpression" && !argument.computed && argument.object.type === "Identifier" && argument.object.name === "Number") {
        return !/^(?:MAX_|POSITIVE_INFINITY)/.test(argument.property.name ?? "")
    }
    return true
}

/** The methods chained on `node` (`z.string().trim().max(5)` gives `trim`, `max` with their calls), outermost last. */
const chainOf = (node) => {
    const calls = []
    let current = node
    for (;;) {
        const member = current.parent
        if (member?.type !== "MemberExpression" || member.object !== current || member.computed || member.property.type !== "Identifier") break
        const call = member.parent
        if (call?.type !== "CallExpression" || call.callee !== member) break
        calls.push({ name: member.property.name, call })
        current = call
    }
    return calls
}

/** Resolves a callee to the zod constructor it names, or null: `z.string`, `z.coerce.string`, or a named import `string`. */
const constructorOf = (callee, namespaces, named) => {
    if (callee.type === "Identifier") return named.get(callee.name) ?? null
    if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return null
    let object = callee.object
    while (object.type === "MemberExpression" && !object.computed && object.property.type === "Identifier" && PASS_THROUGH.has(object.property.name)) object = object.object
    return object.type === "Identifier" && namespaces.has(object.name) ? callee.property.name : null
}

/** Every schema built by this file is bounded and none accepts anything. */
export const schemaBounded = {
    meta: {
        type: "problem",
        docs: { description: "Every zod string, array, set, map and record has an upper bound; `z.any()`, `z.unknown()` and `z.json()` are refused." },
        schema: [],
        messages: {
            string: "`z.{{name}}()` has no `.max(n)` or `.length(n)`, so a string of any length is accepted. Bound it: `z.{{name}}().max(200)`.",
            counted: "`z.{{name}}(...)` has no `.max(n)`, `.length(n)` or `.size(n)`, so a collection of any count is accepted (and every failing element allocates an issue). Bound it: `z.{{name}}(item).max(100)`.",
            refined: "`z.{{name}}(...)` has no bound on its entry count. Add `.refine((entries) => Object.keys(entries).length <= N)` (a `Map`: `.size`), or key it by a `z.enum` so its size is closed.",
            open: "`z.{{name}}()` accepts any value, so nothing is validated. Describe the shape: an object of bounded fields, or a bounded union.",
            bound: "`.{{name}}()` here is no bound (a missing, non-positive or infinite argument). Give a finite positive count.",
        },
    },
    create(context) {
        const namespaces = new Set()
        const named = new Map()
        return {
            ImportDeclaration(node) {
                if (typeof node.source.value !== "string" || !ZOD.test(node.source.value)) return
                for (const specifier of node.specifiers) {
                    if (specifier.type === "ImportNamespaceSpecifier") namespaces.add(specifier.local.name)
                    else if (specifier.type === "ImportSpecifier") {
                        const imported = specifier.imported.type === "Identifier" ? specifier.imported.name : String(specifier.imported.value)
                        if (imported === "z") namespaces.add(specifier.local.name)
                        else named.set(specifier.local.name, imported)
                    } else if (specifier.type === "ImportDefaultSpecifier") namespaces.add(specifier.local.name)
                }
            },
            CallExpression(node) {
                const name = constructorOf(node.callee, namespaces, named)
                if (name === null) return
                if (OPEN.has(name)) {
                    context.report({ node, messageId: "open", data: { name } })
                    return
                }
                const kind = STRINGY.has(name) ? "string" : COUNTED.has(name) ? "counted" : REFINED.has(name) ? "refined" : null
                if (kind === null) return
                const chain = chainOf(node)
                if (kind === "refined") {
                    if (!chain.some((entry) => REFINING.has(entry.name))) context.report({ node, messageId: "refined", data: { name } })
                    return
                }
                const bounds = chain.filter((entry) => BOUNDING.has(entry.name))
                if (bounds.length === 0) {
                    context.report({ node, messageId: kind, data: { name } })
                    return
                }
                if (!bounds.some((entry) => isRealBound(entry.call.arguments[0]))) context.report({ node: bounds[0].call, messageId: "bound", data: { name: bounds[0].name } })
            },
        }
    },
}

/** The module specifiers a file references, with the node that names each (imports, re-exports, `import()` and `require()`). */
const referenceNodes = (node) => {
    switch (node.type) {
        case "ImportDeclaration":
        case "ExportAllDeclaration":
        case "ExportNamedDeclaration":
            return node.source ? [node.source] : []
        case "ImportExpression":
            return [node.source]
        case "CallExpression":
            return node.callee.type === "Identifier" && node.callee.name === "require" && node.arguments[0] ? [node.arguments[0]] : []
        default:
            return []
    }
}

const referencesZod = (node) => referenceNodes(node).filter((source) => source.type === "Literal" && typeof source.value === "string" && ZOD.test(source.value))

/** Where a schema may live, and what shares a file with it. */
export const schemaPlace = {
    meta: {
        type: "problem",
        docs: { description: "`zod` is imported only from a `*.schema.ts` file of a domain, platform or integrations owner, never in a transport door or beside a DTO decorator." },
        schema: [],
        messages: {
            door: "`zod` is imported in a transport door or a `dto/` folder. A door's input is validated by `class-validator` (R42); read untrusted data that is not a DTO through a `<name>.schema.ts` of the owner instead.",
            tier: "`zod` is imported in a {{tier}} file. Schemas belong to the owners of boundary data: `modules/domain`, `modules/platform` or `modules/integrations`. A feature calls the owner, which parses.",
            file: "`zod` is imported outside a schema file. Declare the schema in `<name>.schema.ts` beside its reader and import the schema (and its inferred type) from there.",
            mixed: "This schema file also imports `{{source}}`. A schema file holds zod only; the two validation layers never share a file.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = normalizePath(context.filename)
        const slot = hfs.slotOf(filename) ?? ""
        const tier = hfs.tierOf(filename)
        const inDoor = isTransportSlot(slot) || slot.startsWith("be.transport.") || hfs.relative(filename).split("/").slice(0, -1).includes("dto")
        const isSchemaFile = SCHEMA_FILE.test(filename)
        return {
            "*"(node) {
                const found = referencesZod(node)
                if (found.length === 0) return
                if (inDoor) context.report({ node: found[0], messageId: "door" })
                else if (tier === "feature") context.report({ node: found[0], messageId: "tier", data: { tier } })
                else if (!isSchemaFile) context.report({ node: found[0], messageId: "file" })
                else if (!SCHEMA_TIERS.has(tier)) context.report({ node: found[0], messageId: "tier", data: { tier: tier ?? "non-owner" } })
            },
            ImportDeclaration(node) {
                if (!isSchemaFile || inDoor || !MIXED.has(node.source.value)) return
                context.report({ node: node.source, messageId: "mixed", data: { source: node.source.value } })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "schema-bounded": schemaBounded,
    "schema-place": schemaPlace,
}

/** Both start at error: no baseline exists. */
export const recommended = {
    "starci-be/schema-bounded": "error",
    "starci-be/schema-place": "error",
}
