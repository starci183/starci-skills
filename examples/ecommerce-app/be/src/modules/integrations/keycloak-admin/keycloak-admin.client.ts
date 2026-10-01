import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isRecord, ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { KeycloakAdminErrorCode } from "./errors/keycloak-admin.error"
import type { KeycloakMember } from "./keycloak-admin.contracts"
import { InjectKeycloakAdminOptions } from "./keycloak-admin.decorators"
import { KeycloakAdminLogEvent } from "./keycloak-admin.log-events"
import type { KeycloakAdminOptions } from "./keycloak-admin.options"
import type { KeycloakAdmin } from "./keycloak-admin.port"
import { KeycloakAdminTokenService } from "./keycloak-admin-token.service"

type Answer = Awaited<ReturnType<HttpClient["request"]>>

@Injectable()
/**
 * The Keycloak admin adapter over the outbound HTTP port. Every call carries the service account's access token (the
 * client-credentials grant, renewed before it expires; a 401 drops it). A 404 is a missing member; a failed grant or call,
 * a timeout, a 5xx, any other status and a body outside the contract are the provider being unavailable.
 */
export class KeycloakAdminClient implements KeycloakAdmin {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectKeycloakAdminOptions() private readonly options: KeycloakAdminOptions,
        @InjectLogger() private readonly logger: Logger,
        private readonly tokens: KeycloakAdminTokenService,
    ) {}

    /** The member with `memberId`, or the refusal. */
    async findMember(memberId: string): Promise<Outcome<KeycloakMember, KeycloakAdminErrorCode>> {
        const response = await this.send(memberId)
        if (response === null) return refused(KeycloakAdminErrorCode.Unavailable)
        if (response.status === 401) this.tokens.forget()
        if (response.status === 404) return refused(KeycloakAdminErrorCode.MemberMissing, { memberId })
        const member = response.status === 200 ? toMember(response.body) : null
        return member === null ? refused(KeycloakAdminErrorCode.Unavailable) : ok(member)
    }

    private async send(memberId: string): Promise<Answer | null> {
        const token = await this.tokens.accessToken()
        if (token === null) return null
        try {
            return await this.http.request({
                method: "GET",
                url: `${this.options.url}/admin/realms/${encodeURIComponent(this.options.realm)}/users/${encodeURIComponent(memberId)}`,
                headers: { authorization: `Bearer ${token}` },
                timeoutMs: this.options.timeoutMs,
            })
        } catch (cause) {
            this.logger.error(KeycloakAdminLogEvent.RequestFailed, cause, { memberId })
            return null
        }
    }
}

const toMember = (body: unknown): KeycloakMember | null => {
    if (!isRecord(body)) return null
    const { id, email, username } = body
    if (typeof id !== "string" || typeof email !== "string" || typeof username !== "string") return null
    return { id, email, displayName: username }
}
