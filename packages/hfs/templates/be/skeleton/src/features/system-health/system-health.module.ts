import { Module } from "@nestjs/common"
import { SystemHealthHttpModule } from "./transport/http/system-health-http.module"

/** Application module of the health feature: process-local liveness now, readiness with the design that declares dependencies. */
@Module({ imports: [SystemHealthHttpModule] })
export class SystemHealthModule {}
