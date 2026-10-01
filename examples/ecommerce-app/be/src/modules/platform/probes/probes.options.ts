import type { InjectionToken } from "@nestjs/common"

/** Options of the probes capability. */
export interface ProbesOptions {
    /** The name the service reports itself under. */
    readonly service: string
    /** The tokens of the Probe providers this app reports on; each must be provided by a registered capability. */
    readonly probes: ReadonlyArray<InjectionToken>
}
