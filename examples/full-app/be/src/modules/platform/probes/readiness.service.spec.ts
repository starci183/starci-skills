import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { PROBES_ERROR_KINDS, ProbesError, ProbesErrorCode } from "./errors/probes.error"
import { ok, refused } from "@modules/platform/primitives"
import { PROBES, PROBE_CHECKER } from "./probes.decorators"
import type { ProbeCheckerService } from "./probe-checker.service"
import type { Probe } from "./probes.port"
import { ReadinessService } from "./readiness.service"

/** Asymmetric matchers read as `unknown`: jest types them `any`, which may not flow into a property or a typed argument. */
const anyOf = (type: unknown): unknown => expect.any(type)
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

const build = async (empty = false) => {
    const database = mock<Probe>({ name: "database" })
    const cache = mock<Probe>({ name: "cache" })
    cache.check.mockResolvedValue(undefined)
    const checker = mock<ProbeCheckerService>()
    const report = ok({ service: "order", checks: { database: "ok" as const, cache: "ok" as const }, healthy: true })
    checker.check.mockResolvedValue(report)
    const probes = [database, cache]
    if (empty) probes.splice(0)
    const timer = mock<Timer>()
    const cancel = jest.fn()
    timer.schedule.mockReturnValue(cancel)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ReadinessService,
            { provide: PROBES, useValue: probes },
            { provide: PROBE_CHECKER, useValue: checker },
            { provide: TIMER, useValue: timer },
        ],
    }).compile()
    return { service: moduleRef.get(ReadinessService), database, cache, timer, cancel, checker, report }
}

describe("ReadinessService", () => {
    it("fails closed when the app composes no required dependencies", async () => {
        const { service, timer } = await build(true)

        await expect(service.probeRequired()).rejects.toMatchObject({
            code: ProbesErrorCode.DependencyUnavailable,
            cause: objectLike({ code: ProbesErrorCode.DependencyUnavailable }),
        })

        expect(timer.schedule).not.toHaveBeenCalled()
    })

    it("requires the other app dependencies even when the database answers", async () => {
        const { service, database, cache, cancel } = await build()
        const cause = new Error("cache unavailable")
        database.check.mockResolvedValue(undefined)
        cache.check.mockRejectedValue(cause)

        await expect(service.probeRequired()).rejects.toMatchObject({
            code: ProbesErrorCode.DependencyUnavailable,
            cause,
        })

        expect(database.check).toHaveBeenCalledTimes(1)
        expect(cache.check).toHaveBeenCalledTimes(1)
        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it("probes the required database before reporting ready", async () => {
        const { service, database, timer, checker, report } = await build()
        database.check.mockResolvedValue(undefined)

        await expect(service.probeRequired()).resolves.toEqual(report)

        expect(database.check).toHaveBeenCalledTimes(1)
        expect(checker.check).toHaveBeenCalledTimes(1)
        expect(timer.schedule).toHaveBeenCalledWith(anyOf(Function), 1000)
    })
})

describe("ReadinessService failures and deadlines", () => {
    it("preserves the database failure under the unavailable error kind that answers 503", async () => {
        const { service, database, cancel } = await build()
        const cause = new Error("connection unavailable")
        database.check.mockRejectedValue(cause)
        const probe = service.probeRequired()

        await expect(probe).rejects.toBeInstanceOf(ProbesError)
        await expect(probe).rejects.toMatchObject({ code: ProbesErrorCode.DependencyUnavailable, cause })
        expect(PROBES_ERROR_KINDS[ProbesErrorCode.DependencyUnavailable]).toBe("unavailable")
        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it("fails within the bounded timeout when the required database never answers", async () => {
        const { service, database, timer, cancel } = await build()
        database.check.mockReturnValue(new Promise(() => undefined))
        const probe = service.probeRequired()
        const expected = expect(probe).rejects.toMatchObject({
            code: ProbesErrorCode.DependencyUnavailable,
            cause: new Error("Required dependency readiness timed out"),
        })

        expect(timer.schedule).toHaveBeenCalledWith(anyOf(Function), 1000)
        timer.schedule.mock.calls.at(0)?.[0]()
        await expected
        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it("cancels the deadline when the database answers early", async () => {
        const { service, database, cancel, report } = await build()
        database.check.mockResolvedValue(undefined)

        await expect(service.probeRequired()).resolves.toEqual(report)

        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it("preserves a synchronous database failure before a deadline can be scheduled", async () => {
        const { service, database, timer, cancel } = await build()
        const cause = new ProbesError({ code: ProbesErrorCode.DependencyUnavailable })
        database.check.mockImplementation(() => {
            throw cause
        })

        await expect(service.probeRequired()).rejects.toMatchObject({
            code: ProbesErrorCode.DependencyUnavailable,
            cause,
        })
        expect(timer.schedule).not.toHaveBeenCalled()
        expect(cancel).not.toHaveBeenCalled()
    })
})

describe("ReadinessService dependency reports", () => {
    it("preserves a refusal from the full dependency report", async () => {
        const { service, database, checker } = await build()
        database.check.mockResolvedValue(undefined)
        const failure = refused(ProbesErrorCode.DependencyUnavailable, { cache: "unreachable" })
        checker.check.mockResolvedValue(failure)

        await expect(service.probeRequired()).resolves.toEqual(failure)

        expect(checker.check).toHaveBeenCalledTimes(1)
    })

    it("does not request a report when the bounded dependency probe fails", async () => {
        const { service, database, checker } = await build()
        database.check.mockRejectedValue(new Error("database unavailable"))

        await expect(service.probeRequired()).rejects.toMatchObject({ code: ProbesErrorCode.DependencyUnavailable })

        expect(checker.check).not.toHaveBeenCalled()
    })
})
