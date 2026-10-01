/** Log events of the observability capability. */
export enum ObservabilityLogEvent {
    /** One request finished: the request id, method, route, status and duration ride in the fields, never headers or bodies. */
    RequestCompleted = "http.request.completed",
}
