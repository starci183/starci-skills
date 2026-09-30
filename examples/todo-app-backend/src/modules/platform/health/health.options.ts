import type { InjectionToken } from "@nestjs/common"

/** Options of the health capability. */
export interface HealthOptions {
    /** The name the service reports itself under. */
    readonly service: string
    /** The tokens of the HealthProbe providers this app reports on; each must be provided by a registered capability. */
    readonly probes: ReadonlyArray<InjectionToken>
}
