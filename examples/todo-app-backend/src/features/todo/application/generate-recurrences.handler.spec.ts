import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { RecurLogEvent } from "@modules/domain/recur"
import type { DueOccurrence, GeneratorService, OccurrenceService } from "@modules/domain/recur"
import { TaskErrorCode } from "@modules/domain/task"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { CreateTaskCommand } from "./create-task.command"
import { GenerateRecurrencesCommand } from "./generate-recurrences.command"
import { GenerateRecurrencesHandler } from "./generate-recurrences.handler"

const AT = new Date("2026-09-18T12:00:00.000Z")
const due = (localDate: string, ownerId = "o1"): DueOccurrence => ({
    ruleId: "r1",
    ownerId,
    title: "Stand-up",
    windowKey: `r1:${localDate}`,
    localDate,
    dueAtUtc: new Date(`${localDate}T02:00:00.000Z`),
})

/** What `build` wires: the handler and the doubles the specs assert on. */
interface Built {
    handler: GenerateRecurrencesHandler
    generator: GeneratorService
    occurrences: OccurrenceService
    commandBus: CommandBus
    logger: Logger
    inner: ReturnType<typeof mockEntityManager>
}

const build = (
    owed: ReadonlyArray<DueOccurrence>,
    execute: jest.Mock,
): Built => {
    const inner = mockEntityManager()
    const generator = mock<GeneratorService>({ collectDue: jest.fn().mockResolvedValue(owed) })
    const occurrences = mock<OccurrenceService>({ materialise: jest.fn() })
    const commandBus = mock<CommandBus>({ execute })
    const logger = mock<Logger>()
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return {
        handler: new GenerateRecurrencesHandler(logger, entityManager, commandBus, generator, occurrences),
        generator,
        occurrences,
        commandBus,
        logger,
        inner,
    }
}

describe("GenerateRecurrencesHandler", () => {
    it("creates each task as the owner of the rule through CreateTaskCommand, then materialises the occurrence under the task id", async () => {
        const execute = jest
            .fn()
            .mockResolvedValueOnce({ kind: "ok", value: { taskId: "t1", title: "Stand-up" } })
            .mockResolvedValueOnce({ kind: "ok", value: { taskId: "t2", title: "Stand-up" } })
        const { handler, generator, occurrences, commandBus, logger, inner } = build([due("2026-09-17"), due("2026-09-18")], execute)
        const result = await handler.execute(new GenerateRecurrencesCommand({ request: { at: AT } }))
        expect(result).toEqual({ materialised: 2, deferred: 0 })
        expect(generator.collectDue).toHaveBeenCalledWith({ now: AT, limit: 500 })
        expect(commandBus.execute).toHaveBeenNthCalledWith(
            1,
            new CreateTaskCommand({ request: { title: "Stand-up" }, principal: { id: "o1", roles: ["member"] } }),
        )
        expect(occurrences.materialise).toHaveBeenNthCalledWith(1, {
            manager: inner,
            id: "t1",
            ruleId: "r1",
            windowKey: "r1:2026-09-17",
            localDate: "2026-09-17",
            dueAtUtc: new Date("2026-09-17T02:00:00.000Z"),
        })
        expect(occurrences.materialise).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: "t2", windowKey: "r1:2026-09-18" }))
        expect(logger.info).toHaveBeenCalledWith(RecurLogEvent.GenerationMaterialised, { materialised: 2, deferred: 0 })
    })

    it("defers an occurrence whose task the plan cap refused: no row is written, the others go on, and it is not a failure", async () => {
        const execute = jest
            .fn()
            .mockResolvedValueOnce({ kind: "refused", code: TaskErrorCode.PlanCapExceeded, params: { cap: 20, upgradePath: "/plan/usage" } })
            .mockResolvedValueOnce({ kind: "ok", value: { taskId: "t2", title: "Stand-up" } })
        const { handler, occurrences, logger } = build([due("2026-09-17", "capped"), due("2026-09-18", "o2")], execute)
        const result = await handler.execute(new GenerateRecurrencesCommand({ request: { at: AT } }))
        expect(result).toEqual({ materialised: 1, deferred: 1 })
        expect(occurrences.materialise).toHaveBeenCalledTimes(1)
        expect(occurrences.materialise).toHaveBeenCalledWith(expect.objectContaining({ id: "t2", windowKey: "r1:2026-09-18" }))
        expect(logger.info).toHaveBeenCalledWith(RecurLogEvent.GenerationMaterialised, { materialised: 1, deferred: 1 })
    })

    it("does nothing and logs nothing when no occurrence is due", async () => {
        const { handler, commandBus, occurrences, logger } = build([], jest.fn())
        await expect(handler.execute(new GenerateRecurrencesCommand({ request: { at: AT } }))).resolves.toEqual({
            materialised: 0,
            deferred: 0,
        })
        expect(commandBus.execute).not.toHaveBeenCalled()
        expect(occurrences.materialise).not.toHaveBeenCalled()
        expect(logger.info).not.toHaveBeenCalled()
    })

    it("logs nothing when every due occurrence was deferred", async () => {
        const execute = jest.fn().mockResolvedValue({ kind: "refused", code: TaskErrorCode.PlanCapExceeded })
        const { handler, logger } = build([due("2026-09-17")], execute)
        await expect(handler.execute(new GenerateRecurrencesCommand({ request: { at: AT } }))).resolves.toEqual({
            materialised: 0,
            deferred: 1,
        })
        expect(logger.info).not.toHaveBeenCalled()
    })
})
