import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { @@sagaUpper@@_SAGA } from "@@serviceModule@@"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SAGA_SERVICE } from "@modules/platform/saga"
import type { SagaService } from "@modules/platform/saga"
import { @@Step@@Compensation } from "./compensations/@@step@@.compensation"
import { @@Saga@@SagaLogEvent } from "./@@saga@@.saga.log-events"
import { @@Saga@@SagaService } from "./@@saga@@.saga.service"
import { @@Step@@Step } from "./steps/@@step@@.saga-step"

const build = async () => {
    const sagas = mock<SagaService>()
    const logger = mock<Logger>()
    const compensation = mock<@@Step@@Compensation>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            @@Saga@@SagaService,
            { provide: SAGA_SERVICE, useValue: sagas },
            { provide: LOGGER, useValue: logger },
            @@Step@@Step,
            { provide: @@Step@@Compensation, useValue: compensation },
        ],
    }).compile()
    return { saga: moduleRef.get(@@Saga@@SagaService), sagas, logger, compensation }
}

describe("@@Saga@@SagaService", () => {
    describe("compensate", () => {
        it("hands the run and the compensation of its step to the saga state machine", async () => {
            const { saga, sagas, logger, compensation } = await build()
            sagas.compensate.mockImplementation(async (params) => {
                await params.compensate()
                return "applied"
            })

            expect(await saga.compensate("x-1", "e-1")).toBe("applied")

            expect(sagas.compensate).toHaveBeenCalledWith({
                saga: @@sagaUpper@@_SAGA,
                correlationId: "x-1",
                eventId: "e-1",
                compensate: expect.any(Function),
            })
            expect(logger.info).toHaveBeenCalledWith(@@Saga@@SagaLogEvent.Compensating, {
                step: "@@step@@",
                event: "@@owner@@.@@step@@",
                id: "x-1",
            })
            expect(compensation.run).toHaveBeenCalledWith("x-1")
        })
    })

    describe("complete", () => {
        it("hands the run to the saga state machine to settle as completed", async () => {
            const { saga, sagas } = await build()
            sagas.complete.mockResolvedValue("applied")

            expect(await saga.complete("x-1", "e-2")).toBe("applied")

            expect(sagas.complete).toHaveBeenCalledWith({ saga: @@sagaUpper@@_SAGA, correlationId: "x-1", eventId: "e-2" })
        })
    })

    describe("stateOf", () => {
        it("answers the persisted state of the run", async () => {
            const { saga, sagas } = await build()
            sagas.state.mockResolvedValue({ status: "running", version: 1 })

            expect(await saga.stateOf("x-1")).toEqual({ correlationId: "x-1", status: "running", version: 1 })

            expect(sagas.state).toHaveBeenCalledWith({ saga: @@sagaUpper@@_SAGA, correlationId: "x-1" })
        })

        it("answers null when the id never started a run", async () => {
            const { saga, sagas } = await build()
            sagas.state.mockResolvedValue(null)

            expect(await saga.stateOf("x-9")).toBeNull()
        })
    })
})
