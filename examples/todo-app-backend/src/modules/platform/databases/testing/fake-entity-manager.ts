import type {
    FindOperator
} from "typeorm"
import {
    PostgresPrimaryUnavailableException,
} from "../errors/postgres-primary-unavailable"

/** A filter: each field is a value or a TypeORM find operator such as `IsNull()`, the way a real `where` is written. */
export type FakeWhere<T extends object> = { [K in keyof T]?: T[K] | FindOperator<T[K]> }

type FakeEntityKey<T extends object> = keyof T | ((row: Partial<T>) => string)

interface FakeEntityManagerResult<T extends object> {
    findOneBy(target: unknown, where: FakeWhere<T>): Promise<T | null>
    findBy(target: unknown, where: FakeWhere<T>): Promise<Array<T>>
    find(target: unknown, options?: { where?: FakeWhere<T>; take?: number }): Promise<Array<T>>
    save(target: unknown, entityLike: Partial<T>): Promise<T>
    delete(target: unknown, criteria: unknown): Promise<void>
}

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
export const createFakeEntityManager = <T extends object>(keyOf: FakeEntityKey<T>): FakeEntityManagerResult<T> => {
    const rows = new Map<string, T>()
    const keyOfPartial = (value: Partial<T>): string | undefined => {
        if (typeof keyOf === "function") return keyOf(value)
        const raw = value[keyOf]
        return raw === undefined ? undefined : String(raw)
    }
    return {
        findOneBy(_target: unknown, where: FakeWhere<T>): Promise<T | null> {
            const key = keyOfPartial(plainFields(where))
            if (key !== undefined) return Promise.resolve(rows.get(key) ?? null)
            for (const row of rows.values()) if (matches(row,
                where)) return Promise.resolve(row)
            return Promise.resolve(null)
        },
        findBy(_target: unknown, where: FakeWhere<T>): Promise<Array<T>> {
            return Promise.resolve([...rows.values()].filter(row => matches(row,
                where)))
        },
        find(_target: unknown, options: { where?: FakeWhere<T>; take?: number } = {
        }): Promise<Array<T>> {
            const found = [...rows.values()].filter(row => matches(row,
                options.where ?? {
                }))
            return Promise.resolve(options.take === undefined ? found : found.slice(0,
                options.take))
        },
        save(_target: unknown, entityLike: Partial<T>): Promise<T> {
            const entity = entityLike as T
            const key = keyOfPartial(entity)
            if (key === undefined) {
                return Promise.reject(new PostgresPrimaryUnavailableException({
                    reason: "createFakeEntityManager: save() called without enough fields to derive a key",
                }))
            }
            rows.set(key,
                entity)
            return Promise.resolve(entity)
        },
        delete(_target: unknown, criteria: unknown): Promise<void> {
            if (typeof keyOf === "function" && criteria && typeof criteria === "object") {
                const key = keyOf(criteria as Partial<T>)
                rows.delete(key)
                return Promise.resolve()
            }
            rows.delete(String(criteria))
            return Promise.resolve()
        },
    }
}

/** A duck-typed check for TypeORM's `IsNull()` FindOperator, so a fake spec can write the exact same
 * `IsNull()` call a real query does (see digest.service.ts's comment on why literal `null` is refused)
 * without this fake needing the real `typeorm` runtime to construct one. */
function isIsNullOperator(value: unknown): boolean {
    return typeof value === "object" && value !== null && (value as { _type?: unknown })._type === "isNull"
}

/** The fields of a filter that are plain values: an operator such as `IsNull()` cannot name a row by key. */
function plainFields<T extends object>(where: FakeWhere<T>): Partial<T> {
    const plain: Partial<T> = {
    }
    for (const key of Object.keys(where) as Array<keyof T>) {
        const criterion = where[key]
        if (!isOperator(criterion)) plain[key] = criterion as T[keyof T]
    }
    return plain
}

function isOperator(value: unknown): boolean {
    return typeof value === "object" && value !== null && typeof (value as { _type?: unknown })._type === "string"
}

function matches<T extends object>(row: T, where: FakeWhere<T>): boolean {
    return (Object.keys(where) as Array<keyof T>).every(key => {
        const criterion = where[key]
        if (isIsNullOperator(criterion)) return row[key] === null || row[key] === undefined
        return row[key] === criterion
    })
}
