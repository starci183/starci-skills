import { Module } from "@nestjs/common"
import { HealthModule } from "../../health.module"
import { ConfigurableModuleClass } from "./health-http.module-definition"
import { HealthController } from "./health.controller"

@Module({ imports: [HealthModule.register({})], controllers: [HealthController] })
/** The HTTP transport of the health feature: the probe door. */
export class HealthHttpModule extends ConfigurableModuleClass {}
