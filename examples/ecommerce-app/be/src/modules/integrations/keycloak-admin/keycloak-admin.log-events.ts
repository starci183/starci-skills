/** Log events of the keycloak admin integration. */
export enum KeycloakAdminLogEvent {
    /** The admin lookup call failed before any answer; the member id rides in the fields and the failure is the cause. */
    RequestFailed = "keycloak_admin.request.failed",
    /** The client-credentials grant was refused or failed; the status (or the failure as the cause) rides in the fields. */
    TokenRefused = "keycloak_admin.token.refused",
}
