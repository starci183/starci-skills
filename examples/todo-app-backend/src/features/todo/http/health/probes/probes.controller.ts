import {
    Controller, Get, Header, UseFilters 
} from "@nestjs/common"
import {
    PostgresPrimaryClient 
} from "@modules/platform/databases/postgresql/primary/primary.client"
import {
    MetricsService 
} from "@modules/platform/observability/metrics.service"
import {
    PostgresPrimaryUnavailableException 
} from "@modules/shared/exceptions/errors/postgres/postgres-primary-unavailable"
import {
    ProbesExceptionFilter 
} from "./probes-exception.filter"

/**
 * The api's remaining anonymous infra doors, beside the feature's /health under the same door folder:
 * orchestrators and the prometheus scraper are machines with no user session, so these endpoints
 * must not have to speak GraphQL.
 *
 *  - GET /ready  is readiness: answers ok only while the one real dependency (primary postgres) does.
 *    /health keeps its own behaviour - the e2e stack's boot probe already treats it as the
 *    dependency-checked door - so this endpoint gives orchestrators the explicit readiness name
 *    without moving the door those probes and specs already quote.
 *  - GET /metrics serves MetricsService's Prometheus text exposition; the dev stack's prometheus
 *    service scrapes api:3001 for exactly this path.
 */
@Controller()
@UseFilters(ProbesExceptionFilter)
/** GET /ready and GET /metrics - the platform's anonymous probe surfaces. */
export class ProbesController {
    constructor(
    private readonly db: PostgresPrimaryClient,
        private readonly metricsRegistry: MetricsService,
    ) {}

    @Get("ready")
    async ready(): Promise<{ status: "ok" }> {
        try {
            await this.db.ping()
        } catch (error) {
            throw new PostgresPrimaryUnavailableException({
                reason: String(error) 
            })
        }
        return {
            status: "ok" 
        }
    }

    @Get("metrics")
    @Header("content-type",
        "text/plain; version=0.0.4; charset=utf-8")
    metrics(): string {
        return this.metricsRegistry.renderPrometheus()
    }
}
