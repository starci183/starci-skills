import {
    PostgresPrimaryUnavailableException 
} from "@modules/shared/exceptions/errors/postgres/postgres-primary-unavailable"

/**
 * A minimal in-memory stand-in for `EntityManager`, scoped to one entity and keyed by one field or a
 * composite key function - only the methods a capability service actually calls (`findOneBy`, `findBy`,
 * `save`, `delete`), each shaped like the real `EntityManager` method it replaces
 * (`(target, where/criteria)`, ignoring `target` since each spec that builds one already fixes the
 * entity type). It is not a real TypeORM `EntityManager`, so it is cast through `unknown` at the
 * injection site rather than claimed to satisfy the full `EntityManager` surface.
 *
 * `keyOf` is either a single field name (the original shape, used by every entity with a single-column
 * primary key) or a function deriving a composite key string from a partial row - needed for
 * data.notify.preference's (personId, channel) primary key, where no single field is unique on its own.
 */
export const createFakeEntityManager = <T extends object>(keyOf: keyof T | ((row: Partial<T>) => string)) => {
    const rows = new Map<string, T>()
    const keyOfPartial = (value: Partial<T>): string | undefined => {
        if (typeof keyOf === "function") return keyOf(value)
        const raw = value[keyOf]
        return raw === undefined ? undefined : String(raw)
    }
    return {
        async findOneBy(_target: unknown, where: Partial<T>): Promise<T | null> {
            const key = keyOfPartial(where)
            if (key !== undefined) return rows.get(key) ?? null
            for (const row of rows.values()) if (matches(row,
                where)) return row
            return null
        },
        async findBy(_target: unknown, where: Partial<T>): Promise<Array<T>> {
            return [...rows.values()].filter(row => matches(row,
                where))
        },
        async save(_target: unknown, entityLike: Partial<T>): Promise<T> {
            const entity = entityLike as T
            const key = keyOfPartial(entity)
            if (key === undefined) {
                throw new PostgresPrimaryUnavailableException({
                    reason: "createFakeEntityManager: save() called without enough fields to derive a key",
                })
            }
            rows.set(key,
                entity)
            return entity
        },
        async delete(_target: unknown, criteria: unknown): Promise<void> {
            if (typeof keyOf === "function" && criteria && typeof criteria === "object") {
                const key = keyOf(criteria as Partial<T>)
                rows.delete(key)
                return
            }
            rows.delete(String(criteria))
        },
    }
}

/** A duck-typed check for TypeORM's `IsNull()` FindOperator, so a fake spec can write the exact same
 * `IsNull()` call a real query does (see digest.service.ts's comment on why literal `null` is refused)
 * without this fake needing the real `typeorm` runtime to construct one. */
function isIsNullOperator(value: unknown): boolean {
    return typeof value === "object" && value !== null && (value as { _type?: unknown })._type === "isNull"
}

function matches<T extends object>(row: T, where: Partial<T>): boolean {
    return (Object.keys(where) as Array<keyof T>).every(key => {
        const criterion = where[key]
        if (isIsNullOperator(criterion)) return row[key] === null || row[key] === undefined
        return row[key] === criterion
    })
}
