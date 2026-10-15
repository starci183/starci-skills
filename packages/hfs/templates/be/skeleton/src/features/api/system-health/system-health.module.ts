import { Module } from "@nestjs/common"
import { CheckLivenessHandler } from "./application/check-liveness.handler"
import { CheckReadinessHandler } from "./application/check-readiness.handler"

@Module({ providers: [CheckLivenessHandler, CheckReadinessHandler] })
/** Application handlers of the independent liveness and required-dependency readiness probes. */
export class SystemHealthModule {}
