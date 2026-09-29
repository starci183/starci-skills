import {
    NotifyDeliveryAttemptEntity,
} from "@modules/platform/databases/index"
import {
    NotifyDigestWindowEntity,
} from "@modules/platform/databases/index"
import {
    NotifyNotificationEntity,
} from "@modules/platform/databases/index"
import {
    NotifyPreferenceEntity,
} from "@modules/platform/databases/index"

type Row = Record<string, unknown>;

/**
 * A minimal in-memory stand-in for `EntityManager`, holding every notify entity class a spec can wire
 * at once (NotifyService's own spec needs all four tables behind the one injected manager, the same
 * multi-entity shape as recur/testing/fake-recur-entity-manager.ts). Each entity class gets its own
 * table and its own primary key - preference rows key on `personId:channel`, delivery attempts on
 * `notificationId`, the rest on `id` - matching how the real schema identifies each row. Only the
 * methods a notify service actually calls (`findOneBy`, `findBy`, `save`, `delete`) are implemented.
 * Not a real TypeORM `EntityManager`, so it is cast through `unknown` at the injection site, matching
 * platform/databases/testing/fake-entity-manager.ts's convention.
 */
export const createFakeNotifyEntityManager = () => {
    const tables = new Map<unknown, Map<string, Row>>()

    const tableFor = (target: unknown): Map<string, Row> => {
        let table = tables.get(target)
        if (!table) {
            table = new Map()
            tables.set(target,
                table)
        }
        return table
    }

    return {
        findOneBy(target: unknown, where: Row): Promise<Row | null> {
            for (const row of tableFor(target).values()) {
                if (matches(row,
                    where)) return Promise.resolve(row)
            }
            return Promise.resolve(null)
        },
        findBy(target: unknown, where: Row): Promise<Array<Row>> {
            return Promise.resolve([...tableFor(target).values()].filter(row => matches(row,
                where)))
        },
        find(target: unknown, options: { where?: Row; take?: number } = {
        }): Promise<Array<Row>> {
            const found = [...tableFor(target).values()].filter(row => matches(row,
                options.where ?? {
                }))
            return Promise.resolve(options.take === undefined ? found : found.slice(0,
                options.take))
        },
        save(target: unknown, entityLike: Row): Promise<Row> {
            tableFor(target).set(keyOf(target,
                entityLike),
            entityLike)
            return Promise.resolve(entityLike)
        },
        delete(target: unknown, criteria: string): Promise<void> {
            tableFor(target).delete(criteria)
            return Promise.resolve()
        },
    }
}

function keyOf(target: unknown, row: Row): string {
    if (target === NotifyPreferenceEntity) return `${row.personId}:${row.channel}`
    if (target === NotifyDeliveryAttemptEntity) return row.notificationId as string
    if (target === NotifyNotificationEntity || target === NotifyDigestWindowEntity) return row.id as string
    return row.id as string
}

/** A duck-typed check for TypeORM's `IsNull()` FindOperator, so a fake spec can exercise the exact same
 * `IsNull()` call a real query does (see digest.service.ts's comment on why literal `null` is refused)
 * without this fake needing the real `typeorm` runtime to construct one - the same convention as
 * platform/databases/testing/fake-entity-manager.ts's `matches`. */
function isIsNullOperator(value: unknown): boolean {
    return typeof value === "object" && value !== null && (value as { _type?: unknown })._type === "isNull"
}

/** The same duck-typed check for TypeORM's `In([...])` FindOperator: its type tag and the list it carries. */
function inOperatorValues(value: unknown): ReadonlyArray<unknown> | null {
    if (typeof value !== "object" || value === null) return null
    const operator = value as { _type?: unknown; _value?: unknown }
    return operator._type === "in" && Array.isArray(operator._value) ? operator._value : null
}

function matches(row: Row, where: Row): boolean {
    return Object.keys(where).every(key => {
        const criterion = where[key]
        const listed = inOperatorValues(criterion)
        if (listed) return listed.includes(row[key])
        if (isIsNullOperator(criterion)) return row[key] === null || row[key] === undefined
        return row[key] === criterion
    })
}
