import type { InjectionToken } from "@nestjs/common"

/** Options of the probes capability. */
export interface ProbesOptions {
    /** The name the service reports itself under. */
    readonly service: string
    /** Required dependency providers; every probe must answer before readiness succeeds. */
    readonly probes: ReadonlyArray<InjectionToken>
}
