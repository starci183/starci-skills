import { builder, mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { Test } from "@nestjs/testing"
import { ProbesErrorCode } from "./errors/probes.error"
import { ProbeCheckerService } from "./probe-checker.service"
import { PROBES, PROBES_OPTIONS } from "./probes.decorators"
import { ProbesLogEvent } from "./probes.log-events"
import type { ProbesOptions } from "./probes.options"
import type { Probe } from "./probes.port"

const options = builder<ProbesOptions>({ service: "order", probes: [] })

const probe = (name: string, answer: "up" | Error): Probe => {
    const double = mock<Probe>({ name })
    if (answer === "up") double.check.mockResolvedValue(undefined)
    else double.check.mockRejectedValue(answer)
    return double
}

describe("ProbeCheckerService", () => {
    const build = async (probes: ReadonlyArray<Probe>) => {
        const logger = mock<Logger>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                ProbeCheckerService,
                { provide: PROBES_OPTIONS, useValue: options() },
                { provide: PROBES, useValue: probes },
                { provide: LOGGER, useValue: logger },
            ],
        }).compile()
        return { checker: moduleRef.get(ProbeCheckerService), logger }
    }

    it("succeeds with the report when every dependency answers", async () => {
        const { checker, logger } = await build([probe("database", "up"), probe("cache", "up")])

        expect(await checker.check()).toSucceedWith({
            service: "order",
            checks: { database: "ok", cache: "ok" },
            healthy: true,
        })
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("refuses with the state of each dependency and logs the one that failed", async () => {
        const failure = new Error("redis down")
        const { checker, logger } = await build([probe("database", "up"), probe("cache", failure)])

        expect(await checker.check()).toBeRefused({
            code: ProbesErrorCode.DependencyUnavailable,
            params: { database: "ok", cache: "unreachable" },
        })
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(ProbesLogEvent.ProbeFailed, failure, { dependency: "cache" })
    })

    it("succeeds with an empty report when the app has no probe", async () => {
        const { checker } = await build([])

        expect(await checker.check()).toSucceedWith({ service: "order", checks: {}, healthy: true })
    })
})
