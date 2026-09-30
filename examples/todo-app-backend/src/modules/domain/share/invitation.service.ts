import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { TaskService } from "@modules/domain/task"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { ShareErrorCode } from "./errors/share.error"
import { isShareRole, isWellFormedEmail, liveStatusOf, normalizeEmail } from "./invitation.policy"
import { InvitationEntity } from "./persistence/entities/invitation.entity"
import { toInvitationView } from "./persistence/invitation.rows"
import { InvitationStatus } from "./share.contracts"
import type {
    AcceptedInvitation,
    AcceptParams,
    AcceptResult,
    CollaboratorList,
    InviteParams,
    InviteResult,
    ListInvitationsParams,
    RevokeParams,
    RevokeResult,
} from "./share.contracts"

@Injectable()
/**
 * The invitation lifecycle: one row per invited email per task. Expiry is enforced on read, never by a sweep: a pending
 * row past its window reads as expired, so it cannot be accepted and inviting the same address again re-opens it.
 * Every write runs in one transaction stamped with one instant of the clock.
 */
export class InvitationService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly tasks: TaskService,
    ) {}

    /**
     * Invites a collaborator onto a task the caller owns (an unknown task and somebody else's task are refused the same
     * way): creates a pending invitation, or re-opens an expired or revoked row of the same (task, email) pair so
     * exactly one row exists per pair; a pending or accepted row for the pair is refused.
     */
    async invite(params: InviteParams): Promise<InviteResult> {
        const task = await this.tasks.find({ id: params.taskId })
        if (!task || task.owner !== params.ownerId) return refused(ShareErrorCode.Forbidden, { taskId: params.taskId })
        const email = normalizeEmail(params.email)
        if (!isWellFormedEmail(email)) return refused(ShareErrorCode.InvalidEmail, { email: params.email })
        if (!isShareRole(params.role)) return refused(ShareErrorCode.InvalidRole, { role: params.role })
        const at = this.clock.now()
        return this.entityManager.transaction(async (manager) => {
            const existing = await manager.findOne(InvitationEntity, {
                where: { taskId: task.id, email },
                lock: { mode: "pessimistic_write" },
            })
            if (existing && this.isOpen(existing, at)) {
                return refused(ShareErrorCode.InvitationAlreadyExists, { taskId: task.id, email })
            }
            const saved = await manager.save(InvitationEntity, {
                ...existing,
                id: existing?.id ?? randomUUID(),
                taskId: task.id,
                ownerId: params.ownerId,
                email,
                role: params.role,
                status: InvitationStatus.Pending,
                sentAt: at,
                acceptedAt: null,
                revokedAt: null,
                personId: null,
            })
            const invitation = toInvitationView(saved, at)
            return ok({
                invitationId: invitation.id,
                taskId: invitation.taskId,
                email: invitation.email,
                role: invitation.role,
                status: invitation.status,
            })
        })
    }

    /**
     * Binds the accepting person to a pending invitation addressed to their own email. Accepting again by the same
     * person changes nothing; a closed, expired, revoked or foreign invitation is refused.
     */
    accept(params: AcceptParams): Promise<AcceptResult> {
        const at = this.clock.now()
        return this.entityManager.transaction(async (manager) => {
            const row = await manager.findOne(InvitationEntity, {
                where: { id: params.invitationId },
                lock: { mode: "pessimistic_write" },
            })
            if (!row) return refused(ShareErrorCode.InvitationNotFound, { invitationId: params.invitationId })
            if (normalizeEmail(params.email) !== row.email) {
                return refused(ShareErrorCode.EmailMismatch, { invitationId: row.id })
            }
            const live = liveStatusOf(row, at)
            if (live === InvitationStatus.Expired) return refused(ShareErrorCode.InvitationExpired, { invitationId: row.id })
            if (live === InvitationStatus.Revoked) return refused(ShareErrorCode.InvitationRevoked, { invitationId: row.id })
            if (live === InvitationStatus.Accepted) {
                if (row.personId === params.actorId) return ok(this.accepted(row, at))
                return refused(ShareErrorCode.InvitationAlreadyClosed, { invitationId: row.id })
            }
            const saved = await manager.save(InvitationEntity, {
                ...row,
                status: InvitationStatus.Accepted,
                acceptedAt: at,
                personId: params.actorId,
            })
            return ok(this.accepted(saved, at))
        })
    }

    /** Revokes an invitation for its owner, pending or accepted; an expired or revoked one is refused as closed. */
    revoke(params: RevokeParams): Promise<RevokeResult> {
        const at = this.clock.now()
        return this.entityManager.transaction(async (manager) => {
            const row = await manager.findOne(InvitationEntity, {
                where: { id: params.invitationId },
                lock: { mode: "pessimistic_write" },
            })
            if (!row) return refused(ShareErrorCode.InvitationNotFound, { invitationId: params.invitationId })
            if (row.ownerId !== params.ownerId) return refused(ShareErrorCode.Forbidden, { invitationId: row.id })
            const live = liveStatusOf(row, at)
            if (live === InvitationStatus.Expired || live === InvitationStatus.Revoked) {
                return refused(ShareErrorCode.InvitationAlreadyClosed, { invitationId: row.id })
            }
            const saved = await manager.save(InvitationEntity, {
                ...row,
                status: InvitationStatus.Revoked,
                revokedAt: at,
            })
            return ok({ invitationId: saved.id, status: toInvitationView(saved, at).status })
        })
    }

    /**
     * The invitations of a task with their live statuses, at most LIST_ROWS_MAX: the owner of the task and a bound
     * collaborator see every row, anyone else sees nothing.
     */
    async listFor(params: ListInvitationsParams): Promise<CollaboratorList> {
        const at = this.clock.now()
        const rows = await this.entityManager.find(InvitationEntity, {
            where: { taskId: params.taskId },
            take: LIST_ROWS_MAX,
        })
        const involved = rows.some((row) => row.ownerId === params.actorId || row.personId === params.actorId)
        if (!involved) return { collaborators: [] }
        return {
            collaborators: rows.map((row) => {
                const view = toInvitationView(row, at)
                return { invitationId: view.id, email: view.email, role: view.role, status: view.status }
            }),
        }
    }

    private isOpen(row: InvitationEntity, at: Date): boolean {
        const live = liveStatusOf(row, at)
        return live === InvitationStatus.Pending || live === InvitationStatus.Accepted
    }

    private accepted(row: InvitationEntity, at: Date): AcceptedInvitation {
        const view = toInvitationView(row, at)
        return { invitationId: view.id, role: view.role, status: view.status }
    }
}
