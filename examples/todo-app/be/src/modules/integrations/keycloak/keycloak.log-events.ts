/** Log events of the keycloak integration. */
export enum KeycloakLogEvent {
    /** Ending the provider session at sign-out failed (the realm was unreachable); the local session was already revoked. */
    SignOutNotifyFailed = "keycloak.sign-out-notify.failed",
}
