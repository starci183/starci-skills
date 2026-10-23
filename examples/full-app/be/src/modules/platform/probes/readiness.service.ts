import { Injectable } from "@nestjs/common"
import { InjectTimer } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { ProbesError, ProbesErrorCode } from "./errors/probes.error"
import { InjectProbeChecker, InjectProbes } from "./probes.decorators"
import type { ProbeCheckerService } from "./probe-checker.service"
import type { Probe } from "./probes.port"
import type { ReadinessReport } from "./readiness.contracts"

/** The cancel of a deadline that was never scheduled. */
const noCancel = (): void => undefined

const READINESS_TIMEOUT_MS = 1000

@Injectable()
/** Required-dependency readiness; liveness never calls these app-composed probes. */
export class ReadinessService {
    constructor(
        @InjectProbes() private readonly probes: ReadonlyArray<Probe>,
        @InjectTimer() private readonly timer: Timer,
        @InjectProbeChecker() private readonly checker: ProbeCheckerService,
    ) {}

    /** Returns ready only when the app's required dependencies answer within one second. */
    async probeRequired(): Promise<ReadinessReport> {
        let cancel: () => void = noCancel
        try {
            if (this.probes.length === 0) throw new ProbesError({ code: ProbesErrorCode.DependencyUnavailable })
            await Promise.race([
                Promise.all(this.probes.map((probe) => probe.check())),
                new Promise<never>((_resolve, reject) => {
                    cancel = this.timer.schedule(
                        () => reject(new Error("Required dependency readiness timed out")),
                        READINESS_TIMEOUT_MS,
                    )
                }),
            ])
        } catch (cause) {
            throw new ProbesError({
                code: ProbesErrorCode.DependencyUnavailable,
                cause,
                params: { readiness: "unreachable" },
            })
        } finally {
            cancel()
        }
        return this.checker.check()
    }
}
