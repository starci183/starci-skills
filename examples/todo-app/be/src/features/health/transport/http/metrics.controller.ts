import { Controller, Get, Header } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { RenderMetricsQuery } from "../../application/render-metrics.query"

@Controller("metrics")
/** The scrape door of the metrics collector: the request metrics in the Prometheus text exposition format. */
export class MetricsController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The exposition text of this process. */
    @Get()
    @Header("content-type", "text/plain; version=0.0.4; charset=utf-8")
    @Public({ reason: PublicReason.Health })
    async renderMetrics(): Promise<string> {
        const result = await this.queryBus.execute(new RenderMetricsQuery({ request: {} }))
        return result.exposition
    }
}
