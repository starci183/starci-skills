/**
 * The rules that hold spec quality (catalog R48 `BE_SPEC_QUALITY`).
 *
 *   - `spec-no-source-read` refuses a spec that reads source files. An architecture rule is a lint rule or a
 *     check, not a unit test that opens `src/` with `fs` and greps it; such a spec passes and fails on text, not on
 *     behavior, and it goes stale the day a file moves.
 *   - `spec-typed-doubles` refuses `as never` and `as unknown as X` in a spec. A double of a dependency is
 *     `mock<T>()` (the typed helper from `@starci/jest-preset`), which fails to compile when the dependency's
 *     shape changes; a cast keeps compiling and lies.
 *
 * The e2e canon rules apply to `src/tests/e2e/**` through the repository's `lint:e2e` script (run by hand, and
 * green before an e2e conclusion is drawn); that is a matter of which globs the config names, not of a rule.
 */
import { walk } from "./lib/ast.mjs"
import { isDeclarationFile, isSpecFile, normalizePath } from "./lib/path.mjs"

const FS_MODULES = new Set(["fs", "node:fs", "fs/promises", "node:fs/promises"])
const FS_READERS = new Set(["readFile", "readFileSync", "readdir", "readdirSync", "glob", "globSync", "opendir", "opendirSync", "createReadStream"])

/** A path argument that leads to the repository's own source: a location of this file, the working directory, or a source folder. */
const SOURCE_TEXT = /(?:^|[\\/])(?:src|apps|libs)(?:[\\/]|$)|\.[cm]?tsx?$/
const SOURCE_ANCHORS = new Set(["__dirname", "__filename"])

/**
 * Whether a path expression points at source: it names `__dirname`, `import.meta`, `process.cwd()`, or a
 * `src`, `apps` or `libs` folder or a `.ts` file. An identifier is followed once to its `const` initializer, so
 * `const dir = join(__dirname, "x"); readdirSync(dir)` is recognised. A spec that reads the files ITS SUBJECT
 * wrote to a temporary directory is behavior, and stays outside this rule.
 */
const pointsAtSource = (expression, scope, depth = 0) => {
    if (!expression) return false
    let found = false
    walk(expression, (node) => {
        if (found) return
        if (node.type === "Identifier" && SOURCE_ANCHORS.has(node.name)) found = true
        else if (node.type === "MetaProperty") found = true
        else if (node.type === "MemberExpression" && node.object.type === "MetaProperty") found = true
        else if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && node.callee.object.type === "Identifier" && node.callee.object.name === "process" && node.callee.property.name === "cwd") found = true
        else if (node.type === "Literal" && typeof node.value === "string" && SOURCE_TEXT.test(node.value)) found = true
        else if (node.type === "TemplateElement" && SOURCE_TEXT.test(node.value.cooked ?? "")) found = true
        else if (node.type === "Identifier" && depth < 2) {
            let reference = scope
            while (reference && !reference.set.has(node.name)) reference = reference.upper
            const definition = reference?.set.get(node.name)?.defs[0]
            if (definition?.node.type === "VariableDeclarator" && pointsAtSource(definition.node.init, scope, depth + 1)) found = true
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
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename) || !isSpecFile(filename)) return {}
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
                if (reads && pointsAtSource(node.arguments[0], sourceCode.getScope(node))) context.report({ node, messageId: "read" })
            },
        }
    },
}

/** A double is a typed `mock<T>()`, never a cast. */
export const specTypedDoubles = {
    meta: {
        type: "problem",
        docs: { description: "A spec uses `mock<T>()` for a double, not `as never` or `as unknown as X`." },
        schema: [],
        messages: {
            never: "`as never` forces a value through the type system. Build the double with `mock<T>()` so it stays checked against the real dependency.",
            doubleCast: "`as unknown as X` forces a value through the type system. Build the double with `mock<T>()` so it stays checked against the real dependency.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename) || !(isSpecFile(filename) || filename.includes("/src/tests/"))) return {}
        return {
            TSAsExpression(node) {
                if (node.typeAnnotation.type === "TSNeverKeyword") {
                    context.report({ node, messageId: "never" })
                } else if (node.expression.type === "TSAsExpression" && node.expression.typeAnnotation.type === "TSUnknownKeyword") {
                    context.report({ node, messageId: "doubleCast" })
                }
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "spec-no-source-read": specNoSourceRead,
    "spec-typed-doubles": specTypedDoubles,
}

/** Both start at error: the migration lanes replace the casts and the source-reading specs before adoption. */
export const recommended = {
    "starci-be/spec-no-source-read": "error",
    "starci-be/spec-typed-doubles": "error",
}
