import { Controller, Get } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { PublicReason, Public } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { ProbesError } from "@modules/platform/probes"
import type { LivenessReport } from "@modules/platform/probes"
import { CheckHealthQuery } from "../../application/check-health.query"
import { CheckLivenessQuery } from "../../application/check-liveness.query"
import { toCheckHealthResponse } from "./check-health.mapper"
import type { CheckHealthResponse } from "./dto/check-health.response"

@Controller("health")
/** Process-local liveness and dependency readiness; the original health route remains a readiness alias. */
export class HealthController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers while this process can handle requests, without touching a dependency. */
    @Get("live")
    @Public({ reason: PublicReason.Health })
    live(): Promise<LivenessReport> {
        return this.queryBus.execute(new CheckLivenessQuery({ request: {} }))
    }

    /** Returns 503 when a required dependency fails or misses its bounded deadline. */
    @Get("ready")
    @Public({ reason: PublicReason.Health })
    async ready(): Promise<CheckHealthResponse> {
        const outcome = await this.queryBus.execute(new CheckHealthQuery({ request: {} }))
        return toCheckHealthResponse(unwrapOutcome(outcome, ProbesError))
    }

    /** Probes the dependencies of the app. */
    @Get()
    @Public({ reason: PublicReason.Health })
    async checkHealth(): Promise<CheckHealthResponse> {
        const outcome = await this.queryBus.execute(new CheckHealthQuery({ request: {} }))
        return toCheckHealthResponse(unwrapOutcome(outcome, ProbesError))
    }
}
