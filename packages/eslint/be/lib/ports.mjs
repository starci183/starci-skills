/**
 * Questions a rule asks about WHERE a value's type or a file comes from, answered by the TypeScript checker and the HFS
 * slot view - never by a receiver name, a class name or a path pattern.
 *
 * A platform port (`Logger`, `Clock`, `Inbox`) is an interface a `platform/<capability>` owner declares; a rule that
 * needs to know "is this receiver the Logger" asks whether the receiver's type is declared by that owner
 * (`isOwnedType`), so a renamed receiver, a property injection and a lookalike class in another owner all get the
 * right answer. Everything here refuses to run without typed linting (see `types.mjs`).
 */
import ts from "typescript"
import { hfsOf } from "./hfs.mjs"
import { typeOrigins, typed } from "./types.mjs"

/** The last segment of a forward-slash path. */
export const baseName = (file) => String(file).replace(/\\/g, "/").split("/").pop() ?? ""

/**
 * The capability or feature an HFS slot binds a file to (`logging` for `src/modules/platform/logging/x.ts`), or null.
 *
 * @param {object} hfs - The HFS view.
 * @param {string} file - A file path.
 * @returns {string | null} The owner name the slot binds.
 */
export const ownerNameOf = (hfs, file) => {
    const bindings = hfs.classify(file).bindings ?? {}
    return bindings.capability ?? bindings.feature ?? null
}

/**
 * The part of a file's path below its slot root (`migrations/1-x.ts` for a file of `be.persistence`), or null when no slot owns it.
 *
 * @param {object} hfs - The HFS view.
 * @param {string} file - A file path.
 * @returns {string | null} The slot-relative path.
 */
export const pathInSlot = (hfs, file) => {
    const found = hfs.classify(file)
    if (!found.slot) return null
    const rel = hfs.relative(file)
    return found.root ? rel.slice(found.root.length + 1) : rel
}

/** A migration: a file of slot `be.persistence` below its `migrations/` folder - the one place schema-changing SQL may be written. */
export const isMigrationFile = (hfs, file) => hfs.slotOf(file) === "be.persistence" && (pathInSlot(hfs, file) ?? "").startsWith("migrations/")

/** True when the file belongs to the named capability of the named tier (`platform`, `clock`). */
export const isOwnedBy = (hfs, file, tier, capability) => hfs.tierOf(file) === tier && ownerNameOf(hfs, file) === capability

/**
 * True when the node's type is `name` declared inside the repository by the given owner (a platform port, a brand).
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - The expression or type node to type.
 * @param {{ name: string, capability: string, tier?: string }} owner - The declared name and its owner; without `tier` any tier matches.
 * @returns {boolean} Whether one of the node's type origins matches.
 */
export const isOwnedType = (context, node, { name, capability, tier }) => {
    const hfs = hfsOf(context)
    return typeOrigins(context, node).some((origin) =>
        origin.module === null
        && origin.name === name
        && ownerNameOf(hfs, origin.file) === capability
        && (tier === undefined || hfs.tierOf(origin.file) === tier))
}

/** The `Logger` port of `platform/logging`. */
export const isLoggerType = (context, node) => isOwnedType(context, node, { name: "Logger", capability: "logging", tier: "platform" })

/**
 * True when the call is `<receiver>.<method>(...)` on a receiver typed as the `Logger` port.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - A CallExpression.
 * @returns {boolean} Whether it is a logger call.
 */
export const isLoggerCall = (context, node) =>
    node.callee.type === "MemberExpression" && !node.callee.computed && isLoggerType(context, node.callee.object)

/** What one enum-typed value is: the enum's name and file, or null when the type is not (only) enum members. */
const enumOf = (declaration) => {
    if (declaration && ts.isEnumMember(declaration)) return declaration.parent
    if (declaration && ts.isEnumDeclaration(declaration)) return declaration
    return null
}

/**
 * The enums a node's value belongs to, when its type is an enum member, an enum, or a union of members.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - The expression to type.
 * @returns {Array<{ name: string, file: string }> | null} One entry per enum, or null when any part of the type is not an enum member.
 */
export const enumsOf = (context, node) => {
    const { checker, toTs } = typed(context)
    const tsNode = toTs(node)
    if (!tsNode) return null
    const type = checker.getTypeAtLocation(tsNode)
    const parts = type.isUnion() ? type.types : [type]
    const found = []
    for (const part of parts) {
        const symbol = part.getSymbol?.()
        const owner = enumOf(symbol?.valueDeclaration ?? symbol?.declarations?.[0])
        if (!owner) return null
        found.push({ name: owner.name.text, file: String(owner.getSourceFile().fileName).replace(/\\/g, "/") })
    }
    return found.length > 0 ? found : null
}

/**
 * The name of the enum member an expression is, when its type is one enum-literal type (`PublicReason.SignedWebhook`).
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - The expression to type.
 * @returns {{ enumName: string, member: string } | null} The enum and the member, or null.
 */
export const enumMemberOf = (context, node) => {
    const { checker, toTs } = typed(context)
    const tsNode = toTs(node)
    if (!tsNode) return null
    const symbol = checker.getTypeAtLocation(tsNode).getSymbol?.()
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0]
    if (!declaration || !ts.isEnumMember(declaration)) return null
    return { enumName: declaration.parent.name.text, member: declaration.name.getText() }
}

/**
 * The package a declaration file belongs to (`typeorm`, `@nestjs/typeorm`), read from its innermost `node_modules/` folder, or null for the repository's own source.
 *
 * @param {string} file - A declaration file path.
 * @returns {string | null} The package name.
 */
export const packageOfFile = (file) => {
    const normal = String(file).replace(/\\/g, "/")
    const at = normal.lastIndexOf("/node_modules/")
    if (at < 0) return null
    const parts = normal.slice(at + "/node_modules/".length).split("/")
    return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0]
}
