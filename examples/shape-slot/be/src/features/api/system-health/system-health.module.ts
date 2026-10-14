import { Module } from "@nestjs/common"
import { CheckLivenessHandler } from "./application/check-liveness.handler"
import { CheckReadinessHandler } from "./application/check-readiness.handler"

@Module({ providers: [CheckLivenessHandler, CheckReadinessHandler] })
/** The health feature separates process-local liveness from readiness of its required primary database. */
export class SystemHealthModule {}
