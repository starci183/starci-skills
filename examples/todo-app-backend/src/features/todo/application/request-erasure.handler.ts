import { randomUUID } from "node:crypto"
import { CommandHandler } from "@nestjs/cqrs"
import { AuditAction, AuditErasureService, SYSTEM_ACTOR_ID, toAuditAppendMessage } from "@modules/domain/audit"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectOutbox } from "@modules/platform/outbox"
import type { Outbox } from "@modules/platform/outbox"
import { ok } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { RequestErasureCommand } from "./request-erasure.command"
import type { RequestErasureResult } from "./request-erasure.contracts"

@CommandHandler(RequestErasureCommand)
/**
 * Opens the caller's erasure request and verifies it in the same step, since the caller is the subject. The
 * erasure-requested line names the request and the system actor, never the person, and joins the transaction.
 */
export class RequestErasureHandler extends ICQRSHandler<RequestErasureCommand, RequestErasureResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectOutbox() private readonly outbox: Outbox,
        private readonly erasure: AuditErasureService,
    ) {
        super(logger)
    }

    protected override async process(command: RequestErasureCommand): Promise<RequestErasureResult> {
        const { principal } = command.params
        const at = this.clock.now()
        return this.entityManager.transaction(async (manager): Promise<RequestErasureResult> => {
            const outcome = await this.erasure.request({ manager, personId: principal.id, at })
            if (outcome.kind === "refused") return outcome
            await this.outbox.enqueue(
                manager,
                toAuditAppendMessage({
                    eventId: randomUUID(),
                    actorId: SYSTEM_ACTOR_ID,
                    action: AuditAction.ErasureRequested,
                    target: outcome.value.requestId,
                    at,
                }),
            )
            return ok({ requestId: outcome.value.requestId, state: outcome.value.state })
        })
    }
}
