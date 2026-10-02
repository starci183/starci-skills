import { Injectable } from "@nestjs/common"
import { PLACE_ORDER_SAGA } from "@modules/domain/order"
import { InjectSagaService } from "@modules/platform/saga"
import type { SagaService, SagaTransition } from "@modules/platform/saga"
import type { FindPlaceOrderSagaResult } from "./place-order.saga-state"
import { ReserveOrderCompensation } from "./compensations/reserve-order.compensation"
import { ReserveOrderStep } from "./steps/reserve-order.saga-step"

@Injectable()
/**
 * The orchestrator of the place-order saga: the list of its steps and, for each, the compensation that undoes it. It decides
 * nothing: the state machine, the version fence and the `Compensating` log are `platform/saga`'s, the work of each
 * compensation is a command. The run starts in the transaction that places the order (the domain writes the state and
 * announces `order.placed` there) and ends when billing answers: an issued invoice completes it, a rejected one compensates
 * every step in reverse order.
 */
export class PlaceOrderSagaService {
    constructor(
        @InjectSagaService() private readonly sagas: SagaService,
        private readonly reserveOrder: ReserveOrderStep,
        private readonly reserveOrderCompensation: ReserveOrderCompensation,
    ) {}

    /** Compensates the run of an order after the event that reports its failure; the store takes the delivery through the inbox. */
    compensate(orderId: string, eventId: string): Promise<SagaTransition> {
        return this.sagas.compensate({
            saga: PLACE_ORDER_SAGA,
            correlationId: orderId,
            eventId,
            step: this.reserveOrder,
            compensation: this.reserveOrderCompensation,
        })
    }

    /** Where the run of an order stands, or null when the order never started one. */
    stateOf(orderId: string): Promise<FindPlaceOrderSagaResult> {
        return this.sagas.state({ saga: PLACE_ORDER_SAGA, correlationId: orderId })
    }

    /** Completes the run of an order after the event that reports its last step done; the store takes the delivery through the inbox. */
    complete(orderId: string, eventId: string): Promise<SagaTransition> {
        return this.sagas.complete({ saga: PLACE_ORDER_SAGA, correlationId: orderId, eventId })
    }
}
