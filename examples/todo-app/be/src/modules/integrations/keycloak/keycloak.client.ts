import { Injectable } from "@nestjs/common"
import { HttpError, InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { KeycloakError, KeycloakErrorCode } from "./errors/keycloak.error"
import type { KeycloakSignIn, KeycloakSignInParams, KeycloakSignOutParams } from "./keycloak.contracts"
import { InjectKeycloakOptions } from "./keycloak.decorators"
import type { KeycloakOptions } from "./keycloak.options"
import { readRefreshToken, readSubject } from "./keycloak-token.policy"

type Call = Parameters<HttpClient["request"]>[0]
type Answer = Awaited<ReturnType<HttpClient["request"]>>

@Injectable()
/**
 * The identity provider: this product never stores a password. Sign-in is one round-trip to the token endpoint of the
 * realm (direct access grant); the provider answers an unknown email and a wrong password with the same refusal, so
 * the refusal is uniform without a second call, and the subject is read from the token it already returned.
 */
export class KeycloakClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectKeycloakOptions() private readonly options: KeycloakOptions,
    ) {}

    /** The subject of the person the provider accepts, or a KeycloakError: refused credentials or an unreachable provider. */
    async signIn(params: KeycloakSignInParams): Promise<KeycloakSignIn> {
        const response = await this.send({
            method: "POST",
            url: this.options.tokenUrl,
            form: {
                grant_type: "password",
                client_id: this.options.clientId,
                username: params.email,
                password: params.password,
            },
            timeoutMs: this.options.timeoutMs,
        })
        const granted = response.status >= 200 && response.status < 300
        const subject = granted ? readSubject(response.body) : null
        const refreshToken = granted ? readRefreshToken(response.body) : null
        if (subject === null || refreshToken === null) {
            throw new KeycloakError({ code: KeycloakErrorCode.InvalidCredentials })
        }
        return { subject, refreshToken }
    }

    /**
     * Ends the provider session a sign-in opened, so a revoked local session leaves no live grant at the realm: the
     * OpenID Connect logout endpoint of the realm (beside its token endpoint) with the client id and the session's
     * refresh token, form-encoded. A refusal of the provider (the session already ended there) is not an error; only a
     * call that cannot complete fails, with a KeycloakError.
     */
    async notifySignOut(params: KeycloakSignOutParams): Promise<void> {
        await this.send({
            method: "POST",
            url: new URL("logout", this.options.tokenUrl).toString(),
            form: { client_id: this.options.clientId, refresh_token: params.refreshToken },
            timeoutMs: this.options.timeoutMs,
        })
    }

    private async send(call: Call): Promise<Answer> {
        try {
            return await this.http.request(call)
        } catch (cause) {
            if (cause instanceof HttpError) {
                throw new KeycloakError({ code: KeycloakErrorCode.ProviderUnavailable, cause })
            }
            throw cause
        }
    }
}
