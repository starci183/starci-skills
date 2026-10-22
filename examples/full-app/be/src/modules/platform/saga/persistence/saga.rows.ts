import type { SagaStatus } from "../saga.contracts"

/** The row READ_SAGA answers. */
export interface SagaStateRow {
    /** The status. */
    status: SagaStatus
    /** The fence. */
    version: number
}

/** The row MOVE_SAGA answers. */
export interface SagaVersionRow {
    /** The new fence. */
    version: number
}
