import type { SagaStatus } from "@modules/platform/saga"

/** The persisted state of one run of the @@saga@@ saga: one row per run, moved only through its version (the fence of `platform/saga`). */
export interface @@Saga@@SagaState {
    /** The id the run is about. */
    readonly correlationId: string
    /** Where the run stands: running its steps, compensating, compensated or completed. */
    readonly status: SagaStatus
    /** The fence: every transition names the version it read and moves it by one. */
    readonly version: number
}

/** The state of the run of an id, or null when it never started one. */
export type Find@@Saga@@SagaResult = @@Saga@@SagaState | null
