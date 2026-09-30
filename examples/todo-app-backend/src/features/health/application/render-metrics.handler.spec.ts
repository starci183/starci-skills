import { mock } from "@starci/jest-preset/mock"
import type { Logger } from "@modules/platform/logging"
import type { Metrics } from "@modules/platform/observability"
import { RenderMetricsHandler } from "./render-metrics.handler"
import { RenderMetricsQuery } from "./render-metrics.query"

describe("RenderMetricsHandler", () => {
    it("answers the exposition text of the registry", async () => {
        const metrics = mock<Metrics>({ renderPrometheus: jest.fn().mockReturnValue("# HELP x\n") })
        const result = await new RenderMetricsHandler(mock<Logger>(), metrics).execute(new RenderMetricsQuery({ request: {} }))
        expect(result).toEqual({ exposition: "# HELP x\n" })
    })
})
