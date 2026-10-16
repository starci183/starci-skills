import type { LivenessReport } from "@modules/domain/liveness"

/** What get-tool-status takes. */
export interface GetToolStatusRequest {
    /** The tool id the credential authorizes. */
    readonly id: string
}

/** The process-local status served to the tool: the same small report as the liveness probe. */
export type GetToolStatusResult = LivenessReport
