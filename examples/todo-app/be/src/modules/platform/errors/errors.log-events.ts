/** Log events of the errors capability. */
export enum ErrorsLogEvent {
    /** A failure no capability declared reached a transport and was masked; the cause rides in the line. */
    Unhandled = "errors.unhandled",
}
