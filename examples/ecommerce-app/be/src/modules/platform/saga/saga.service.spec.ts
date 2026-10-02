import { Test } from "@nestjs/testing"
import { FakeClock, fakeInbox, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BEGIN_SAGA, MOVE_SAGA, READ_SAGA } from "./persistence/saga.sql"
import type { SagaCompensation } from "./saga.contracts"
import { SagaLogEvent } from "./saga.log-events"
import { SagaService } from "./saga.service"

const AT = "2026-02-03T04:05:06.000Z"
const RUN = { saga: "place-order", correlationId: "o-1" }

/** The step the failure reports. */
const STEP = { name: "reserve-order", event: "order.placed" }

/** A compensation of the step: a spy on its run. */
const compensationOf = (run: (correlationId: string) => Promise<void> = () => Promise.resolve()): SagaCompensation => ({
    run: jest.fn(run),
})

const build = async (entityManager: MockEntityManager, claimed = true) => {
    const inbox = fakeInbox()
    if (!claimed) inbox.seen("saga:place-order", "e-1")
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SagaService,
            { provide: ORDER_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: INBOX, useValue: inbox },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(SagaService), inbox, logger }
}

/** The read of the run answered with `state`, or with no row when it does not exist. */
const readOf = (state: { status: string; version: number } | null): readonly [string, unknown] => [
    READ_SAGA,
    state === null ? [] : [state],
]

describe("SagaService", () => {
    describe("begin", () => {
        it("starts the run in the caller transaction, stamped by the clock", async () => {
            const manager = mockEntityManager({ query: [BEGIN_SAGA, []] })
            const { service } = await build(mockEntityManager())

            await service.begin({ manager, ...RUN })

            expect(manager.query).toHaveBeenCalledWith(BEGIN_SAGA, ["place-order", "o-1", new Date(AT)])
        })
    })

    describe("state", () => {
        it("answers where the run stands", async () => {
            const { service } = await build(mockEntityManager({ query: [readOf({ status: "running", version: 1 })] }))

            expect(await service.state(RUN)).toEqual({ correlationId: "o-1", status: "running", version: 1 })
        })

        it("answers null when the run does not exist", async () => {
            const { service } = await build(mockEntityManager({ query: [readOf(null)] }))

            expect(await service.state(RUN)).toBeNull()
        })
    })

    describe("compensate", () => {
        it("claims the event, moves the run to compensating, runs the compensation and settles it as compensated", async () => {
            const manager = mockEntityManager({
                query: [
                    readOf({ status: "running", version: 1 }),
                    [MOVE_SAGA, [{ version: 2 }]],
                    [MOVE_SAGA, [{ version: 3 }]],
                ],
            })
            const { service, inbox, logger } = await build(manager)
            const compensation = compensationOf()

            expect(await service.compensate({ ...RUN, eventId: "e-1", step: STEP, compensation })).toBe("applied")

            expect(inbox.claims).toEqual([{ source: "saga:place-order", eventId: "e-1" }])
            expect(manager.query).toHaveBeenNthCalledWith(2, MOVE_SAGA, [
                "place-order",
                "o-1",
                "running",
                1,
                "compensating",
                new Date(AT),
            ])
            expect(manager.query).toHaveBeenNthCalledWith(3, MOVE_SAGA, [
                "place-order",
                "o-1",
                "compensating",
                2,
                "compensated",
                new Date(AT),
            ])
            expect(logger.info).toHaveBeenCalledWith(SagaLogEvent.Compensating, {
                saga: "place-order",
                correlationId: "o-1",
                step: "reserve-order",
                event: "order.placed",
            })
            expect(compensation.run).toHaveBeenCalledWith("o-1")
        })

        it("does nothing for a redelivered event", async () => {
            const { service } = await build(mockEntityManager(), false)
            const compensation = compensationOf()

            expect(await service.compensate({ ...RUN, eventId: "e-1", step: STEP, compensation })).toBe("duplicate")

            expect(compensation.run).not.toHaveBeenCalled()
        })

        it("ignores an event of a run that does not exist or has settled", async () => {
            const compensation = compensationOf()
            const unknown = await build(mockEntityManager({ query: [readOf(null)] }))
            const completed = await build(mockEntityManager({ query: [readOf({ status: "completed", version: 2 })] }))
            const compensated = await build(
                mockEntityManager({ query: [readOf({ status: "compensated", version: 3 })] }),
            )

            expect(await unknown.service.compensate({ ...RUN, eventId: "e-1", step: STEP, compensation })).toBe(
                "ignored",
            )
            expect(await completed.service.compensate({ ...RUN, eventId: "e-2", step: STEP, compensation })).toBe(
                "ignored",
            )
            expect(await compensated.service.compensate({ ...RUN, eventId: "e-3", step: STEP, compensation })).toBe(
                "ignored",
            )

            expect(compensation.run).not.toHaveBeenCalled()
        })

        it("ignores the event when another transition moved the run first", async () => {
            const { service } = await build(
                mockEntityManager({ query: [readOf({ status: "running", version: 1 }), [MOVE_SAGA, []]] }),
            )
            const compensation = compensationOf()

            expect(await service.compensate({ ...RUN, eventId: "e-1", step: STEP, compensation })).toBe("ignored")

            expect(compensation.run).not.toHaveBeenCalled()
        })

        it("resumes a run that crashed while compensating without moving it to compensating again", async () => {
            const manager = mockEntityManager({
                query: [readOf({ status: "compensating", version: 2 }), [MOVE_SAGA, [{ version: 3 }]]],
            })
            const { service } = await build(manager)
            const compensation = compensationOf()

            expect(await service.compensate({ ...RUN, eventId: "e-1", step: STEP, compensation })).toBe("applied")

            expect(manager.query).toHaveBeenCalledTimes(2)
            expect(compensation.run).toHaveBeenCalledWith("o-1")
        })

        it("gives the event back and rethrows when the compensation fails, so the redelivery resumes the run", async () => {
            const failure = new Error("order database down")
            const { service, inbox } = await build(
                mockEntityManager({
                    query: [readOf({ status: "running", version: 1 }), [MOVE_SAGA, [{ version: 2 }]]],
                }),
            )
            const compensation = compensationOf(() => Promise.reject(failure))

            await expect(service.compensate({ ...RUN, eventId: "e-1", step: STEP, compensation })).rejects.toBe(failure)

            expect(inbox.released).toEqual([{ source: "saga:place-order", eventId: "e-1" }])
        })
    })

    describe("complete", () => {
        it("claims the event and settles a running run as completed", async () => {
            const manager = mockEntityManager({
                query: [readOf({ status: "running", version: 1 }), [MOVE_SAGA, [{ version: 2 }]]],
            })
            const { service, inbox } = await build(manager)

            expect(await service.complete({ ...RUN, eventId: "e-1" })).toBe("applied")

            expect(inbox.claims).toEqual([{ source: "saga:place-order", eventId: "e-1" }])
            expect(manager.query).toHaveBeenNthCalledWith(2, MOVE_SAGA, [
                "place-order",
                "o-1",
                "running",
                1,
                "completed",
                new Date(AT),
            ])
        })

        it("does nothing for a redelivered event", async () => {
            const { service } = await build(mockEntityManager(), false)

            expect(await service.complete({ ...RUN, eventId: "e-1" })).toBe("duplicate")
        })

        it("ignores an event of a run that does not exist or is not running any more", async () => {
            const unknown = await build(mockEntityManager({ query: [readOf(null)] }))
            const compensated = await build(
                mockEntityManager({ query: [readOf({ status: "compensated", version: 3 })] }),
            )

            expect(await unknown.service.complete({ ...RUN, eventId: "e-1" })).toBe("ignored")
            expect(await compensated.service.complete({ ...RUN, eventId: "e-2" })).toBe("ignored")
        })

        it("ignores the event when another transition moved the run first", async () => {
            const { service } = await build(
                mockEntityManager({ query: [readOf({ status: "running", version: 1 }), [MOVE_SAGA, []]] }),
            )

            expect(await service.complete({ ...RUN, eventId: "e-1" })).toBe("ignored")
        })
    })
})
