import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { ShareErrorCode } from "./errors/share.error"
import { isShareRole, isWellFormedEmail, liveStatusOf, normalizeEmail } from "./invitation.policy"
import { InvitationEntity } from "./persistence/entities/invitation.entity"
import { toInvitationView } from "./persistence/invitation.rows"
import { InvitationStatus } from "./share.contracts"
import type {
    AcceptParams,
    InvitationView,
    InviteParams,
    ListInvitationsParams,
    RevokeParams,
} from "./share.contracts"

@Injectable()
/**
 * The invitation lifecycle: one row per invited email per task. Expiry is enforced on read, never by a sweep: a pending
 * row past its window reads as expired, so it cannot be accepted and inviting the same address again re-opens it.
 * Who may invite on a task is decided by the handler that knows the task.
 */
export class InvitationService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * Creates a pending invitation, or re-opens an expired or revoked row of the same (task, email) pair so exactly one
     * row exists per pair; a pending or accepted row for the pair is refused.
     */
    async invite(
        params: InviteParams,
    ): Promise<
        Outcome<
            InvitationView,
            ShareErrorCode.InvalidEmail | ShareErrorCode.InvalidRole | ShareErrorCode.InvitationAlreadyExists
        >
    > {
        const email = normalizeEmail(params.email)
        if (!isWellFormedEmail(email)) return refused(ShareErrorCode.InvalidEmail, { email: params.email })
        if (!isShareRole(params.role)) return refused(ShareErrorCode.InvalidRole, { role: params.role })
        const existing = await params.manager.findOne(InvitationEntity, {
            where: { taskId: params.taskId, email },
            lock: { mode: "pessimistic_write" },
        })
        if (!existing) {
            const created = await params.manager.save(InvitationEntity, {
                id: randomUUID(),
                taskId: params.taskId,
                ownerId: params.ownerId,
                email,
                role: params.role,
                status: InvitationStatus.Pending,
                sentAt: params.at,
                acceptedAt: null,
                revokedAt: null,
                personId: null,
            })
            return ok(toInvitationView(created, params.at))
        }
        const live = liveStatusOf(existing, params.at)
        if (live === InvitationStatus.Pending || live === InvitationStatus.Accepted) {
            return refused(ShareErrorCode.InvitationAlreadyExists, { taskId: params.taskId, email })
        }
        const reopened = await params.manager.save(InvitationEntity, {
            ...existing,
            ownerId: params.ownerId,
            role: params.role,
            status: InvitationStatus.Pending,
            sentAt: params.at,
            acceptedAt: null,
            revokedAt: null,
            personId: null,
        })
        return ok(toInvitationView(reopened, params.at))
    }

    /**
     * Binds the accepting person to a pending invitation addressed to their own email. Accepting again by the same
     * person changes nothing; a closed, expired, revoked or foreign invitation is refused.
     */
    async accept(
        params: AcceptParams,
    ): Promise<
        Outcome<
            InvitationView,
            | ShareErrorCode.InvitationNotFound
            | ShareErrorCode.EmailMismatch
            | ShareErrorCode.InvitationExpired
            | ShareErrorCode.InvitationRevoked
            | ShareErrorCode.InvitationAlreadyClosed
        >
    > {
        const row = await params.manager.findOne(InvitationEntity, {
            where: { id: params.invitationId },
            lock: { mode: "pessimistic_write" },
        })
        if (!row) return refused(ShareErrorCode.InvitationNotFound, { invitationId: params.invitationId })
        if (normalizeEmail(params.email) !== row.email) {
            return refused(ShareErrorCode.EmailMismatch, { invitationId: row.id })
        }
        const live = liveStatusOf(row, params.at)
        if (live === InvitationStatus.Expired) return refused(ShareErrorCode.InvitationExpired, { invitationId: row.id })
        if (live === InvitationStatus.Revoked) return refused(ShareErrorCode.InvitationRevoked, { invitationId: row.id })
        if (live === InvitationStatus.Accepted) {
            if (row.personId === params.actorId) return ok(toInvitationView(row, params.at))
            return refused(ShareErrorCode.InvitationAlreadyClosed, { invitationId: row.id })
        }
        const saved = await params.manager.save(InvitationEntity, {
            ...row,
            status: InvitationStatus.Accepted,
            acceptedAt: params.at,
            personId: params.actorId,
        })
        return ok(toInvitationView(saved, params.at))
    }

    /** Revokes an invitation for its owner, pending or accepted; an expired or revoked one is refused as closed. */
    async revoke(
        params: RevokeParams,
    ): Promise<
        Outcome<
            InvitationView,
            ShareErrorCode.InvitationNotFound | ShareErrorCode.Forbidden | ShareErrorCode.InvitationAlreadyClosed
        >
    > {
        const row = await params.manager.findOne(InvitationEntity, {
            where: { id: params.invitationId },
            lock: { mode: "pessimistic_write" },
        })
        if (!row) return refused(ShareErrorCode.InvitationNotFound, { invitationId: params.invitationId })
        if (row.ownerId !== params.ownerId) return refused(ShareErrorCode.Forbidden, { invitationId: row.id })
        const live = liveStatusOf(row, params.at)
        if (live === InvitationStatus.Expired || live === InvitationStatus.Revoked) {
            return refused(ShareErrorCode.InvitationAlreadyClosed, { invitationId: row.id })
        }
        const saved = await params.manager.save(InvitationEntity, {
            ...row,
            status: InvitationStatus.Revoked,
            revokedAt: params.at,
        })
        return ok(toInvitationView(saved, params.at))
    }

    /**
     * The invitations of a task with their live statuses, at most LIST_ROWS_MAX: the owner of the task and a bound
     * collaborator see every row, anyone else sees nothing.
     */
    async listFor(params: ListInvitationsParams): Promise<Array<InvitationView>> {
        const rows = await this.entityManager.find(InvitationEntity, {
            where: { taskId: params.taskId },
            take: LIST_ROWS_MAX,
        })
        const involved = rows.some((row) => row.ownerId === params.actorId || row.personId === params.actorId)
        if (!involved) return []
        return rows.map((row) => toInvitationView(row, params.at))
    }
}
