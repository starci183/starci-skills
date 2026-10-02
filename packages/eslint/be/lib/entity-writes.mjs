/**
 * Which entities a database write call targets, found by TYPE: a write method called on a typeorm database receiver (`EntityManager`,
 * `DataSource`, `QueryRunner`) or on a typeorm query builder, whose arguments (or, for a query builder, the arguments of any call
 * of the same chain) are the entity class or an instance of it. No variable, class or table name is read.
 */
import { isDatabaseReceiver } from "./db-writes.mjs"
import { typeOrigins } from "./types.mjs"

/** The methods of a manager or query builder that change rows. */
export const WRITE_METHODS = Object.freeze(["update", "save", "insert", "upsert", "delete", "remove", "increment", "decrement", "softDelete", "softRemove", "recover", "restore", "clear"])

/** True when the node's type is a query builder of `typeorm` (`SelectQueryBuilder`, `UpdateQueryBuilder` ...). */
const isQueryBuilder = (context, node) => typeOrigins(context, node).some((origin) => origin.module === "typeorm" && origin.name.endsWith("QueryBuilder"))

/** The declarations (class origins) of the entities a database write call targets, or `[]` when the node is not such a call. */
export const writtenEntityOrigins = (context, node) => {
    const callee = node.callee
    if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier" || !WRITE_METHODS.includes(callee.property.name)) return []
    if (!isDatabaseReceiver(context, callee.object) && !isQueryBuilder(context, callee.object)) return []
    const candidates = [...node.arguments]
    for (let link = callee.object; link; ) {
        if (link.type === "CallExpression") {
            candidates.push(...link.arguments)
            link = link.callee.type === "MemberExpression" ? link.callee.object : null
        } else if (link.type === "MemberExpression") link = link.object
        else if (link.type === "TSNonNullExpression" || link.type === "AwaitExpression") link = link.expression ?? link.argument
        else link = null
    }
    // The entity of a builder write may come later in the same chain (`.delete().from(Entity)`, `.insert().into(Entity)`).
    for (let outer = node; outer.parent?.type === "MemberExpression" && outer.parent.object === outer && outer.parent.parent?.type === "CallExpression" && outer.parent.parent.callee === outer.parent; ) {
        outer = outer.parent.parent
        candidates.push(...outer.arguments)
    }
    return candidates.flatMap((candidate) => typeOrigins(context, candidate)).filter((origin) => origin.module === null)
}
