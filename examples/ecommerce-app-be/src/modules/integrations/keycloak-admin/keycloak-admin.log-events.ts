/** Log events of the keycloak admin integration. */
export enum KeycloakAdminLogEvent {
    /** The admin lookup call failed before any answer; the member id rides in the fields and the failure is the cause. */
    RequestFailed = "keycloak_admin.request.failed",
}
