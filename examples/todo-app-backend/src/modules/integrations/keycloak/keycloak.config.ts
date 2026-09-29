import {
    AppConfigService,
} from "@modules/platform/config/index"

/** The Keycloak realm settings the client needs: the token endpoint and the client id. */
export interface KeycloakConfig {
    readonly tokenUrl: string
    readonly clientId: string
}

/** Reads the keycloak settings through the platform config reader on every access, so a value changed in the environment is never cached here. */
export const keycloakConfig = (source: AppConfigService): KeycloakConfig => ({
    get tokenUrl(): string {
        return source.getKeycloakTokenUrl()
    },
    get clientId(): string {
        return source.getKeycloakClientId()
    },
})
