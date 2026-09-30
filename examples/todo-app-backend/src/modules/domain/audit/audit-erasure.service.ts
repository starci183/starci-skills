import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { AuditKeystoreService } from "./audit-keystore.service"
import { ErasureState } from "./audit.contracts"
import type { ErasureRequestView, ErasureStepParams, RequestErasureParams } from "./audit.contracts"
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
 * lines about the erasure are written by the handler through the audit queue, never here.
 */
export class AuditErasureService {
    constructor(private readonly keystore: AuditKeystoreService) {}

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

    private find(manager: EntityManager, requestId: string): Promise<AuditErasureRequestEntity | null> {
        return manager.findOne(AuditErasureRequestEntity, { where: { requestId }, lock: { mode: "pessimistic_write" } })
    }
}
