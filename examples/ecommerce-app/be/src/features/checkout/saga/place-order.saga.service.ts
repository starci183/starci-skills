import { Injectable } from "@nestjs/common"
import { PLACE_ORDER_SAGA } from "@modules/domain/order"
import type { ExecuteParams } from "@modules/platform/cqrs"
import { InjectSagaService } from "@modules/platform/saga"
import type { SagaService, SagaTransition } from "@modules/platform/saga"
import type { PlaceOrderRequest, PlaceOrderResult } from "../application/place-order.contracts"
import type { FindPlaceOrderSagaResult } from "./place-order.saga-state"
import { ReserveOrderCompensation } from "./compensations/reserve-order.compensation"
import { ReserveOrderStep } from "./steps/reserve-order.saga-step"

@Injectable()
/**
 * The orchestrator of the place-order saga: the list of its steps and, for each, the compensation that undoes it. It decides
 * nothing: the state machine and the version fence are `platform/saga`'s, the work of each step and compensation is a command.
 * The run starts with the first step (the order service records it in the step's own transaction) and ends when billing
 * answers: an issued invoice completes it, a rejected one compensates every step in reverse order.
 */
export class PlaceOrderSagaService {
    constructor(
        @InjectSagaService() private readonly sagas: SagaService,
        private readonly reserveOrder: ReserveOrderStep,
        private readonly reserveOrderCompensation: ReserveOrderCompensation,
    ) {}

    /** Runs the steps of the saga for the caller. */
    place(params: ExecuteParams<PlaceOrderRequest>): Promise<PlaceOrderResult> {
        return this.reserveOrder.run(params)
    }

    /** Compensates the run of an order after the event that reports its failure; the store takes the delivery through the inbox. */
    compensate(orderId: string, eventId: string): Promise<SagaTransition> {
        return this.sagas.compensate({
            saga: PLACE_ORDER_SAGA,
            correlationId: orderId,
            eventId,
            compensate: () => this.reserveOrderCompensation.run(orderId),
        })
    }

    /** Where the run of an order stands, or null when the order never started one. */
    async stateOf(orderId: string): Promise<FindPlaceOrderSagaResult> {
        const state = await this.sagas.state({ saga: PLACE_ORDER_SAGA, correlationId: orderId })
        return state === null ? null : { correlationId: orderId, ...state }
    }

    /** Completes the run of an order after the event that reports its last step done; the store takes the delivery through the inbox. */
    complete(orderId: string, eventId: string): Promise<SagaTransition> {
        return this.sagas.complete({ saga: PLACE_ORDER_SAGA, correlationId: orderId, eventId })
    }
}
