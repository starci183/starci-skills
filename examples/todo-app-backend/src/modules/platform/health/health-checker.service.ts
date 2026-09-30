import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { HealthReport, ProbeState } from "./health.contracts"
import { InjectHealthOptions, InjectHealthProbes } from "./health.decorators"
import { HealthLogEvent } from "./health.log-events"
import type { HealthOptions } from "./health.options"
import type { HealthProbe } from "./health.port"

@Injectable()
/** Runs every probe of the app and reports which dependency answered; a failing probe is logged, never rethrown. */
export class HealthChecker {
    constructor(
        @InjectHealthOptions() private readonly options: HealthOptions,
        @InjectHealthProbes() private readonly probes: ReadonlyArray<HealthProbe>,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Probes every dependency and reports the state of each. */
    async run(): Promise<HealthReport> {
        const states = await Promise.all(this.probes.map(async (probe) => [probe.name, await this.state(probe)] as const))
        return {
            service: this.options.service,
            checks: Object.fromEntries(states),
            healthy: states.every(([, state]) => state === "ok"),
        }
    }

    private async state(probe: HealthProbe): Promise<ProbeState> {
        try {
            await probe.check()
            return "ok"
        } catch (error) {
            this.logger.warn(HealthLogEvent.ProbeFailed, { dependency: probe.name, cause: String(error) })
            return "unreachable"
        }
    }
}
