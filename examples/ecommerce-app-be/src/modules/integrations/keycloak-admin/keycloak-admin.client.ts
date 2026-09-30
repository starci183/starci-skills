import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { isRecord, ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { KeycloakAdminErrorCode } from "./errors/keycloak-admin.error"
import type { KeycloakMember } from "./keycloak-admin.contracts"
import { InjectKeycloakAdminOptions } from "./keycloak-admin.decorators"
import type { KeycloakAdminOptions } from "./keycloak-admin.options"
import type { KeycloakAdmin } from "./keycloak-admin.port"

type Answer = Awaited<ReturnType<HttpClient["request"]>>

@Injectable()
/**
 * The Keycloak admin adapter over the outbound HTTP port. A 404 is a missing member; a failed call, a timeout, a 5xx,
 * any other status and a body outside the contract are the provider being unavailable.
 */
export class KeycloakAdminClient implements KeycloakAdmin {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectKeycloakAdminOptions() private readonly options: KeycloakAdminOptions,
    ) {}

    /** The member with `memberId`, or the refusal. */
    async findMember(memberId: string): Promise<Outcome<KeycloakMember, KeycloakAdminErrorCode>> {
        const response = await this.send(memberId)
        if (response === null) return refused(KeycloakAdminErrorCode.Unavailable)
        if (response.status === 404) return refused(KeycloakAdminErrorCode.MemberMissing, { memberId })
        const member = response.status === 200 ? toMember(response.body) : null
        return member === null ? refused(KeycloakAdminErrorCode.Unavailable) : ok(member)
    }

    private async send(memberId: string): Promise<Answer | null> {
        try {
            return await this.http.request({
                method: "GET",
                url: `${this.options.url}/admin/realms/${this.options.realm}/users/${encodeURIComponent(memberId)}`,
                headers: { authorization: `Bearer ${this.options.token.reveal()}` },
                timeoutMs: this.options.timeoutMs,
            })
        } catch {
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
