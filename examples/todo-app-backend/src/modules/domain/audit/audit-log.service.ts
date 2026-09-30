import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { MoreThan } from "typeorm"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import { GENESIS_HASH, hashLine } from "./audit-chain.policy"
import { AuditKeystoreService } from "./audit-keystore.service"
import type {
    AppendLineParams,
    AppendedLineResult,
    ReadChainParams,
    ResolvedAuditLine,
    VerifyChainResult,
} from "./audit.contracts"
import { LOCK_AUDIT_CHAIN } from "./persistence/audit.sql"
import { AuditLogLineEntity } from "./persistence/entities/audit-log-line.entity"

@Injectable()
/**
 * The append-only, hash-chained, per-person-sealed log. A line's stored bytes and its position never change: this
 * service only inserts and reads, and no path shortens a line's life, so retention holds by the absence of any
 * eviction code.
 */
export class AuditLogService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly keystore: AuditKeystoreService,
    ) {}

    /**
     * Appends one line in the caller transaction. The transaction first takes the chain lock, so appends are serialized
     * and each line chains onto the true last hash; the actor id is sealed under the person key, never stored in clear.
     */
    async append(params: AppendLineParams): Promise<AppendedLineResult> {
        await params.manager.query(LOCK_AUDIT_CHAIN, [])
        const { keyId, key } = await this.keystore.getOrCreateKey({
            manager: params.manager,
            personId: params.actorId,
            at: params.at,
        })
        const actor = this.keystore.seal(key, params.actorId)
        const [last] = await params.manager.find(AuditLogLineEntity, { order: { id: "DESC" }, take: 1 })
        const prevHash = last?.hash ?? GENESIS_HASH
        const line = { prevHash, at: params.at, action: params.action, target: params.target, keyId, actor }
        const saved = await params.manager.save(AuditLogLineEntity, { ...line, hash: hashLine(line) })
        return { lineId: saved.id }
    }

    /**
     * Recomputes the chain from the first line, batch by batch. It re-derives each previous hash from the previous row's
     * stored hash (never trusting a row's own prevHash), so a removed line surfaces as a broken link at the line that
     * followed it and a changed field as a content mismatch at that line.
     */
    async verifyChain(): Promise<VerifyChainResult> {
        let expectedPrev = GENESIS_HASH
        let index = 0
        let after: string | null = null
        let more = true
        while (more) {
            const rows: Array<AuditLogLineEntity> = await this.entityManager.find(AuditLogLineEntity, {
                where: after === null ? {} : { id: MoreThan(after) },
                order: { id: "ASC" },
                take: LIST_ROWS_MAX,
            })
            for (const row of rows) {
                if (row.prevHash !== expectedPrev) {
                    return { valid: false, totalLines: index, break: { index, reason: "broken-prev-hash" } }
                }
                if (hashLine(row) !== row.hash) {
                    return { valid: false, totalLines: index, break: { index, reason: "content-mismatch" } }
                }
                expectedPrev = row.hash
                index += 1
            }
            after = rows.at(-1)?.id ?? after
            more = rows.length === LIST_ROWS_MAX
        }
        return { valid: true, totalLines: index, break: null }
    }

    /**
     * The first LIST_ROWS_MAX lines of the chain, oldest first, optionally narrowed to one action or target: the read
     * an administrator runs. Every line is resolved, so a tombstoned line reads back as tombstoned.
     */
    async readChain(params: ReadChainParams): Promise<Array<ResolvedAuditLine>> {
        const where: FindOptionsWhere<AuditLogLineEntity> = {}
        if (params.action !== null) where.action = params.action
        if (params.target !== null) where.target = params.target
        const rows = await this.entityManager.find(AuditLogLineEntity, {
            where,
            order: { id: "ASC" },
            take: LIST_ROWS_MAX,
        })
        return this.resolve(rows)
    }

    /**
     * The lines a person produced, oldest first, at most LIST_ROWS_MAX. It filters by key id (opaque, never the person
     * id), so the response never carries the key id and a person whose key was destroyed reads nothing.
     */
    async findLinesForPerson(personId: string): Promise<Array<ResolvedAuditLine>> {
        const keyId = await this.keystore.getKeyIdForPerson({ personId })
        if (!keyId) return []
        const rows = await this.entityManager.find(AuditLogLineEntity, {
            where: { keyId },
            order: { id: "ASC" },
            take: LIST_ROWS_MAX,
        })
        return this.resolve(rows)
    }

    /** Resolves rows with one key lookup for all of them: no key, or a key that no longer opens the actor, tombstones the line. */
    private async resolve(rows: ReadonlyArray<AuditLogLineEntity>): Promise<Array<ResolvedAuditLine>> {
        const keys = await this.keystore.getKeyMaterials({ keyIds: [...new Set(rows.map((row) => row.keyId))] })
        return rows.map((row) => {
            const key = keys.get(row.keyId)
            const opened = key === undefined ? null : this.keystore.unseal(key, row.actor)
            if (opened === null || !opened.opened) {
                return { at: row.at, action: row.action, target: row.target, actor: null, tombstoned: true }
            }
            return { at: row.at, action: row.action, target: row.target, actor: opened.plaintext, tombstoned: false }
        })
    }
}
