/**
 * The rule that holds `platform/ids` (catalog R142 `BE_AMBIENT_ID`).
 *
 *   - `no-ambient-id` refuses every source of an identifier that does not come from the injected `Ids` port:
 *     `randomUUID` of `node:crypto` (a named import, a namespace or default import, or the global `crypto`), the
 *     generators of the `uuid` package that read the clock or a random source (`v1`, `v4`, `v6`, `v7`), and the `nanoid` and
 *     `ulid` packages. Business code asks `ids.next()`; a spec provides `fakeIds()`, so an id is exactly what the spec said
 *     and a failing run reproduces.
 *
 * The owner that may mint ids is asked of the slot view (`platform` tier, capability `ids`), as the clock is, and the test
 * world (slot `be.tests.world`) is exempt like it is from the clock: it is the composition root of tests and names real
 * resources. Specs are NOT exempt. The generators are found by the module they are imported from, never by a local name,
 * so `import { randomUUID as newId } from "node:crypto"` is the same reference.
 */
import { hfsOf, inTestWorld } from "./lib/hfs.mjs"
import { isOwnedBy } from "./lib/ports.mjs"

/** Modules of Node's crypto: `randomUUID` of them mints an id. */
const CRYPTO_MODULES = new Set(["node:crypto", "crypto"])

/** Packages whose named exports mint an id, and which of them (`null`: every export). */
const ID_PACKAGES = Object.freeze({ uuid: ["v1", "v4", "v6", "v7"], nanoid: null, "nanoid/non-secure": null, ulid: null })

/** The variable a name resolves to from `node`'s scope, or null when it is a global. */
const variableOf = (context, node, name) => {
    let scope = (context.sourceCode || context.getSourceCode()).getScope(node)
    while (scope) {
        const found = scope.set.get(name)
        if (found) return found
        scope = scope.upper
    }
    return null
}

/** Whether `node` is the global `crypto` (or `globalThis.crypto`) or an import of Node's crypto module as a whole. */
const isCryptoObject = (context, node) => {
    if (node.type === "MemberExpression" && !node.computed && node.object.type === "Identifier" && node.object.name === "globalThis" && node.property.type === "Identifier" && node.property.name === "crypto") return true
    if (node.type !== "Identifier") return false
    const variable = variableOf(context, node, node.name)
    if (!variable || variable.defs.length === 0) return node.name === "crypto"
    return variable.defs.every((def) => def.type === "ImportBinding" && CRYPTO_MODULES.has(def.parent.source.value) && def.node.type !== "ImportSpecifier")
}

/** No id is minted outside `platform/ids`. */
export const noAmbientId = {
    meta: {
        type: "problem",
        docs: { description: "`randomUUID`, the `uuid` generators, `nanoid` and `ulid` are used only inside `platform/ids`; code asks the injected `Ids` port." },
        schema: [],
        messages: {
            id: "`{{call}}` mints an id from the ambient random source. Inject the `Ids` port (`@InjectIds() private readonly ids: Ids`, `ids.next()`); a spec then provides `fakeIds()` and every id is the one it said, which a direct call never allows.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        if (isOwnedBy(hfs, filename, "platform", "ids") || inTestWorld(hfs, filename)) return {}
        return {
            ImportDeclaration(node) {
                const source = node.source.value
                if (CRYPTO_MODULES.has(source)) {
                    for (const specifier of node.specifiers) {
                        if (specifier.type === "ImportSpecifier" && (specifier.imported.name ?? specifier.imported.value) === "randomUUID") context.report({ node: specifier, messageId: "id", data: { call: `randomUUID from ${source}` } })
                    }
                    return
                }
                if (!Object.hasOwn(ID_PACKAGES, source)) return
                const banned = ID_PACKAGES[source]
                for (const specifier of node.specifiers) {
                    const imported = specifier.type === "ImportSpecifier" ? (specifier.imported.name ?? specifier.imported.value) : specifier.type === "ImportDefaultSpecifier" ? "default" : "*"
                    if (banned === null || banned.includes(imported) || imported === "*") context.report({ node: specifier, messageId: "id", data: { call: `${imported === "default" ? source : imported} from ${source}` } })
                }
            },
            MemberExpression(node) {
                const member = !node.computed && node.property.type === "Identifier" ? node.property.name : node.computed && node.property.type === "Literal" ? node.property.value : null
                if (member === "randomUUID" && isCryptoObject(context, node.object)) context.report({ node, messageId: "id", data: { call: "crypto.randomUUID" } })
            },
        }
    },
}

/** The rule this law contributes to the plugin. */
export const rules = {
    "no-ambient-id": noAmbientId,
}

/** Starts at error: no baseline exists, and the repositories' fix lanes clear the debt with an Ids codemod. */
export const recommended = {
    "starci-be/no-ambient-id": "error",
}
