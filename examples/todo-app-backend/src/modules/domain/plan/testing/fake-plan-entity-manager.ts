/**
 * A minimal in-memory stand-in for `EntityManager`, scoped to however many entity classes a plan spec
 * needs at once (SubscriptionEntity, PaymentIntentEntity, and TaskEntity when the cap-guard/usage specs
 * wire a real TaskService beside SubscriptionService - the same multi-entity shape as
 * recur/testing/fake-recur-entity-manager.ts, since every service here shares one injected manager).
 * Each entity class gets its own table, keyed by `id`, matching every entity in this schema. Only the
 * methods a capability service actually calls (`findOneBy`, `findBy`, `save`, `delete`) are
 * implemented. Not a real TypeORM `EntityManager`, so it is cast through `unknown` at the injection
 * site, matching platform/databases/postgresql/primary/testing/fake-entity-manager.ts's convention.
 */
export const createFakePlanEntityManager = () => {
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
        async findOneBy(target: unknown, where: Record<string, unknown>): Promise<Record<string, unknown> | null> {
            const table = tableFor(target)
            if (typeof where.id === "string" && Object.keys(where).length === 1) {
                return table.get(where.id) ?? null
            }
            for (const row of table.values()) {
                if (matches(row,
                    where)) return row
            }
            return null
        },
        async findBy(target: unknown, where: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
            return [...tableFor(target).values()].filter(row => matches(row,
                where))
        },
        async save(target: unknown, entityLike: Record<string, unknown>): Promise<Record<string, unknown>> {
            tableFor(target).set(entityLike.id as string,
                entityLike)
            return entityLike
        },
        async delete(target: unknown, criteria: string): Promise<void> {
            tableFor(target).delete(criteria)
        },
    }
}

function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
    return Object.keys(where).every(key => row[key] === where[key])
}
