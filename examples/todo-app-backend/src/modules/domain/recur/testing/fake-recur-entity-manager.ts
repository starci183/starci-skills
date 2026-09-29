/**
 * A minimal in-memory stand-in for `EntityManager`, scoped to however many entity classes a recur spec
 * needs at once (RuleEntity, OccurrenceEntity, and TaskEntity - RuleService/OccurrenceService/
 * GeneratorService all reach more than one entity through the same injected manager, unlike task's or
 * session's own single-entity `createFakeEntityManager`). Each entity class gets its own table, keyed by
 * `id`, matching every entity in this schema. Only the methods a capability service actually calls
 * (`findOneBy`, `findBy`, `save`, `delete`) are implemented, each shaped like the real `EntityManager`
 * method it replaces. Not a real TypeORM `EntityManager`, so it is cast through `unknown` at the
 * injection site, matching `platform/databases/testing/fake-entity-manager.ts`'s own
 * convention for the same reason.
 */
export const createFakeRecurEntityManager = () => {
    const tables = new Map<unknown, Map<string, Record<string, unknown>>>()

    const tableFor = (target: unknown): Map<string, Record<string, unknown>> => {
        let table = tables.get(target)
        if (!table) {
            table = new Map()
            tables.set(target,
                table)
        }
        return table
    }

    return {
        findOneBy(target: unknown, where: Record<string, unknown>): Promise<Record<string, unknown> | null> {
            const table = tableFor(target)
            if (typeof where.id === "string" && Object.keys(where).length === 1) {
                return Promise.resolve(table.get(where.id) ?? null)
            }
            for (const row of table.values()) {
                if (matches(row,
                    where)) return Promise.resolve(row)
            }
            return Promise.resolve(null)
        },
        findBy(target: unknown, where: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
            return Promise.resolve([...tableFor(target).values()].filter(row => matches(row,
                where)))
        },
        find(target: unknown, options: { where?: Record<string, unknown>; take?: number } = {
        }): Promise<Array<Record<string, unknown>>> {
            const found = [...tableFor(target).values()].filter(row => matches(row,
                options.where ?? {
                }))
            return Promise.resolve(options.take === undefined ? found : found.slice(0,
                options.take))
        },
        save(target: unknown, entityLike: Record<string, unknown>): Promise<Record<string, unknown>> {
            tableFor(target).set(entityLike.id as string,
                entityLike)
            return Promise.resolve(entityLike)
        },
        delete(target: unknown, criteria: string): Promise<void> {
            tableFor(target).delete(criteria)
            return Promise.resolve()
        },
    }
}

function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
    return Object.keys(where).every(key => row[key] === where[key])
}
