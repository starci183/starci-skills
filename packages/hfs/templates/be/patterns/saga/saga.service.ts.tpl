import { Injectable } from "@nestjs/common"
import { @@sagaUpper@@_SAGA } from "@@serviceModule@@"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectSagaService } from "@modules/platform/saga"
import type { SagaService, SagaTransition } from "@modules/platform/saga"
import type { Find@@Saga@@SagaResult } from "./@@saga@@.saga-state"
import { @@Saga@@SagaLogEvent } from "./@@saga@@.saga.log-events"
import { @@Step@@Compensation } from "./compensations/@@step@@.compensation"
import { @@Step@@Step } from "./steps/@@step@@.saga-step"

@Injectable()
/**
 * The orchestrator of the @@saga@@ saga: the list of its steps and, for each, the compensation that undoes it. It decides nothing:
 * the state machine and the version fence are `platform/saga`'s, the work of each compensation is a command. The run starts in the
 * transaction of the domain (`@@sagaUpper@@_SAGA`, written by @@service@@ together with the event the step puts on the wire) and ends when
 * the answer arrives: the done event completes it, the failed event compensates every step in reverse order.
 */
export class @@Saga@@SagaService {
    constructor(
        @InjectSagaService() private readonly sagas: SagaService,
        @InjectLogger() private readonly logger: Logger,
        private readonly @@stepCamel@@: @@Step@@Step,
        private readonly @@stepCamel@@Compensation: @@Step@@Compensation,
    ) {}

    /** Compensates the run of an id after the event that reports its failure; the store takes the delivery through the inbox. */
    compensate(id: string, eventId: string): Promise<SagaTransition> {
        return this.sagas.compensate({
            saga: @@sagaUpper@@_SAGA,
            correlationId: id,
            eventId,
            compensate: () => {
                this.logger.info(@@Saga@@SagaLogEvent.Compensating, {
                    step: this.@@stepCamel@@.name,
                    event: this.@@stepCamel@@.event,
                    id,
                })
                return this.@@stepCamel@@Compensation.run(id)
            },
        })
    }

    /** Where the run of an id stands, or null when it never started one. */
    async stateOf(id: string): Promise<Find@@Saga@@SagaResult> {
        const state = await this.sagas.state({ saga: @@sagaUpper@@_SAGA, correlationId: id })
        return state === null ? null : { correlationId: id, ...state }
    }

    /** Completes the run of an id after the event that reports its last step done; the store takes the delivery through the inbox. */
    complete(id: string, eventId: string): Promise<SagaTransition> {
        return this.sagas.complete({ saga: @@sagaUpper@@_SAGA, correlationId: id, eventId })
    }
}
