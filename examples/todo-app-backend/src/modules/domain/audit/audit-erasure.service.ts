import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectOutbox } from "@modules/platform/outbox"
import type { Outbox } from "@modules/platform/outbox"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { toAuditAppendMessage } from "./audit-append.policy"
import { AuditKeystoreService } from "./audit-keystore.service"
import { AuditAction, ErasureState, SYSTEM_ACTOR_ID } from "./audit.contracts"
import type {
    CompleteOwnErasureParams,
    ErasureReceiptView,
    ErasureRequestView,
    ErasureStepParams,
    RequestErasureParams,
    RequestOwnErasureParams,
} from "./audit.contracts"
import { AuditErrorCode } from "./errors/audit.error"
import { toErasureRequestView } from "./persistence/audit.rows"
import { AuditErasureRequestEntity } from "./persistence/entities/audit-erasure-request.entity"

/** The refusals of the verification step. */
type ConfirmRefusal =
    | AuditErrorCode.ErasureRequestNotFound
    | AuditErrorCode.ErasureRequestInvalidState
    | AuditErrorCode.ErasureRequestForbidden

/** The refusals of the execution step. */
type ExecuteRefusal = ConfirmRefusal | AuditErrorCode.ErasureNotConfirmed

@Injectable()
/**
 * The lifecycle of one request to be forgotten, by crypto-shredding: requested, verified (or refused), executing,
 * complete. The subject is always the caller, so `request` opens and verifies in one step. Execution destroys the
 * subject key, confirms nothing about the subject stays readable, and drops the person id from the request row. The log
 * lines about the erasure are queued through the outbox in the transaction of the step, naming the request and the
 * system actor, never the person.
 */
export class AuditErasureService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectOutbox() private readonly outbox: Outbox,
        private readonly keystore: AuditKeystoreService,
    ) {}

    /**
     * Opens and verifies the erasure request of the caller in one transaction, together with the erasure-requested
     * audit line. A refusal is returned, not thrown, so what the step wrote before refusing still commits.
     */
    async requestForCaller(params: RequestOwnErasureParams): Promise<Outcome<ErasureReceiptView, ConfirmRefusal>> {
        const at = this.clock.now()
        return this.entityManager.transaction(async (manager): Promise<Outcome<ErasureReceiptView, ConfirmRefusal>> => {
            const outcome = await this.request({ manager, personId: params.personId, at })
            if (outcome.kind === "refused") return outcome
            await this.queueLine(manager, AuditAction.ErasureRequested, outcome.value.requestId, at)
            return ok({ requestId: outcome.value.requestId, state: outcome.value.state })
        })
    }

    /**
     * Completes the verified erasure request of the caller in one transaction, together with the erasure-completed
     * audit line. A refusal is returned, not thrown.
     */
    async completeForCaller(params: CompleteOwnErasureParams): Promise<Outcome<ErasureReceiptView, ExecuteRefusal>> {
        const at = this.clock.now()
        return this.entityManager.transaction(async (manager): Promise<Outcome<ErasureReceiptView, ExecuteRefusal>> => {
            const outcome = await this.execute({
                manager,
                requestId: params.requestId,
                callerId: params.callerId,
                at,
            })
            if (outcome.kind === "refused") return outcome
            await this.queueLine(manager, AuditAction.ErasureCompleted, outcome.value.requestId, at)
            return ok({ requestId: outcome.value.requestId, state: outcome.value.state })
        })
    }

    /** Opens a request for the caller and verifies it at once, since the caller is the subject. */
    async request(params: RequestErasureParams): Promise<Outcome<ErasureRequestView, ConfirmRefusal>> {
        const saved = await params.manager.save(AuditErasureRequestEntity, {
            requestId: randomUUID(),
            personId: params.personId,
            state: ErasureState.Requested,
            requestedAt: params.at,
            verifiedAt: null,
            refusedAt: null,
            executingAt: null,
            completedAt: null,
        })
        return this.confirm({ manager: params.manager, requestId: saved.requestId, callerId: params.personId, at: params.at })
    }

    /**
     * Verifies that the caller is the subject of a still requested request. A stranger refuses the request (state
     * refused) and gets a forbidden refusal; the subject key is never touched.
     */
    async confirm(params: ErasureStepParams): Promise<Outcome<ErasureRequestView, ConfirmRefusal>> {
        const row = await this.find(params.manager, params.requestId)
        if (!row) return refused(AuditErrorCode.ErasureRequestNotFound, { requestId: params.requestId })
        if (row.state !== ErasureState.Requested) {
            return refused(AuditErrorCode.ErasureRequestInvalidState, {
                requestId: row.requestId,
                state: row.state,
                expected: ErasureState.Requested,
            })
        }
        if (row.personId !== params.callerId) {
            await params.manager.save(AuditErasureRequestEntity, {
                ...row,
                refusedAt: params.at,
                state: ErasureState.Refused,
            })
            return refused(AuditErrorCode.ErasureRequestForbidden, { requestId: row.requestId })
        }
        const saved = await params.manager.save(AuditErasureRequestEntity, {
            ...row,
            verifiedAt: params.at,
            state: ErasureState.Verified,
        })
        return ok(toErasureRequestView(saved))
    }

    /**
     * Destroys the subject key of a verified request, confirms that no line of the subject resolves any more, then
     * completes the request and drops the person id from it. Only the subject may complete their own request.
     */
    async execute(params: ErasureStepParams): Promise<Outcome<ErasureRequestView, ExecuteRefusal>> {
        const row = await this.find(params.manager, params.requestId)
        if (!row) return refused(AuditErrorCode.ErasureRequestNotFound, { requestId: params.requestId })
        if (row.personId !== null && row.personId !== params.callerId) {
            return refused(AuditErrorCode.ErasureRequestForbidden, { requestId: row.requestId })
        }
        if (row.state !== ErasureState.Verified) {
            return refused(AuditErrorCode.ErasureRequestInvalidState, {
                requestId: row.requestId,
                state: row.state,
                expected: ErasureState.Verified,
            })
        }
        const subjectId = row.personId ?? params.callerId
        const keyId = await this.keystore.getKeyIdForPerson({ personId: subjectId, manager: params.manager })
        await params.manager.save(AuditErasureRequestEntity, {
            ...row,
            executingAt: params.at,
            state: ErasureState.Executing,
        })
        await this.keystore.destroyKey({ manager: params.manager, personId: subjectId })
        if (keyId !== null) {
            const remaining = await this.keystore.getKeyMaterials({ keyIds: [keyId], manager: params.manager })
            if (remaining.size > 0) {
                return refused(AuditErrorCode.ErasureNotConfirmed, { requestId: row.requestId })
            }
        }
        const saved = await params.manager.save(AuditErasureRequestEntity, {
            ...row,
            executingAt: params.at,
            completedAt: params.at,
            state: ErasureState.Complete,
            personId: null,
        })
        return ok(toErasureRequestView(saved))
    }

    private queueLine(manager: EntityManager, action: AuditAction, requestId: string, at: Date): Promise<void> {
        return this.outbox.enqueue(
            manager,
            toAuditAppendMessage({ eventId: randomUUID(), actorId: SYSTEM_ACTOR_ID, action, target: requestId, at }),
        )
    }

    private find(manager: EntityManager, requestId: string): Promise<AuditErasureRequestEntity | null> {
        return manager.findOne(AuditErasureRequestEntity, { where: { requestId }, lock: { mode: "pessimistic_write" } })
    }
}
