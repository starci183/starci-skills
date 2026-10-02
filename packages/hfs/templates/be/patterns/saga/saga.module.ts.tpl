import { Module } from "@nestjs/common"
import { Compensate@@Saga@@Handler } from "./application/compensate-@@saga@@.handler"
import { Complete@@Saga@@Handler } from "./application/complete-@@saga@@.handler"
import { Undo@@Saga@@Handler } from "./application/undo-@@saga@@.handler"
import { @@Step@@Compensation } from "./compensations/@@step@@.compensation"
import { @@Saga@@SagaService } from "./@@saga@@.saga.service"
import { @@Step@@Step } from "./steps/@@step@@.saga-step"

@Module({
    providers: [
        Compensate@@Saga@@Handler,
        Complete@@Saga@@Handler,
        Undo@@Saga@@Handler,
        @@Saga@@SagaService,
        @@Step@@Step,
        @@Step@@Compensation,
    ],
})
/** The @@saga@@ saga: its orchestrator, its step and compensation, and the handlers of the commands the consumers dispatch. */
export class @@Saga@@Module {}
