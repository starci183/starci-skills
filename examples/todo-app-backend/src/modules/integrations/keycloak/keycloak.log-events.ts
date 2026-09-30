/** Log events of the keycloak integration. */
export enum KeycloakLogEvent {
    /** The best-effort sign-out notice to the provider failed; the local session was already revoked. */
    SignOutNotifyFailed = "keycloak.sign-out-notify.failed",
}
