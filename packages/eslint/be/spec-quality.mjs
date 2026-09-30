/**
 * The rule that holds spec quality (catalog R48 `BE_SPEC_QUALITY`, the unit-spec half).
 *
 *   - `spec-no-source-read` refuses a spec that reads source files. An architecture rule is a lint rule or a
 *     check, not a unit test that opens `src/` with `fs` and greps it; such a spec passes and fails on text, not on
 *     behavior, and it goes stale the day a file moves.
 *
 * The other half of R48 is the borrowed typescript-eslint set the factory turns on in every file, specs included:
 * `consistent-type-assertions` (`never`) and `no-non-null-assertion` leave no `as never`, no `as unknown as X`,
 * no `as X` and no `x!` in a spec. A double is `mock<T>()` (`@starci/jest-preset/mock`), which fails to compile when
 * the dependency's shape changes; a cast keeps compiling and lies. This canon writes no second rule for what the
 * borrowed rules already state. The e2e rules of R48 live in `e2e-flow.mjs` and `testing.mjs`.
 */
import { basename } from "node:path"
import { walk } from "./lib/ast.mjs"
import ts from "typescript"
import { hfsOf } from "./lib/hfs.mjs"
import { isPackageType, typed } from "./lib/types.mjs"

const FS_MODULES = new Set(["fs", "node:fs", "fs/promises", "node:fs/promises"])
const FS_READERS = new Set(["readFile", "readFileSync", "readdir", "readdirSync", "glob", "globSync", "opendir", "opendirSync", "createReadStream"])

/** A source file by its extension (a basename role): a spec that reads one reads source. */
const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/
const SOURCE_ANCHORS = new Set(["__dirname", "__filename"])

/**
 * Whether a path text leads into the repository's own tree: the slot manifest owns it, or it starts down a path the
 * manifest knows (`src`, `apps`, `src/modules`), or it names a source file.
 */
const leadsIntoRepository = (hfs, text) => {
    const path = text.replace(/^(?:\.{0,2}[\\/])+/, "")
    if (!path) return false
    if (SOURCE_EXTENSION.test(path)) return true
    const found = hfs.classify(path)
    return found.status === "owned" || (found.nearest?.matchedDepth ?? 0) > 0
}

/**
 * Whether a path expression points at source: it names `__dirname`, `import.meta`, `process.cwd()`, a source file, or
 * a path the HFS manifest places in the repository. An identifier is followed once to its `const` initializer, so
 * `const dir = join(__dirname, "x"); readdirSync(dir)` is recognised. A spec that reads the files ITS SUBJECT
 * wrote to a temporary directory is behavior, and stays outside this rule.
 */
const pointsAtSource = (hfs, expression, scope, depth = 0) => {
    if (!expression) return false
    let found = false
    walk(expression, (node) => {
        if (found) return
        if (node.type === "Identifier" && SOURCE_ANCHORS.has(node.name)) found = true
        else if (node.type === "MetaProperty") found = true
        else if (node.type === "MemberExpression" && node.object.type === "MetaProperty") found = true
        else if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && node.callee.object.type === "Identifier" && node.callee.object.name === "process" && node.callee.property.name === "cwd") found = true
        else if (node.type === "Literal" && typeof node.value === "string" && leadsIntoRepository(hfs, node.value)) found = true
        else if (node.type === "TemplateElement" && leadsIntoRepository(hfs, node.value.cooked ?? "")) found = true
        else if (node.type === "Identifier" && depth < 2) {
            let reference = scope
            while (reference && !reference.set.has(node.name)) reference = reference.upper
            const definition = reference?.set.get(node.name)?.defs[0]
            if (definition?.node.type === "VariableDeclarator" && pointsAtSource(hfs, definition.node.init, scope, depth + 1)) found = true
        }
    })
    return found
}

/** A spec never opens source files to assert on their text. */
export const specNoSourceRead = {
    meta: {
        type: "problem",
        docs: { description: "A spec does not read files with fs." },
        schema: [],
        messages: {
            read: "This spec reads files with `fs`. A rule about how source is written belongs in the lint canon or an architecture check; a spec asserts behavior.",
        },
    },
    create(context) {
        if (!/\.(?:e2e-)?spec\.[cm]?ts$/.test(basename(context.filename || context.getFilename()))) return {}
        const hfs = hfsOf(context)
        const sourceCode = context.sourceCode || context.getSourceCode()
        const namespaces = new Set()
        const named = new Set()
        return {
            ImportDeclaration(node) {
                if (typeof node.source.value !== "string" || !FS_MODULES.has(node.source.value)) return
                for (const specifier of node.specifiers) {
                    if (specifier.type === "ImportSpecifier") {
                        const imported = specifier.imported.name ?? specifier.imported.value
                        if (FS_READERS.has(imported)) named.add(specifier.local.name)
                        else if (imported === "promises") namespaces.add(specifier.local.name)
                    } else {
                        namespaces.add(specifier.local.name)
                    }
                }
            },
            CallExpression(node) {
                const callee = node.callee
                let reads = false
                if (callee.type === "Identifier" && named.has(callee.name)) {
                    reads = true
                } else if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" && FS_READERS.has(callee.property.name)) {
                    const object = callee.object
                    const base = object.type === "MemberExpression" ? object.object : object
                    reads = base.type === "Identifier" && namespaces.has(base.name)
                }
                if (reads && pointsAtSource(hfs, node.arguments[0], sourceCode.getScope(node))) context.report({ node, messageId: "read" })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
/**
 * R48 (test policy 2026-09-30): a unit spec takes its database double from `src/tests/fixtures/database.ts`
 * (`mockEntityManager()`, `fakeTransaction()`), the one typed fake; it never builds an ad-hoc `EntityManager`,
 * `QueryRunner`, `DataSource` or query builder out of `jest.fn`. Refused in a `*.spec.ts`: a call whose result is one of
 * those typeorm types unless the called function is declared in the fixtures slot (`be.tests.fixtures`), and assigning a
 * value to a member of a receiver of those types (`manager.find = jest.fn()`).
 */
const TYPEORM_DOUBLES = ["EntityManager", "QueryRunner", "DataSource", "SelectQueryBuilder", "QueryBuilder"]

export const specTypedEntityManager = {
    meta: {
        type: "problem",
        docs: { description: "A unit spec's database double is the fixture's mockEntityManager()/fakeTransaction(), never an ad-hoc jest.fn EntityManager." },
        schema: [],
        messages: {
            adhoc: "This builds an ad-hoc `{{type}}` double. A unit spec takes the typed fake from `src/tests/fixtures/database.ts` (`mockEntityManager()`, `fakeTransaction()`), so every handler spec states rows and asserts state the same way.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        if (!/\.spec\.ts$/.test(basename(filename)) || /\.e2e-spec\.ts$/.test(basename(filename))) return {}
        const doubleType = (node) => TYPEORM_DOUBLES.find((name) => isPackageType(context, node, name, "typeorm"))
        const fromFixtures = (callee) => {
            const { checker, toTs } = typed(context)
            const tsNode = toTs(callee)
            if (!tsNode) return false
            let symbol = checker.getSymbolAtLocation(tsNode.kind === ts.SyntaxKind.PropertyAccessExpression ? tsNode.name : tsNode)
            if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
            return (symbol?.getDeclarations?.() ?? []).some((d) => hfs.slotOf(String(d.getSourceFile().fileName)) === "be.tests.fixtures")
        }
        return {
            CallExpression(node) {
                const type = doubleType(node)
                if (type && !fromFixtures(node.callee)) context.report({ node, messageId: "adhoc", data: { type } })
            },
            AssignmentExpression(node) {
                if (node.left.type !== "MemberExpression") return
                const type = doubleType(node.left.object)
                if (type) context.report({ node, messageId: "adhoc", data: { type } })
            },
        }
    },
}

export const rules = {
    "spec-no-source-read": specNoSourceRead,
    "spec-typed-entity-manager": specTypedEntityManager,
}

/** Error from the start: the migration lanes replace the source-reading specs before adoption. */
export const recommended = {
    "starci-be/spec-no-source-read": "error",
    "starci-be/spec-typed-entity-manager": "error",
}
