import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DATABASE_PROBE } from "@modules/platform/database"
import type { DatabaseProbeService } from "@modules/platform/database"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { HTTP_SECURITY_ERROR_KINDS, HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { ReadinessService } from "./readiness.service"

const build = async () => {
    const database = mock<DatabaseProbeService>()
    const timer = mock<Timer>()
    const cancel = jest.fn()
    timer.schedule.mockReturnValue(cancel)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ReadinessService,
            { provide: DATABASE_PROBE, useValue: database },
            { provide: TIMER, useValue: timer },
        ],
    }).compile()
    return { service: moduleRef.get(ReadinessService), database, timer, cancel }
}

describe("ReadinessService", () => {
    it("probes the required database before reporting ready", async () => {
        const { service, database, timer } = await build()
        database.probe.mockResolvedValue(undefined)

        await expect(service.probeRequired()).resolves.toEqual({ ok: true })

        expect(database.probe).toHaveBeenCalledTimes(1)
        expect(timer.schedule).toHaveBeenCalledWith(expect.any(Function), 1000)
    })

    it("preserves the database failure under the unavailable error kind that answers 503", async () => {
        const { service, database, cancel } = await build()
        const cause = new Error("connection unavailable")
        database.probe.mockRejectedValue(cause)
        const probe = service.probeRequired()

        await expect(probe).rejects.toBeInstanceOf(HttpSecurityError)
        await expect(probe).rejects.toMatchObject({ code: HttpSecurityErrorCode.RequiredDependencyUnavailable, cause })
        expect(HTTP_SECURITY_ERROR_KINDS[HttpSecurityErrorCode.RequiredDependencyUnavailable]).toBe("unavailable")
        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it("fails within the bounded timeout when the required database never answers", async () => {
        const { service, database, timer, cancel } = await build()
        database.probe.mockReturnValue(new Promise(() => undefined))
        const probe = service.probeRequired()
        const expected = expect(probe).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RequiredDependencyUnavailable,
            cause: new Error("Required database readiness timed out"),
        })

        expect(timer.schedule).toHaveBeenCalledWith(expect.any(Function), 1000)
        timer.schedule.mock.calls.at(0)?.[0]()
        await expected
        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it("cancels the deadline when the database answers early", async () => {
        const { service, database, cancel } = await build()
        database.probe.mockResolvedValue(undefined)

        await expect(service.probeRequired()).resolves.toEqual({ ok: true })

        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it("preserves a synchronous database failure before a deadline can be scheduled", async () => {
        const { service, database, timer, cancel } = await build()
        const cause = new HttpSecurityError({ code: HttpSecurityErrorCode.RequiredDependencyUnavailable })
        database.probe.mockImplementation(() => {
            throw cause
        })

        await expect(service.probeRequired()).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RequiredDependencyUnavailable,
            cause,
        })
        expect(timer.schedule).not.toHaveBeenCalled()
        expect(cancel).not.toHaveBeenCalled()
    })
})
