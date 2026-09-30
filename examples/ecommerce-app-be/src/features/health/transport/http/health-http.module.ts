import { Module } from "@nestjs/common"
import { HealthModule } from "../../health.module"
import { HealthController } from "./health.controller"

@Module({ imports: [HealthModule], controllers: [HealthController] })
/** The HTTP transport of the health feature: the probe door. */
export class HealthHttpModule {}
