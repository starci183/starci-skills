/** Log events of the receipt storage integration. */
export enum ReceiptStorageLogEvent {
    /** A receipt was stored; the key and the run key of the claim that stored it ride in the fields. */
    Stored = "receipt_storage.store.stored",
    /** A store call failed; the key and the reason ride in the fields, the failure is the cause. */
    StoreFailed = "receipt_storage.store.failed",
}
