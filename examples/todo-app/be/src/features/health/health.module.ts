import { Module } from "@nestjs/common"
import { CheckHealthHandler } from "./application/check-health.handler"
import { RenderMetricsHandler } from "./application/render-metrics.handler"

@Module({ providers: [CheckHealthHandler, RenderMetricsHandler] })
/** The health feature: the handlers that probe the dependencies the app composed and render its request metrics. */
export class HealthModule {}
