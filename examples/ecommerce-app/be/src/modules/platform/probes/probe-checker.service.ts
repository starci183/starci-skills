import { Injectable } from "@nestjs/common"
import { withinDeadline } from "@modules/platform/http"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { ProbesErrorCode } from "./errors/probes.error"
import type { LivenessReport, ProbeReport, ProbeState } from "./probes.contracts"
import { InjectProbesOptions, InjectProbes } from "./probes.decorators"
import { ProbesLogEvent } from "./probes.log-events"
import type { ProbesOptions } from "./probes.options"
import type { Probe } from "./probes.port"

/** A hung dependency must not hold the readiness HTTP request open indefinitely. */
const PROBE_TIMEOUT_MS = 2_000

@Injectable()
/** Runs every probe of the app and reports which dependency answered; a failing probe is logged with its cause, never rethrown. */
export class ProbeCheckerService {
    constructor(
        @InjectProbesOptions() private readonly options: ProbesOptions,
        @InjectProbes() private readonly probes: ReadonlyArray<Probe>,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Answers from process-local state, even when a required dependency is down. */
    live(): Promise<LivenessReport> {
        return Promise.resolve({ status: "ok", service: this.options.service })
    }

    /** The report when every dependency answers, or the refusal carrying the state of each so an operator sees which one is down. */
    async check(): Promise<Outcome<ProbeReport, ProbesErrorCode.DependencyUnavailable>> {
        const report = await this.report()
        return report.healthy ? ok(report) : refused(ProbesErrorCode.DependencyUnavailable, report.checks)
    }

    private async report(): Promise<ProbeReport> {
        const states = await Promise.all(
            this.probes.map(async (probe) => [probe.name, await this.state(probe)] as const),
        )
        return {
            service: this.options.service,
            checks: Object.fromEntries(states),
            healthy: states.every(([, state]) => state === "ok"),
        }
    }

    private async state(probe: Probe): Promise<ProbeState> {
        try {
            await withinDeadline(() => probe.check(), PROBE_TIMEOUT_MS)
            return "ok"
        } catch (error) {
            this.logger.error(ProbesLogEvent.ProbeFailed, error, { dependency: probe.name })
            return "unreachable"
        }
    }
}
