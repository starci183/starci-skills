import { Injectable } from "@nestjs/common"
import { DomainError } from "@modules/platform/errors"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { ProbesErrorCode } from "./errors/probes.error"
import type { ProbeReport, ProbeState } from "./probes.contracts"
import { InjectProbesOptions, InjectProbes } from "./probes.decorators"
import { ProbesLogEvent } from "./probes.log-events"
import type { ProbesOptions } from "./probes.options"
import type { Probe } from "./probes.port"

@Injectable()
/** Runs every probe of the app and reports which dependency answered; a failing probe is logged, never rethrown. */
export class ProbeChecker {
    constructor(
        @InjectProbesOptions() private readonly options: ProbesOptions,
        @InjectProbes() private readonly probes: ReadonlyArray<Probe>,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Probes every dependency and reports the state of each. */
    async run(): Promise<ProbeReport> {
        const states = await Promise.all(this.probes.map(async (probe) => [probe.name, await this.state(probe)] as const))
        return {
            service: this.options.service,
            checks: Object.fromEntries(states),
            healthy: states.every(([, state]) => state === "ok"),
        }
    }

    /** The report of a healthy service, or the refusal carrying the state of each dependency. */
    async check(): Promise<Outcome<ProbeReport, ProbesErrorCode.DependencyUnavailable>> {
        const report = await this.run()
        return report.healthy ? ok(report) : refused(ProbesErrorCode.DependencyUnavailable, report.checks)
    }

    private async state(probe: Probe): Promise<ProbeState> {
        try {
            await probe.check()
            return "ok"
        } catch (error) {
            this.logger.warn(ProbesLogEvent.ProbeFailed, {
                dependency: probe.name,
                code: error instanceof DomainError ? error.code : undefined,
                cause: String(error),
            })
            return "unreachable"
        }
    }
}
