import {
    Injectable
} from "@nestjs/common"
import {
    Clock,
} from "@modules/platform/clock/index"
import {
    sha256Hex,
} from "@modules/platform/primitives/index"
import type {
    EntityManager 
} from "typeorm"
import {
    InjectPrimaryEntityManager,
} from "@modules/platform/databases/index"
import {
    AuditLogLineEntity,
} from "@modules/platform/databases/index"
import {
    AuditKeystoreService 
} from "./audit-keystore.service"
import {
    AuditLogLineRecord 
} from "./types/audit-log-line-record"
import type {
    ResolvedAuditLine 
} from "./types/resolved-audit-line"

/** The most lines one whole-chain read (verify or resolve) loads: far beyond the 400-day retention volume of this example, so a truncated read means the log outgrew the design, not a normal day. */
const MAX_CHAIN_LINES = 1_000_000
/** The most lines one person's own-lines read loads. */
const MAX_LINES_PER_PERSON = 10_000

const GENESIS = "GENESIS"

interface ChainBreak {
  index: number;
  reason: "broken-prev-hash" | "content-mismatch";
}

/** Contract naming the verify chain result shape domain/audit code and its consumers share; a second site never retypes it inline. */
export interface VerifyChainResult {
  readonly valid: boolean;
  readonly totalLines: number;
  readonly break: ChainBreak | null;
}

const hashContent = (prevHash: string, at: Date, action: string, target: string | null, keyId: string, actor: string): string =>
    sha256Hex(`${prevHash}|${at.toISOString()}|${action}|${target ?? ""}|${keyId}|${actor}`)

/**
 * sds.audit.log-chain: appends one hash-chained, per-person-sealed line per tracked action.
 * br.audit.append-only: once appended, a line's stored bytes and its position in the chain never change
 * - this service never issues an UPDATE or DELETE against `audit_log_lines`, only INSERT and read.
 * br.audit.retention: there is correspondingly no eviction path here at all; `sweepRetention` exists
 * only as the named hook nfr.audit.retention's fake-clock harness calls, and it never deletes anything -
 * retention holds by the absence of any code path that could shorten a line's life, not by a flag.
 */
@Injectable()
/** Injectable service owning the audit log logic the audit capability exposes; wired by the capability's own module. */
export class AuditLogService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly keystore: AuditKeystoreService,
        private readonly clock: Clock,
    ) {}

    /** fr.audit.log.append / sds.audit.log-chain's t-append. `actorPersonId` may be the real subject or
   * AuditKeystoreService.SYSTEM_ACTOR_ID for the two lines br.audit.erasure.logged requires. */
    async append(actorPersonId: string, action: string, target: string | null = null): Promise<AuditLogLineRecord> {
        const { keyId, key } = await this.keystore.getOrCreateKey(actorPersonId)
        const at = this.clock.now()
        const sealedActor = this.keystore.seal(key,
            actorPersonId)
        const prevHash = await this.lastHash()
        const hash = hashContent(prevHash,
            at,
            action,
            target,
            keyId,
            sealedActor)
        const saved = await this.entityManager.save(AuditLogLineEntity,
            {
                at,
                action,
                target,
                keyId,
                actor: sealedActor,
                prevHash,
                hash,
            })
        return new AuditLogLineRecord(saved.id,
            at,
            action,
            target,
            actorPersonId,
            false)
    }

    private async lastHash(): Promise<string> {
        const [last] = await this.entityManager.find(AuditLogLineEntity,
            {
                order: {
                    id: "DESC" 
                }, take: 1 
            })
        return last?.hash ?? GENESIS
    }

    /**
   * ac.audit.append-only.chain-detects-tamper: recomputes the chain from the first line forward,
   * re-deriving `prevHash` from the *previous row's actual stored hash* (never trusting a row's own
   * stored `prevHash` blindly) so a removed line surfaces as a broken link at the line that followed it,
   * and a changed field surfaces as a content mismatch at that line - exactly the two failure shapes the
   * acceptance criterion names. `break.index` is the 0-based position in the chain as currently stored,
   * which is where a fuzz test finds the row it mutated once a removed line has shifted every later
   * position down by one.
   */
    async verifyChain(): Promise<VerifyChainResult> {
        const rows = await this.entityManager.find(AuditLogLineEntity,
            {
                order: {
                    id: "ASC" 
                }, take: MAX_CHAIN_LINES 
            })
        let expectedPrev = GENESIS
        for (let index = 0; index < rows.length; index++) {
            const row = rows[index]
            if (row.prevHash !== expectedPrev) {
                return {
                    valid: false, totalLines: rows.length, break: {
                        index, reason: "broken-prev-hash" 
                    } 
                }
            }
            const expectedHash = hashContent(row.prevHash,
                row.at,
                row.action,
                row.target,
                row.keyId,
                row.actor)
            if (expectedHash !== row.hash) {
                return {
                    valid: false, totalLines: rows.length, break: {
                        index, reason: "content-mismatch" 
                    } 
                }
            }
            expectedPrev = row.hash
        }
        return {
            valid: true, totalLines: rows.length, break: null 
        }
    }

    /** nfr.audit.retention's named hook: a fake-clock test advances `clock`, calls this, and asserts the
   * count and chain validity are unchanged. It deliberately performs no eviction - see the class comment. */
    async sweepRetention(): Promise<{ lineCount: number; valid: boolean }> {
        const result = await this.verifyChain()
        return {
            lineCount: result.totalLines, valid: result.valid 
        }
    }

    /** fr.audit.log.read's per-line resolution: a tombstoned line (destroyed key) reads back as
   * tombstoned rather than throwing. */
    async readLine(row: AuditLogLineEntity): Promise<ResolvedAuditLine> {
        const key = await this.keystore.getKeyMaterial(row.keyId)
        if (!key) {
            return {
                at: row.at, action: row.action, target: row.target, actor: null, tombstoned: true 
            }
        }
        const opened = this.keystore.unseal(key,
            row.actor)
        if (!opened.opened) {
            return {
                at: row.at, action: row.action, target: row.target, actor: null, tombstoned: true 
            }
        }
        return {
            at: row.at, action: row.action, target: row.target, actor: opened.plaintext, tombstoned: false 
        }
    }

    /**
   * Every line the log holds, oldest first, each resolved through readLine - the whole-chain read
   * fr.audit.log.read's operator path (audit-operator-read.ts's filter/summary pair) runs over. Like
   * findLinesForPerson it returns only resolved shapes: the response keeps the record's postcondition
   * (no sealed actor blob, no keyId) by construction, tombstoned or not.
   */
    async readAllLines(): Promise<Array<ResolvedAuditLine>> {
        const rows = await this.entityManager.find(AuditLogLineEntity,
            {
                order: {
                    id: "ASC" 
                }, take: MAX_CHAIN_LINES 
            })
        return Promise.all(rows.map(row => this.readLine(row)))
    }

    /**
   * The lines a given person produced, oldest first. Filters by `keyId` (opaque, never the person's own
   * id) rather than decrypting every row in the table - efficient, and it is exactly the boundary
   * fr.audit.log.read's postcondition draws: the response this feeds never carries that `keyId` back out,
   * only the decrypted `actor` (which here always equals `personId`, since the filter already selected
   * their own key) or a tombstoned line if erasure raced this same read.
   */
    async findLinesForPerson(personId: string): Promise<Array<ResolvedAuditLine>> {
        const keyId = await this.keystore.getKeyIdForPerson(personId)
        if (!keyId) return []
        const rows = await this.entityManager.find(AuditLogLineEntity,
            {
                where: {
                    keyId 
                }, order: {
                    id: "ASC" 
                }, take: MAX_LINES_PER_PERSON 
            })
        return Promise.all(rows.map(row => this.readLine(row)))
    }

    /** fr.audit.export: identical resolution to findLinesForPerson - once a completed erasure destroys the
   * subject's key, this and the own-lines read agree by construction, both finding no keyId to filter on. */
    exportForPerson(personId: string): Promise<Array<ResolvedAuditLine>> {
        return this.findLinesForPerson(personId)
    }
}
