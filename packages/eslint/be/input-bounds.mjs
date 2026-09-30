/**
 * The rules that keep input bounded (catalog R42 `BE_INPUT_BOUNDED`, BE-CONVENTION 1.7).
 *
 *   - `input-bounded` holds every property of an input class. An input class is one declared in a transport `dto/` folder
 *     in a file named `*.input.ts`, `*.args.ts` or `*.request.ts` (the slot decides which folder is a transport), or one
 *     decorated `@InputType`/`@ArgsType`. Every property carries a `class-validator` decorator; a `string` is bounded by
 *     `@MaxLength`, an enum-typed property by `@IsEnum`, an array by `@ArrayMaxSize`, a nested object by
 *     `@ValidateNested()` plus `@Type(() => X)`. The property's TYPE decides which bound it owes, never its name.
 *     This one rule holds the whole obligation: it replaces `dto-needs-validator`, which held only its first sentence.
 *   - `no-offset-pagination` refuses offset paging: `skip`/`offset` in the options of a `find*` on an `EntityManager`,
 *     an `OFFSET` keyword in an `sql` template (or a static string given to `.query`), and `page`/`pageNumber`/`offset`
 *     properties on a transport `dto` class. Pagination is cursor-only: unstable under writes and unbounded in cost otherwise.
 */
import ts from "typescript"
import { decoratorName, keyName, staticText } from "./lib/ast.mjs"
import { importsFrom, presentParts, typeOf } from "./lib/declared.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { normalizePath } from "./lib/path.mjs"
import { isPackageType, typed } from "./lib/types.mjs"

/** True when the file sits in a transport slot inside a `dto/` folder, judged by the slot and the owner-relative path. */
const isTransportDto = (hfs, filename) => {
    const slot = hfs.slotOf(filename) ?? ""
    if (!slot.startsWith("be.transport.") && !slot.startsWith("be.feature.transport.")) return false
    return hfs.relative(filename).split("/").slice(0, -1).includes("dto")
}

const INPUT_FILE = /\.(?:input|args|request)\.ts$/
const INPUT_DECORATORS = new Set(["InputType", "ArgsType"])

const decoratorsOf = (node) => node.decorators ?? []

/** The imported names of the decorators a member carries, mapped through the file's `class-validator`/`class-transformer` imports. */
const boundsOf = (member, validators, transformers) => {
    const names = new Set()
    for (const decorator of decoratorsOf(member)) {
        const local = decoratorName(decorator)
        if (local === null) continue
        if (validators.has(local)) names.add(validators.get(local))
        if (transformers.has(local)) names.add(`transform:${transformers.get(local)}`)
    }
    return names
}

const STRINGY = ts.TypeFlags.String | ts.TypeFlags.StringLiteral | ts.TypeFlags.TemplateLiteral
const NOT_NESTED = new Set(["Date", "Array", "ReadonlyArray", "Map", "Set", "Buffer", "Promise"])

/** What a property's type obliges: `enum`, `string`, `array`, `nested` or null for a scalar with no further bound. */
const obligationOf = (checker, type) => {
    const parts = presentParts(type)
    if (parts.length === 0) return null
    if (parts.every((part) => part.flags & ts.TypeFlags.EnumLike)) return "enum"
    if (parts.every((part) => part.flags & STRINGY)) return "string"
    if (parts.some((part) => (checker.isArrayType?.(part) ?? false) || part.getSymbol()?.name === "Array" || part.getSymbol()?.name === "ReadonlyArray")) return "array"
    if (parts.some((part) => part.flags & ts.TypeFlags.Object && !NOT_NESTED.has(part.getSymbol()?.name ?? "") && part.getCallSignatures().length === 0)) return "nested"
    return null
}

/** Every property of an input class carries the validators its type calls for. */
export const inputBounded = {
    meta: {
        type: "problem",
        docs: { description: "Every property of an input class is validated and bounded by its type." },
        schema: [],
        messages: {
            missing:
                "`{{name}}` has no `class-validator` decorator, so the wire may deliver any value here. Add the validators the field needs (`@IsString() @MaxLength(n)`, `@IsInt() @Min(0) @Max(n)`, `@IsEnum(E)`, `@IsArray() @ArrayMaxSize(n)`, `@IsOptional()` for a nullable field).",
            string: "`{{name}}` is a `string` with no `@MaxLength(n)`, so a string of any length is accepted. Bound it with `@MaxLength`.",
            enum: "`{{name}}` is enum-typed with no `@IsEnum(...)`, so any string is accepted. Add `@IsEnum(TheEnum)`.",
            array: "`{{name}}` is an array with no `@ArrayMaxSize(n)`, so an array of any count is accepted. Bound it with `@ArrayMaxSize`.",
            nested: "`{{name}}` is a nested object and needs both `@ValidateNested()` (from `class-validator`) and `@Type(() => X)` (from `class-transformer`), or its fields are never validated.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = normalizePath(context.filename)
        const sourceCode = context.sourceCode
        const { checker } = typed(context)
        const fileIsInput = isTransportDto(hfs, filename) && INPUT_FILE.test(filename)
        let validators = new Map()
        let transformers = new Map()
        const checkClass = (node) => {
            const target = node.parent?.type === "ExportNamedDeclaration" || node.parent?.type === "ExportDefaultDeclaration" ? node.parent : node
            const decorated = [...decoratorsOf(node), ...decoratorsOf(target)].map(decoratorName).some((name) => INPUT_DECORATORS.has(name))
            if (!fileIsInput && !decorated) return
            for (const member of node.body.body) {
                if (member.type !== "PropertyDefinition" || member.static || member.computed || member.key.type !== "Identifier") continue
                const name = sourceCode.getText(member.key)
                const have = boundsOf(member, validators, transformers)
                const validated = [...have].some((entry) => !entry.startsWith("transform:"))
                if (!validated) {
                    context.report({ node: member.key, messageId: "missing", data: { name } })
                    continue
                }
                const obligation = obligationOf(checker, typeOf(context, member))
                if (obligation === "string" && !have.has("MaxLength")) context.report({ node: member.key, messageId: "string", data: { name } })
                else if (obligation === "enum" && !have.has("IsEnum")) context.report({ node: member.key, messageId: "enum", data: { name } })
                else if (obligation === "array" && !have.has("ArrayMaxSize")) context.report({ node: member.key, messageId: "array", data: { name } })
                else if (obligation === "nested" && !(have.has("ValidateNested") && have.has("transform:Type"))) context.report({ node: member.key, messageId: "nested", data: { name } })
            }
        }
        return {
            Program(node) {
                validators = importsFrom(node, (source) => source === "class-validator")
                transformers = importsFrom(node, (source) => source === "class-transformer")
            },
            ClassDeclaration: checkClass,
            ClassExpression: checkClass,
        }
    },
}

const PAGE_PROPERTIES = new Set(["page", "pageNumber", "offset"])
const OFFSET_KEYS = new Set(["skip", "offset"])
const OFFSET_KEYWORD = /\bOFFSET\b/i

/** Reads are paged by cursor: no `skip`, `offset`, `OFFSET` or page number anywhere. */
export const noOffsetPagination = {
    meta: {
        type: "problem",
        docs: { description: "No offset or page-number pagination: `skip`/`offset` reads, `OFFSET` SQL, `page`/`offset` DTO fields." },
        schema: [],
        messages: {
            option: "`{{key}}` in a `find*` option is offset pagination: unstable under writes and unbounded in cost. Page by cursor (`PageArgs { first, after }`) with a keyset `WHERE`.",
            sql: "`OFFSET` in SQL is offset pagination: unstable under writes and unbounded in cost. Page by keyset: `WHERE (sort_key, id) > ($1, $2) ORDER BY sort_key, id LIMIT $3`.",
            field: "`{{name}}` is a page-number or offset field on a transport DTO. Take `PageArgs { first, after }` and return a `<X>Connection`; clients page by opaque cursor.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = normalizePath(context.filename)
        const { checker } = typed(context)
        const inDto = isTransportDto(hfs, filename)
        return {
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
                const method = callee.property.name
                if (!isPackageType(context, callee.object, "EntityManager", "typeorm")) return
                if (method === "query") {
                    const text = staticText(node.arguments[0])
                    if (text !== null && OFFSET_KEYWORD.test(text)) context.report({ node: node.arguments[0], messageId: "sql" })
                    return
                }
                if (!method.startsWith("find")) return
                for (const argument of node.arguments) {
                    const type = typeOf(context, argument)
                    if (!type) continue
                    for (const property of checker.getPropertiesOfType(type)) {
                        if (!OFFSET_KEYS.has(property.name)) continue
                        const literal = argument.type === "ObjectExpression" ? argument.properties.find((item) => item.type === "Property" && keyName(item.key) === property.name) : null
                        context.report({ node: literal ?? argument, messageId: "option", data: { key: property.name } })
                    }
                }
            },
            TaggedTemplateExpression(node) {
                const tag = node.tag
                const isSql = (tag.type === "Identifier" && tag.name === "sql") || (tag.type === "MemberExpression" && !tag.computed && keyName(tag.property) === "sql")
                if (isSql && node.quasi.quasis.some((quasi) => OFFSET_KEYWORD.test(quasi.value.cooked ?? ""))) context.report({ node: node.quasi, messageId: "sql" })
            },
            PropertyDefinition(node) {
                if (!inDto || node.static || node.computed || node.key.type !== "Identifier") return
                if (PAGE_PROPERTIES.has(node.key.name)) context.report({ node: node.key, messageId: "field", data: { name: node.key.name } })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "input-bounded": inputBounded,
    "no-offset-pagination": noOffsetPagination,
}

/** Both start at error: no baseline exists, and the repositories' fix lanes clear the debt. */
export const recommended = {
    "starci-be/input-bounded": "error",
    "starci-be/no-offset-pagination": "error",
}
