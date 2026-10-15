import { Module } from "@nestjs/common"
import { CheckHealthHandler } from "./application/check-health.handler"
import { CheckLivenessHandler } from "./application/check-liveness.handler"
import { ConfigurableModuleClass } from "./health.module-definition"

@Module({ providers: [CheckHealthHandler, CheckLivenessHandler] })
/** The health feature: the handler that probes the dependencies the app composed. */
export class HealthModule extends ConfigurableModuleClass {}
