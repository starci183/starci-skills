import { Module } from "@nestjs/common"
import { CheckHealthHandler } from "./application/check-health.handler"

@Module({ providers: [CheckHealthHandler] })
/** The health feature: the handler that probes the dependencies the app composed. */
export class HealthModule {}
