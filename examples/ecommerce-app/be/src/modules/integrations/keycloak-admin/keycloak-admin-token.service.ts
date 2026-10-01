import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isRecord } from "@modules/platform/primitives"
import type { CachedAccessToken } from "./keycloak-admin.contracts"
import { InjectKeycloakAdminOptions } from "./keycloak-admin.decorators"
import { KeycloakAdminLogEvent } from "./keycloak-admin.log-events"
import type { KeycloakAdminOptions } from "./keycloak-admin.options"

/** A token is renewed this long before Keycloak says it expires, so a call never leaves with one about to lapse. */
const RENEW_BEFORE_MS = 30_000
const MILLISECONDS_PER_SECOND = 1000
const HTTP_OK = 200

@Injectable()
/**
 * The access token of the integration's service account: the client-credentials grant of the confidential client, kept
 * until shortly before it expires. A token the admin API refused is forgotten so the next call asks for a new one. A grant
 * that fails answers null; the caller reports the provider as unavailable.
 */
export class KeycloakAdminTokenService {
    private cached: CachedAccessToken | null = null

    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectClock() private readonly clock: Clock,
        @InjectKeycloakAdminOptions() private readonly options: KeycloakAdminOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** A valid access token, from the cache or a new grant; null when the grant fails. */
    async accessToken(): Promise<string | null> {
        const now = this.clock.now().getTime()
        if (this.cached !== null && now < this.cached.renewAt) return this.cached.value
        this.cached = await this.grant(now)
        return this.cached?.value ?? null
    }

    /** Drops the cached token (the admin API refused it). */
    forget(): void {
        this.cached = null
    }

    private async grant(now: number): Promise<CachedAccessToken | null> {
        try {
            const answer = await this.http.request({
                method: "POST",
                url: `${this.options.url}/realms/${encodeURIComponent(this.options.realm)}/protocol/openid-connect/token`,
                form: {
                    grant_type: "client_credentials",
                    client_id: this.options.clientId,
                    client_secret: this.options.clientSecret.reveal(),
                },
                timeoutMs: this.options.timeoutMs,
            })
            const body = answer.body
            if (
                answer.status !== HTTP_OK ||
                !isRecord(body) ||
                typeof body.access_token !== "string" ||
                typeof body.expires_in !== "number"
            ) {
                this.logger.warn(KeycloakAdminLogEvent.TokenRefused, { status: answer.status })
                return null
            }
            return {
                value: body.access_token,
                renewAt: now + body.expires_in * MILLISECONDS_PER_SECOND - RENEW_BEFORE_MS,
            }
        } catch (cause) {
            this.logger.error(KeycloakAdminLogEvent.TokenRefused, cause)
            return null
        }
    }
}
