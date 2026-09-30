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
import { AcceptInvitationCommand } from "./accept-invitation.command"
import type { AcceptInvitationResult } from "./accept-invitation.contracts"

@CommandHandler(AcceptInvitationCommand)
/** Binds the caller to a pending invitation addressed to their email; the role is active from the same commit. */
export class AcceptInvitationHandler extends ICQRSHandler<AcceptInvitationCommand, AcceptInvitationResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly invitations: InvitationService,
    ) {
        super(logger)
    }

    protected override async process(command: AcceptInvitationCommand): Promise<AcceptInvitationResult> {
        const { request, principal } = command.params
        const at = this.clock.now()
        const outcome = await this.entityManager.transaction((manager) =>
            this.invitations.accept({
                manager,
                actorId: principal.id,
                invitationId: request.invitationId,
                email: request.email,
                at,
            }),
        )
        if (outcome.kind === "refused") return outcome
        return ok({ invitationId: outcome.value.id, role: outcome.value.role, status: outcome.value.status })
    }
}
