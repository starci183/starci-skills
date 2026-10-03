/** Log events of the cqrs capability. */
export enum CqrsLogEvent {
    /** A handler threw; the operation name rides in the fields and the failure is the cause. */
    OperationFailed = "cqrs.operation.failed",
}
