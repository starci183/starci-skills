import { Module } from "@nestjs/common"
import { CheckLivenessHandler } from "./application/check-liveness.handler"

@Module({ providers: [CheckLivenessHandler] })
/** Application module of the health feature: the handler of the liveness probe; readiness comes with the design that declares dependencies. */
export class SystemHealthModule {}
