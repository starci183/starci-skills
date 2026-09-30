import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { RenderMetricsQuery } from "../../application/render-metrics.query"
import { MetricsController } from "./metrics.controller"

describe("MetricsController", () => {
    it("dispatches one render query and answers its exposition text", async () => {
        const queryBus = mock<QueryBus>({ execute: jest.fn().mockResolvedValue({ exposition: "# TYPE x counter\n" }) })
        await expect(new MetricsController(queryBus).renderMetrics()).resolves.toBe("# TYPE x counter\n")
        expect(queryBus.execute).toHaveBeenCalledWith(expect.any(RenderMetricsQuery))
    })
})
