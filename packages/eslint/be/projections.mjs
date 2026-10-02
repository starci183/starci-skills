/**
 * The rules that hold the projection pattern (catalog R146 `BE_PROJECTION_WRITE_OWNER`, R147 `BE_PROJECTION_SHAPE`).
 *
 * A projection is a read model: `modules/projections/<name>/` holds `<name>.projection.ts` (the only class that touches its table:
 * `recompute*` writes it idempotently from the source facts and can replay from scratch, `get*` reads it) and
 * `<name>.projection-entity.ts` (the table's entity). A reactor, a job or a cli command triggers a recompute; an api feature only calls `get*`.
 * A projection publishes no event (R137 refuses `eventBus.publish` outside `modules/domain`).
 *
 * Entities are found by TYPE ORIGIN; the owner and the kind of a file by the slot view. The vocabulary `recompute` and `get` is the
 * pattern's own method contract.
 */
import { writtenEntityOrigins } from "./lib/entity-writes.mjs"
import { hfsOf, inTestWorld } from "./lib/hfs.mjs"
import { baseName } from "./lib/ports.mjs"
import { typed } from "./lib/types.mjs"

const PROJECTION_SLOT = "be.projections"
const ENTITY_SUFFIX = ".projection-entity.ts"
const PROJECTION_SUFFIX = ".projection.ts"

/** True for the test composition, which seeds and inspects tables directly. */
const isTestComposition = (hfs, file) => {
    const tier = hfs.tierOf(file)
    return tier === "e2e" || tier === "fixtures" || inTestWorld(hfs, file)
}

/** The word a method name starts with (`recomputeUserXp` gives `recompute`), or null when the name has no camelCase boundary. */
const verbOf = (name) => {
    const match = /^[a-z]+/.exec(name)
    return match && (match[0].length === name.length || /[A-Z]/.test(name[match[0].length])) ? match[0] : null
}

/** Only a projection writes its table, from its own `<name>.projection.ts`. */
export const projectionWriteOwner = {
    meta: {
        type: "problem",
        docs: { description: "A projection's entity is written only by the `*.projection.ts` of the same projection folder." },
        schema: [],
        messages: {
            foreign: "`{{call}}` writes the read-model table of a projection from outside its `<name>.projection.ts`. A read model has one writer: its projection's `recompute*` method, which is idempotent and can replay from the source facts. Ask the projection to recompute (from a reactor or a job) instead of writing its table.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const file = context.filename
        if (isTestComposition(hfs, file)) return {}
        return {
            CallExpression(node) {
                const entities = writtenEntityOrigins(context, node).filter((origin) => hfs.slotOf(origin.file) === PROJECTION_SLOT && baseName(origin.file).endsWith(ENTITY_SUFFIX))
                if (entities.length === 0) return
                const mine = hfs.slotOf(file) === PROJECTION_SLOT && baseName(file).endsWith(PROJECTION_SUFFIX)
                if (mine && entities.every((origin) => hfs.ownerOf(origin.file) === hfs.ownerOf(file))) return
                context.report({ node, messageId: "foreign", data: { call: context.sourceCode.getText(node.callee) } })
            },
        }
    },
}

/** The slot of an owner's root file: its kind lives there (`trigger`). */
const triggerOfOwner = (hfs, file) => {
    const root = hfs.ownerOf(file)
    const slot = root ? hfs.slotOf(`${root}/index.ts`) : null
    return slot ? (hfs.slot(slot)?.trigger ?? null) : null
}

/** The projection class speaks only `recompute*` and `get*`, never exports its entity, and an api feature never recomputes. */
export const projectionShape = {
    meta: {
        type: "problem",
        docs: { description: "A `*.projection.ts` class has only `recompute*` and `get*` public methods, a projection's `index.ts` exports no projection entity, and an api feature calls only `get*`." },
        schema: [],
        messages: {
            vocabulary: "`{{name}}` is a public method of a projection that is neither `recompute*` nor `get*`. A projection recomputes its table from the source facts (idempotent, replayable) or reads it; anything else belongs in a domain service.",
            entityExported: "This `index.ts` exports from `{{source}}`. The entity of a projection stays inside its folder: the rest of the code reads through `get*` and never sees the table's shape.",
            apiRecompute: "`{{call}}` recomputes a projection from an api feature. The api reads only through `get*`; a reactor, a job or a cli command keeps the read model current.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const file = context.filename
        const found = hfs.classify(file)
        const base = baseName(file)
        const inProjection = found.slot === PROJECTION_SLOT
        const trigger = triggerOfOwner(hfs, file)
        return {
            MethodDefinition(node) {
                if (!inProjection || !base.endsWith(PROJECTION_SUFFIX) || node.kind !== "method" || node.computed || node.key.type !== "Identifier") return
                if (node.accessibility === "private" || node.accessibility === "protected" || node.key.type === "PrivateIdentifier") return
                const verb = verbOf(node.key.name)
                if (verb !== "recompute" && verb !== "get") context.report({ node: node.key, messageId: "vocabulary", data: { name: node.key.name } })
            },
            ExportNamedDeclaration(node) {
                if (!inProjection || base !== "index.ts" || !node.source) return
                if (String(node.source.value).endsWith(".projection-entity")) context.report({ node, messageId: "entityExported", data: { source: node.source.value } })
            },
            CallExpression(node) {
                if (trigger !== "api" || node.callee.type !== "MemberExpression" || node.callee.computed || node.callee.property.type !== "Identifier") return
                if (verbOf(node.callee.property.name) !== "recompute") return
                const { checker, toTs } = typed(context)
                const tsNode = toTs(node)
                const declaration = tsNode ? checker.getResolvedSignature(tsNode)?.declaration : undefined
                if (declaration && hfs.slotOf(declaration.getSourceFile().fileName) === PROJECTION_SLOT) context.report({ node, messageId: "apiRecompute", data: { call: context.sourceCode.getText(node.callee) } })
            },
        }
    },
}

export const rules = {
    "projection-write-owner": projectionWriteOwner,
    "projection-shape": projectionShape,
}

/** The level these laws ask for: `error`, switched off nowhere. */
export const recommended = {
    "starci-be/projection-write-owner": "error",
    "starci-be/projection-shape": "error",
}
