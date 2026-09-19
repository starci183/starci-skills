import {
    NotifyDeliveryAttemptEntity 
} from "@modules/platform/databases/postgresql/primary/entities/notify-delivery-attempt.entity"
import {
    NotifyDigestWindowEntity 
} from "@modules/platform/databases/postgresql/primary/entities/notify-digest-window.entity"
import {
    NotifyNotificationEntity 
} from "@modules/platform/databases/postgresql/primary/entities/notification.entity"
import {
    NotifyPreferenceEntity 
} from "@modules/platform/databases/postgresql/primary/entities/notify-preference.entity"

type Row = Record<string, unknown>;

/**
 * A minimal in-memory stand-in for `EntityManager`, holding every notify entity class a spec can wire
 * at once (NotifyService's own spec needs all four tables behind the one injected manager, the same
 * multi-entity shape as recur/testing/fake-recur-entity-manager.ts). Each entity class gets its own
 * table and its own primary key - preference rows key on `personId:channel`, delivery attempts on
 * `notificationId`, the rest on `id` - matching how the real schema identifies each row. Only the
 * methods a notify service actually calls (`findOneBy`, `findBy`, `save`, `delete`) are implemented.
 * Not a real TypeORM `EntityManager`, so it is cast through `unknown` at the injection site, matching
 * platform/databases/postgresql/primary/testing/fake-entity-manager.ts's convention.
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
        async findOneBy(target: unknown, where: Row): Promise<Row | null> {
            for (const row of tableFor(target).values()) {
                if (matches(row,
                    where)) return row
            }
            return null
        },
        async findBy(target: unknown, where: Row): Promise<Array<Row>> {
            return [...tableFor(target).values()].filter(row => matches(row,
                where))
        },
        async save(target: unknown, entityLike: Row): Promise<Row> {
            tableFor(target).set(keyOf(target,
                entityLike),
            entityLike)
            return entityLike
        },
        async delete(target: unknown, criteria: string): Promise<void> {
            tableFor(target).delete(criteria)
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
 * platform/databases/postgresql/primary/testing/fake-entity-manager.ts's `matches`. */
function isIsNullOperator(value: unknown): boolean {
    return typeof value === "object" && value !== null && (value as { _type?: unknown })._type === "isNull"
}

function matches(row: Row, where: Row): boolean {
    return Object.keys(where).every(key => {
        const criterion = where[key]
        if (isIsNullOperator(criterion)) return row[key] === null || row[key] === undefined
        return row[key] === criterion
    })
}
