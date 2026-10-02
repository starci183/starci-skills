import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PLACE_ORDER_SAGA } from "@modules/domain/order"
import { SAGA_SERVICE } from "@modules/platform/saga"
import type { SagaService } from "@modules/platform/saga"
import { ReserveOrderCompensation } from "./compensations/reserve-order.compensation"
import { PlaceOrderSagaService } from "./place-order.saga.service"
import { ReserveOrderStep } from "./steps/reserve-order.saga-step"

const build = async () => {
    const sagas = mock<SagaService>()
    const compensation = mock<ReserveOrderCompensation>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PlaceOrderSagaService,
            { provide: SAGA_SERVICE, useValue: sagas },
            ReserveOrderStep,
            { provide: ReserveOrderCompensation, useValue: compensation },
        ],
    }).compile()
    return { saga: moduleRef.get(PlaceOrderSagaService), sagas, compensation }
}

describe("PlaceOrderSagaService", () => {
    describe("compensate", () => {
        it("hands the run of the order and the compensation of its step to the saga state machine", async () => {
            const { saga, sagas, compensation } = await build()
            sagas.compensate.mockResolvedValue("applied")

            expect(await saga.compensate("o-1", "e-1")).toBe("applied")

            expect(sagas.compensate).toHaveBeenCalledWith({
                saga: PLACE_ORDER_SAGA,
                correlationId: "o-1",
                eventId: "e-1",
                step: expect.any(ReserveOrderStep),
                compensation,
            })
        })
    })

    describe("complete", () => {
        it("hands the run of the order to the saga state machine to settle as completed", async () => {
            const { saga, sagas } = await build()
            sagas.complete.mockResolvedValue("applied")

            expect(await saga.complete("o-1", "e-2")).toBe("applied")

            expect(sagas.complete).toHaveBeenCalledWith({
                saga: PLACE_ORDER_SAGA,
                correlationId: "o-1",
                eventId: "e-2",
            })
        })
    })

    describe("stateOf", () => {
        it("answers the persisted state of the run of the order", async () => {
            const { saga, sagas } = await build()
            sagas.state.mockResolvedValue({ correlationId: "o-1", status: "running", version: 1 })

            expect(await saga.stateOf("o-1")).toEqual({ correlationId: "o-1", status: "running", version: 1 })

            expect(sagas.state).toHaveBeenCalledWith({ saga: PLACE_ORDER_SAGA, correlationId: "o-1" })
        })

        it("answers null when the order never started a run", async () => {
            const { saga, sagas } = await build()
            sagas.state.mockResolvedValue(null)

            expect(await saga.stateOf("o-9")).toBeNull()
        })
    })
})
