import { Module } from "@nestjs/common"
import { SystemHealthModule } from "../../system-health.module"
import { LiveController } from "./live.controller"
import { ReadyController } from "./ready.controller"
import { ConfigurableModuleClass } from "./system-health-http.module-definition"

@Module({
    imports: [SystemHealthModule.register({})],
    controllers: [LiveController, ReadyController],
})
/** The HTTP transport of the health feature: independent liveness and required-dependency readiness doors. */
export class SystemHealthHttpModule extends ConfigurableModuleClass {}
