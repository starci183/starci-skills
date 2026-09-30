import { QueryHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectMetrics } from "@modules/platform/observability"
import type { MetricsRegistryService } from "@modules/platform/observability"
import type { RenderMetricsResult } from "./render-metrics.contracts"
import { RenderMetricsQuery } from "./render-metrics.query"

@QueryHandler(RenderMetricsQuery)
/** Renders the registry the observability interceptor fills, for the scrape door of the metrics collector. */
export class RenderMetricsHandler extends ICQRSHandler<RenderMetricsQuery, RenderMetricsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectMetrics() private readonly metrics: MetricsRegistryService,
    ) {
        super(logger)
    }

    protected override process(): Promise<RenderMetricsResult> {
        return this.metrics.render()
    }
}
