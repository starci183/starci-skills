import {
    AuditErasureRequestEntity 
} from "@modules/platform/databases/postgresql/primary/entities/audit-erasure-request.entity"
import {
    AuditKeyEntity 
} from "@modules/platform/databases/postgresql/primary/entities/audit-key.entity"
import {
    AuditLogLineEntity 
} from "@modules/platform/databases/postgresql/primary/entities/audit-log-line.entity"

/**
 * A minimal in-memory stand-in for `EntityManager`, scoped to the three entities this feature owns and
 * keyed per-entity (unlike the platform's own `createFakeEntityManager`, which is scoped to one entity),
 * because `AuditLogService`/`AuditErasureService` both reach more than one entity through the same
 * injected manager, exactly as the real one does. `_rowsFor` is deliberately exposed: ac.audit.append
 * -only.chain-detects-tamper's own test needs to mutate the underlying store directly, bypassing this
 * fake's own `save`/`delete`, the same way a rogue admin or a compromised disk would bypass
 * AuditLogService's append-only write path.
 */
type Row = Record<string, unknown>;
type EntityTarget = typeof AuditLogLineEntity | typeof AuditKeyEntity | typeof AuditErasureRequestEntity;

const KEY_FIELD: Record<string, string> = {
    AuditLogLineEntity: "id",
    AuditKeyEntity: "personId",
    AuditErasureRequestEntity: "requestId",
}

const matches = (row: Row, where: Row): boolean => Object.keys(where).every(key => row[key] === where[key])

/** Create fake audit entity manager for the fake-audit-entity-manager flow - one named step of the testing capability's behaviour. */
export const createFakeAuditEntityManager = () => {
    const stores = new Map<string, Array<Row>>()
    let nextLineId = 1

    const storeFor = (target: EntityTarget): Array<Row> => {
        const key = target.name
        if (!stores.has(key)) stores.set(key,
            [])
        return stores.get(key) as Array<Row>
    }

    return {
        async findOneBy(target: EntityTarget, where: Row): Promise<Row | null> {
            return storeFor(target).find(row => matches(row,
                where)) ?? null
        },

        async find(target: EntityTarget, options: { where?: Row; order?: Record<string, "ASC" | "DESC">; take?: number } = {
        }): Promise<Array<Row>> {
            let rows = [...storeFor(target)]
            if (options.where) rows = rows.filter(row => matches(row,
options.where as Row))
            if (options.order) {
                const [[field,
                    direction]] = Object.entries(options.order)
                rows.sort((a, b) => {
                    const diff = Number(a[field]) - Number(b[field])
                    return direction === "DESC" ? -diff : diff
                })
            }
            if (options.take !== undefined) rows = rows.slice(0,
                options.take)
            return rows
        },

        async save(target: EntityTarget, entityLike: Row): Promise<Row> {
            const keyField = KEY_FIELD[target.name]
            const rows = storeFor(target)
            const entity: Row = {
                ...entityLike 
            }
            if (target.name === "AuditLogLineEntity" && entity.id === undefined) {
                entity.id = String(nextLineId++)
            }
            const key = entity[keyField]
            const existingIndex = rows.findIndex(row => row[keyField] === key)
            if (existingIndex >= 0) {
                rows[existingIndex] = entity
            } else {
                rows.push(entity)
            }
            return entity
        },

        async delete(target: EntityTarget, criteria: Row): Promise<void> {
            const rows = storeFor(target)
            const index = rows.findIndex(row => matches(row,
                criteria))
            if (index >= 0) rows.splice(index,
                1)
        },

        /** Test-only out-of-band access: the tamper-evidence fuzz mutates/removes rows through this,
     * never through `save`/`delete`. */
        _rowsFor(target: EntityTarget): Array<Row> {
            return storeFor(target)
        },
    }
}
