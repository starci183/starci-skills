import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ProbesError, ProbesErrorCode } from "./errors/probes.error"
import { ProbeCheckerService } from "./probe-checker.service"
import { PROBES } from "./probes.decorators"
import { ProbesLogEvent } from "./probes.log-events"
import type { Probe } from "./probes.port"
import { PROBES_OPTIONS } from "./probes.decorators"

const probe = (name: string, check: () => Promise<void>): Probe => ({ name, check })
const answers = (name: string): Probe => probe(name, () => Promise.resolve())
const fails = (name: string, error: unknown): Probe => probe(name, () => Promise.reject(error))

const build = async (probes: ReadonlyArray<Probe>) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ProbeCheckerService,
            { provide: PROBES_OPTIONS, useValue: { service: "todo", probes: [] } },
            { provide: PROBES, useValue: [...probes] },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { checker: moduleRef.get(ProbeCheckerService), logger }
}

describe("ProbeCheckerService", () => {
    describe("run", () => {
        it("reports every dependency ok when all answer", async () => {
            const { checker, logger } = await build([answers("database"), answers("cache")])

            await expect(checker.run()).resolves.toEqual({
                service: "todo",
                checks: { database: "ok", cache: "ok" },
                healthy: true,
            })
            expect(logger.warn).not.toHaveBeenCalled()
        })

        it("is healthy when no probe is registered", async () => {
            const { checker } = await build([])

            await expect(checker.run()).resolves.toEqual({ service: "todo", checks: {}, healthy: true })
        })

        it("reports an unreachable dependency, logs it and never rethrows", async () => {
            const { checker, logger } = await build([answers("database"), fails("cache", new Error("down"))])

            await expect(checker.run()).resolves.toEqual({
                service: "todo",
                checks: { database: "ok", cache: "unreachable" },
                healthy: false,
            })
            expect(logger.warn).toHaveBeenCalledWith(ProbesLogEvent.ProbeFailed, {
                dependency: "cache",
                code: undefined,
                cause: "Error: down",
            })
        })

        it("logs the code of a capability error a probe failed with", async () => {
            const failure = new ProbesError({ code: ProbesErrorCode.DependencyUnavailable })
            const { checker, logger } = await build([fails("cache", failure)])

            await checker.run()

            expect(logger.warn).toHaveBeenCalledWith(
                ProbesLogEvent.ProbeFailed,
                expect.objectContaining({ dependency: "cache", code: ProbesErrorCode.DependencyUnavailable }),
            )
        })
    })

    describe("check", () => {
        it("succeeds with the report of a healthy service", async () => {
            const { checker } = await build([answers("database")])

            await expect(checker.check()).resolves.toSucceedWith({ service: "todo", checks: { database: "ok" }, healthy: true })
        })

        it("refuses with the state of each dependency when one is down", async () => {
            const { checker } = await build([answers("database"), fails("cache", new Error("down"))])

            await expect(checker.check()).resolves.toBeRefused({
                code: ProbesErrorCode.DependencyUnavailable,
                params: { database: "ok", cache: "unreachable" },
            })
        })
    })
})
