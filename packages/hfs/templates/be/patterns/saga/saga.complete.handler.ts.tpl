import { CommandHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SagaTransition } from "@modules/platform/saga"
import { @@Saga@@SagaService } from "../@@saga@@.saga.service"
import { Complete@@Saga@@Command } from "./complete-@@saga@@.command"

@CommandHandler(Complete@@Saga@@Command)
/** Completes the @@saga@@ saga of a run whose last step answered; the saga decides the fence and the no-op of a redelivery. */
export class Complete@@Saga@@Handler extends ICQRSHandler<Complete@@Saga@@Command, SagaTransition> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly saga: @@Saga@@SagaService,
    ) {
        super(logger)
    }

    protected override process(command: Complete@@Saga@@Command): Promise<SagaTransition> {
        return this.saga.complete(command.params.request.id, command.params.request.eventId)
    }
}
