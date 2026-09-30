import { Module } from "@nestjs/common"
import { HealthModule } from "../../health.module"
import { HealthController } from "./health.controller"
import { MetricsController } from "./metrics.controller"

@Module({ imports: [HealthModule], controllers: [HealthController, MetricsController] })
/** The HTTP transport of the health feature: the probe door and the metrics scrape door. */
export class HealthHttpModule {}
