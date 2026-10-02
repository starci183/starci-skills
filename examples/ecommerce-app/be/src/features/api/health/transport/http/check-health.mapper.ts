import type { ProbeReport } from "@modules/platform/probes"
import type { CheckHealthResponse } from "./dto/check-health.response"

/** Maps the report of a healthy service to the probe response. */
export const toCheckHealthResponse = (report: ProbeReport): CheckHealthResponse => ({
    status: "ok",
    service: report.service,
    checks: report.checks,
})
