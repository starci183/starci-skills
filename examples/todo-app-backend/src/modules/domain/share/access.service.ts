import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EntityManager } from "typeorm"
import { InvitationEntity } from "./persistence/entities/invitation.entity"
import { InvitationStatus, ShareRole } from "./share.contracts"
import type { MayCompleteParams } from "./share.contracts"

@Injectable()
/**
 * The access rule other capabilities ask before a shared task changes. It reads the accepted invitations from the
 * database on every call, so a revocation takes effect on the very next question and no process keeps a copy.
 */
export class AccessService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * True for the owner of the task, and for a person holding an accepted editor invitation that the owner of the task
     * sent; a viewer, a stranger and a collaborator of another task get false.
     */
    async mayComplete(params: MayCompleteParams): Promise<boolean> {
        if (params.actorId === params.ownerId) return true
        const invitation = await this.entityManager.findOneBy(InvitationEntity, {
            taskId: params.taskId,
            ownerId: params.ownerId,
            personId: params.actorId,
            status: InvitationStatus.Accepted,
            role: ShareRole.Editor,
        })
        return invitation !== null
    }
}
