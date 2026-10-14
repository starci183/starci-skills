import { Module } from "@nestjs/common"
import { READINESS, ReadinessService } from "@modules/platform/http-security"
import { SystemHealthModule } from "../../system-health.module"
import { LiveController } from "./live.controller"
import { ReadyController } from "./ready.controller"

@Module({
    imports: [SystemHealthModule],
    controllers: [LiveController, ReadyController],
    providers: [ReadinessService, { provide: READINESS, useExisting: ReadinessService }],
})
/** The HTTP transport of the health feature: independent liveness and required-dependency readiness doors. */
export class SystemHealthHttpModule {}
