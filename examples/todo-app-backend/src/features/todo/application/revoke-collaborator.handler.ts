import { CommandHandler } from "@nestjs/cqrs"
import { InvitationService } from "@modules/domain/share"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { RevokeCollaboratorCommand } from "./revoke-collaborator.command"
import type { RevokeCollaboratorResult } from "./revoke-collaborator.contracts"

@CommandHandler(RevokeCollaboratorCommand)
/** Revokes an invitation for its owner; access ends with the commit, because the access rule reads the row every time. */
export class RevokeCollaboratorHandler extends ICQRSHandler<RevokeCollaboratorCommand, RevokeCollaboratorResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly invitations: InvitationService,
    ) {
        super(logger)
    }

    protected override async process(command: RevokeCollaboratorCommand): Promise<RevokeCollaboratorResult> {
        const { request, principal } = command.params
        const at = this.clock.now()
        const outcome = await this.entityManager.transaction((manager) =>
            this.invitations.revoke({ manager, ownerId: principal.id, invitationId: request.invitationId, at }),
        )
        if (outcome.kind === "refused") return outcome
        return ok({ invitationId: outcome.value.id, status: outcome.value.status })
    }
}
