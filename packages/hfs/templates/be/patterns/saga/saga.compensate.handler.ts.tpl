import { CommandHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SagaTransition } from "@modules/platform/saga"
import { @@Saga@@SagaService } from "../@@saga@@.saga.service"
import { Compensate@@Saga@@Command } from "./compensate-@@saga@@.command"

@CommandHandler(Compensate@@Saga@@Command)
/** Compensates the @@saga@@ saga of a failed run; the saga decides the fence and the no-op of a redelivery. */
export class Compensate@@Saga@@Handler extends ICQRSHandler<Compensate@@Saga@@Command, SagaTransition> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly saga: @@Saga@@SagaService,
    ) {
        super(logger)
    }

    protected override process(command: Compensate@@Saga@@Command): Promise<SagaTransition> {
        return this.saga.compensate(command.params.request.id, command.params.request.eventId)
    }
}
