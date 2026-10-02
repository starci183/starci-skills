import type { SagaStatus } from "@modules/platform/saga"

/** The persisted state of one run of the place-order saga: one row per order, moved only through its version (the fence of `platform/saga`). */
export interface PlaceOrderSagaState {
    /** The order the run is about. */
    readonly correlationId: string
    /** Where the run stands: running its steps, compensating after a rejected invoice, compensated or completed. */
    readonly status: SagaStatus
    /** The fence: every transition names the version it read and moves it by one. */
    readonly version: number
}
