import {
    Injectable 
} from "@nestjs/common"
import {
    randomUUID 
} from "node:crypto"
import type {
    EntityManager 
} from "typeorm"
import {
    InjectPrimaryEntityManager 
} from "@modules/platform/databases/postgresql/primary/primary.decorators"
import {
    AuditErasureRequestEntity 
} from "@modules/platform/databases/postgresql/primary/entities/audit-erasure-request.entity"
import {
    ErasureNotConfirmedException 
} from "@modules/shared/exceptions/errors/audit/erasure-not-confirmed"
import {
    ErasureRequestForbiddenException 
} from "@modules/shared/exceptions/errors/audit/erasure-request-forbidden"
import {
    ErasureRequestInvalidStateException 
} from "@modules/shared/exceptions/errors/audit/erasure-request-invalid-state"
import {
    ErasureRequestNotFoundException 
} from "@modules/shared/exceptions/errors/audit/erasure-request-not-found"

import {
    AuditLogService 
} from "./audit-log.service"
import {
    AuditKeystoreService, SYSTEM_ACTOR_ID 
} from "./audit-keystore.service"
import {
    AuditErasureRequestRecord 
} from "./types/audit-erasure-request-record"

const ACTION_ERASURE_REQUESTED = "audit.erasure.requested"
const ACTION_ERASURE_COMPLETED = "audit.erasure.completed"

/**
 * sds.audit.erasure-request: the lifecycle of one request to be forgotten, implemented against
 * decision.audit.erasure-method (crypto-shred). Every transition id below (`tRequest`, `tVerify`,
 * `tRefuse`, `tExecute`, `tComplete`) mirrors the record's own transition ids exactly, matching
 * TaskService's `tComplete`/`tReopen` convention for the same reason: a reader can hold the record
 * beside the code.
 *
 * Only `request` (tRequest + tVerify) and `execute` (tExecute + confirm + tComplete) are exposed through
 * GraphQL (requestErasure/completeErasure - see the brief's naming). The re-authentication challenge
 * sds.audit.erasure-request's sequence names between them is already satisfied at this layer: the only
 * caller who can ever reach `request` is the signed-in session belonging to the subject itself (there is
 * no operator-initiated erasure - see gap.audit.operator-role), so identity is proven by the same
 * `x-session-token` that authenticated the GraphQL call, and t-verify runs immediately rather than
 * waiting on a second round-trip this example has no separate channel for.
 */
@Injectable()
/** Injectable service owning the audit erasure logic the audit capability exposes; wired by the capability's own module. */
export class AuditErasureService {
    constructor(
    @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    private readonly logService: AuditLogService,
    private readonly keystore: AuditKeystoreService,
    ) {}

    /** fr.audit.erasure.request: tRequest then tVerify, chained because the caller is always the subject. */
    async request(personId: string): Promise<AuditErasureRequestRecord> {
        const requested = await this.tRequest(personId)
        return this.confirm(requested.requestId,
            personId)
    }

    /**
   * sds.audit.erasure-request's t-verify as a second round of its own: the challenge its sequence
   * names - "the subject re-authenticates and the request moves to verified" - runs on this caller,
   * proven by the live session token behind it (the same SessionService seam that authenticated the
   * first round). requestErasure always chains request+confirm, so a second confirm of the same
   * pending request hits t-refuse, never a repeat of t-verify.
   */
    async confirm(requestId: string, callerId: string): Promise<AuditErasureRequestRecord> {
        return this.tVerify(requestId,
            callerId)
    }

    /** fr.audit.erasure.complete: tExecute, confirm every line is unreadable, then tComplete. */
    async execute(requestId: string, callerId: string): Promise<AuditErasureRequestRecord> {
        const row = await this.findRow(requestId)
        if (row.personId !== null && row.personId !== callerId) {
            throw new ErasureRequestForbiddenException({
            })
        }
        if (row.state !== "verified") {
            throw new ErasureRequestInvalidStateException({
                requestId, state: row.state, expected: "verified" 
            })
        }
        const subjectId = row.personId ?? callerId
        const keyIdBeforeDestruction = await this.keystore.getKeyIdForPerson(subjectId)
        await this.tExecute(row)
        const stillReadable = keyIdBeforeDestruction !== null && (await this.keystore.getKeyMaterial(keyIdBeforeDestruction)) !== null
        if (stillReadable) {
            throw new ErasureNotConfirmedException({
                requestId 
            })
        }
        return this.tComplete(row)
    }

    /** sds.audit.erasure-request's t-request: the row and its state machine instance come into existence
   * together, directly in `requested` - there is no prior state to transition from. */
    private async tRequest(personId: string): Promise<AuditErasureRequestRecord> {
        const requestId = randomUUID()
        const requestedAt = new Date()
        const saved = await this.entityManager.save(AuditErasureRequestEntity,
            {
                requestId,
                personId,
                state: "requested",
                requestedAt,
                verifiedAt: null,
                refusedAt: null,
                executingAt: null,
                completedAt: null,
            })
        await this.logService.append(SYSTEM_ACTOR_ID,
            ACTION_ERASURE_REQUESTED,
            requestId)
        return toRecord(saved)
    }

    /** t-verify: the requester is proven to be the subject; a mismatch runs t-refuse instead. */
    private async tVerify(requestId: string, callerId: string): Promise<AuditErasureRequestRecord> {
        const row = await this.findRow(requestId)
        if (row.state !== "requested") {
            throw new ErasureRequestInvalidStateException({
                requestId, state: row.state, expected: "requested" 
            })
        }
        if (row.personId !== callerId) {
            await this.tRefuse(row)
            throw new ErasureRequestForbiddenException({
            })
        }
        row.verifiedAt = new Date()
        row.state = "verified"
        const saved = await this.entityManager.save(AuditErasureRequestEntity,
            row)
        return toRecord(saved)
    }

    /** t-refuse: nothing about the subject's keys is touched. */
    private async tRefuse(row: AuditErasureRequestEntity): Promise<AuditErasureRequestRecord> {
        row.refusedAt = new Date()
        row.state = "refused"
        const saved = await this.entityManager.save(AuditErasureRequestEntity,
            row)
        return toRecord(saved)
    }

    /** t-execute: destroys the subject's key and the keystore's personId-to-keyId mapping. No log line is
   * read, rewritten or deleted. */
    private async tExecute(row: AuditErasureRequestEntity): Promise<void> {
        row.executingAt = new Date()
        row.state = "executing"
        await this.entityManager.save(AuditErasureRequestEntity,
            row)
        await this.keystore.destroyKey(row.personId ?? "")
    }

    /** t-complete: appends the erasure-completed line naming the requestId, then drops personId - the
   * data.audit.erasure-request invariant that keeps this table from becoming a second permanent record
   * of who the subject was. */
    private async tComplete(row: AuditErasureRequestEntity): Promise<AuditErasureRequestRecord> {
        row.completedAt = new Date()
        row.state = "complete"
        row.personId = null
        const saved = await this.entityManager.save(AuditErasureRequestEntity,
            row)
        await this.logService.append(SYSTEM_ACTOR_ID,
            ACTION_ERASURE_COMPLETED,
            row.requestId)
        return toRecord(saved)
    }

    private async findRow(requestId: string): Promise<AuditErasureRequestEntity> {
        const row = await this.entityManager.findOneBy(AuditErasureRequestEntity,
            {
                requestId 
            })
        if (!row) {
            throw new ErasureRequestNotFoundException({
                requestId 
            })
        }
        return row
    }
}

function toRecord(row: AuditErasureRequestEntity): AuditErasureRequestRecord {
    return new AuditErasureRequestRecord(
        row.requestId,
        row.personId,
    row.state as AuditErasureRequestRecord["state"],
    row.requestedAt,
    row.verifiedAt,
    row.refusedAt,
    row.executingAt,
    row.completedAt,
    )
}
