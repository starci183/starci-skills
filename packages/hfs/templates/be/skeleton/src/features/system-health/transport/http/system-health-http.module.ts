import { Module } from "@nestjs/common"
import { SystemHealthModule } from "../../system-health.module"
import { LiveController } from "./live.controller"

@Module({ imports: [SystemHealthModule], controllers: [LiveController] })
/** The HTTP transport of the health feature: the liveness door. */
export class SystemHealthHttpModule {}
