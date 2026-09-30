import { mock } from "@starci/jest-preset/mock"
import type { Logger } from "@modules/platform/logging"
import { ProbesErrorCode } from "@modules/platform/probes"
import type { ProbeChecker, ProbeReport } from "@modules/platform/probes"
import { CheckHealthHandler } from "./check-health.handler"
import { CheckHealthQuery } from "./check-health.query"

const handlerFor = (report: ProbeReport): CheckHealthHandler =>
    new CheckHealthHandler(mock<Logger>(), mock<ProbeChecker>({ run: jest.fn().mockResolvedValue(report) }))

const query = new CheckHealthQuery({ request: {} })

describe("CheckHealthHandler", () => {
    it("answers the report when every dependency answers", async () => {
        const report: ProbeReport = { service: "demo", checks: { database: "ok" }, healthy: true }
        await expect(handlerFor(report).execute(query)).resolves.toEqual({ kind: "ok", value: report })
    })

    it("refuses with the state of each dependency when one is unreachable", async () => {
        const report: ProbeReport = { service: "demo", checks: { database: "unreachable", cache: "ok" }, healthy: false }
        await expect(handlerFor(report).execute(query)).resolves.toEqual({
            kind: "refused",
            code: ProbesErrorCode.DependencyUnavailable,
            params: { database: "unreachable", cache: "ok" },
        })
    })
})
