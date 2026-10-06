/**
 * Declaration-site questions for the type-aware rules of R38-R45: WHERE a type or a class is declared (which owner,
 * which tier) and what it derives from. A rule never asks what a receiver is called; it asks what its type is and which
 * owner of the repository declares that type. The owner and the tier come from the HFS slot view, never from a path.
 */
import ts from "typescript"
import { hfsOf } from "./hfs.mjs"
import { typeOrigins, typed } from "./types.mjs"

/** The last segment of an owner root (`src/modules/platform/errors` gives `errors`), or null when there is no owner. */
export const ownerName = (root) => (root ? root.split("/").at(-1) : null)

/** True when `file` belongs to the owner `<name>` of the given tier (`platform`, `errors`). */
export const isOwnedBy = (hfs, file, tier, name) => hfs.tierOf(file) === tier && ownerName(hfs.ownerOf(file)) === name

/**
 * True when the node's type is `name`, declared by the owner `<tier>/<capability>` of this repository.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - The node to type.
 * @param {string} name - The declared symbol name (`Logger`).
 * @param {string} tier - The tier of the declaring owner (`platform`, `domain`).
 * @param {string} capability - The owner's directory name (`logging`).
 * @returns {boolean} Whether one of the type's origins matches.
 */
export const isOwnedType = (context, node, name, tier, capability) => {
    const hfs = hfsOf(context)
    return originsOf(context, node).some((origin) => origin.name === name && isOwnedBy(hfs, origin.file, tier, capability))
}

/**
 * Where the type of a node is declared, keeping a union ALIAS whole (`ErrorKind` is a union of literals; its origin is the
 * alias declaration, not the literals). Falls back to `typeOrigins` for every other type.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - An expression or type node.
 * @returns {Array<{ name: string, file: string, module: string | null }>} The declarations of the type.
 */
export const originsOf = (context, node) => {
    const type = typeOf(context, node)
    const alias = type?.aliasSymbol?.declarations?.[0]
    if (alias) return [{ name: type.aliasSymbol.name, file: String(alias.getSourceFile().fileName).replace(/\\/g, "/"), module: null }]
    return typeOrigins(context, node)
}

/** The TypeScript type of an ESTree node. */
export const typeOf = (context, node) => {
    const { checker, toTs } = typed(context)
    const tsNode = toTs(node)
    if (!tsNode) return null
    return ts.isTypeNode(tsNode) ? checker.getTypeFromTypeNode(tsNode) : checker.getTypeAtLocation(tsNode)
}

/**
 * True when the node's type is a member of the enum `enumName` declared by the owner `<tier>/<capability>`.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - The expression (`PublicReason.Health`).
 * @param {string} enumName - The enum's declared name.
 * @param {string} tier - The tier of the declaring owner.
 * @param {string} capability - The declaring owner's directory name.
 * @returns {boolean} Whether the value is a member of that enum.
 */
export const isOwnedEnumMember = (context, node, enumName, tier, capability) => {
    const hfs = hfsOf(context)
    const type = typeOf(context, node)
    const parts = partsOf(type)
    if (parts.length === 0) return false
    return parts.every((part) => {
        if (!(part.flags & ts.TypeFlags.EnumLiteral)) return false
        const declaration = part.getSymbol()?.declarations?.[0]
        const owner = declaration?.parent
        return (
            declaration !== undefined &&
            ts.isEnumMember(declaration) &&
            owner !== undefined &&
            ts.isEnumDeclaration(owner) &&
            owner.name.text === enumName &&
            isOwnedBy(hfs, String(declaration.getSourceFile().fileName).replace(/\\/g, "/"), tier, capability)
        )
    })
}

/** The members of a union type, or the type itself. */
export const partsOf = (type) => (type?.isUnion?.() ? type.types : type ? [type] : [])

const NULLISH = ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void

/** The members of a type with `undefined` and `null` removed (an optional property's real type). */
export const presentParts = (type) => partsOf(type).filter((part) => !(part.flags & NULLISH))

/**
 * True when the type, or any class it extends, satisfies `test(symbolName, declaringFileName)`.
 *
 * @param {object} checker - The type checker.
 * @param {object} type - The type to walk.
 * @param {(name: string, file: string) => boolean} test - The predicate over one class or interface in the chain.
 * @param {number} [depth] - The recursion guard.
 * @returns {boolean} Whether the chain holds a match.
 */
export const derives = (checker, type, test, depth = 0) => {
    if (!type || depth > 24) return false
    const symbol = type.getSymbol?.()
    if (symbol?.declarations?.some((declaration) => test(symbol.name, String(declaration.getSourceFile().fileName).replace(/\\/g, "/")))) return true
    const target = type.target ?? type
    if (!target.isClassOrInterface?.()) return false
    return checker.getBaseTypes(target).some((base) => derives(checker, base, test, depth + 1))
}

/** True when the type is (or extends) a declaration of the global `Error` from the TypeScript library. */
export const derivesFromBuiltinError = (context, type) => {
    const { program, checker } = typed(context)
    return derives(checker, type, (name, file) => {
        if (name !== "Error") return false
        const source = program.getSourceFile(file)
        return source ? program.isSourceFileDefaultLibrary(source) : false
    })
}

/** True when the type is (or extends) `DomainError` as declared by the repository's `platform/errors` owner. */
export const derivesFromDomainError = (context, type) => {
    const hfs = hfsOf(context)
    const { checker } = typed(context)
    return derives(checker, type, (name, file) => name === "DomainError" && isOwnedBy(hfs, file, "platform", "errors"))
}

/**
 * The owner-relative `errors/<capability>.error.ts` home of an error family, or null for a file that is not one.
 *
 * @param {object} hfs - The HFS view.
 * @param {string} filename - The linted filename.
 * @returns {{ capability: string, owner: string } | null} The file's capability name and its owner's directory name.
 */
export const errorHomeOf = (hfs, filename) => {
    const root = hfs.ownerOf(filename)
    if (!root) return null
    const inside = hfs.relative(filename).slice(root.length + 1)
    const match = /^errors\/([a-z][a-z0-9-]*)\.error\.ts$/.exec(inside)
    return match ? { capability: match[1], owner: ownerName(root) } : null
}

/** The names an import brings in from one package: local name to imported name (`*` for a namespace, `default`). */
export const importsFrom = (program, matches) => {
    const names = new Map()
    for (const statement of program.body) {
        if (statement.type !== "ImportDeclaration" || typeof statement.source.value !== "string" || !matches(statement.source.value)) continue
        for (const specifier of statement.specifiers) {
            if (specifier.type === "ImportSpecifier") names.set(specifier.local.name, specifier.imported.name ?? specifier.imported.value)
            else if (specifier.type === "ImportNamespaceSpecifier") names.set(specifier.local.name, "*")
            else names.set(specifier.local.name, "default")
        }
    }
    return names
}
