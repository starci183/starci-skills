import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isRecord, ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { KeycloakAdminErrorCode } from "./errors/keycloak-admin.error"
import type { CreatedMember, CreateMemberParams } from "./keycloak-admin.contracts"
import { InjectKeycloakAdminOptions } from "./keycloak-admin.decorators"
import { KeycloakAdminLogEvent } from "./keycloak-admin.log-events"
import type { KeycloakAdminOptions } from "./keycloak-admin.options"
import type { KeycloakAdmin } from "./keycloak-admin.port"
import { KeycloakAdminTokenService } from "./keycloak-admin-token.service"

type Answer = Awaited<ReturnType<HttpClient["request"]>>

const HTTP_CREATED = 201
const HTTP_OK = 200
const HTTP_UNAUTHORIZED = 401
const HTTP_CONFLICT = 409

@Injectable()
/**
 * The Keycloak admin adapter over the outbound HTTP port: it creates the shoppers of the realm. Every call carries the
 * service account's access token (the client-credentials grant, renewed before it expires; a 401 drops it). A user whose
 * email the realm already holds is the declared email-taken refusal; a failed grant or call, a timeout and any other answer
 * are the provider being unavailable.
 */
export class KeycloakAdminClient implements KeycloakAdmin {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectKeycloakAdminOptions() private readonly options: KeycloakAdminOptions,
        @InjectLogger() private readonly logger: Logger,
        private readonly tokens: KeycloakAdminTokenService,
    ) {}

    /** Creates an enabled user with the password, and answers the subject id the realm gave it. */
    async createMember(params: CreateMemberParams): Promise<Outcome<CreatedMember, KeycloakAdminErrorCode>> {
        const created = await this.send({
            method: "POST",
            path: "users",
            body: {
                username: params.email,
                email: params.email,
                enabled: true,
                emailVerified: true,
                credentials: [{ type: "password", value: params.password, temporary: false }],
            },
        })
        if (created === null) return refused(KeycloakAdminErrorCode.Unavailable)
        if (created.status === HTTP_CONFLICT) return refused(KeycloakAdminErrorCode.EmailTaken)
        if (created.status !== HTTP_CREATED) return refused(KeycloakAdminErrorCode.Unavailable)
        const found = await this.send({
            method: "GET",
            path: `users?email=${encodeURIComponent(params.email)}&exact=true`,
        })
        const id = found?.status === HTTP_OK ? idOf(found.body) : null
        return id === null ? refused(KeycloakAdminErrorCode.Unavailable) : ok({ id })
    }

    private async send(call: AdminCall): Promise<Answer | null> {
        const token = await this.tokens.accessToken()
        if (token === null) return null
        try {
            const answer = await this.http.request({
                method: call.method,
                url: `${this.options.url}/admin/realms/${encodeURIComponent(this.options.realm)}/${call.path}`,
                headers: { authorization: `Bearer ${token}` },
                ...(call.body === undefined ? {} : { body: call.body }),
                timeoutMs: this.options.timeoutMs,
            })
            if (answer.status === HTTP_UNAUTHORIZED) this.tokens.forget()
            return answer
        } catch (cause) {
            this.logger.error(KeycloakAdminLogEvent.RequestFailed, cause, { path: call.path.split("?")[0] })
            return null
        }
    }
}

/** One call of the admin API, relative to the realm's admin root. */
interface AdminCall {
    readonly method: "GET" | "POST"
    readonly path: string
    readonly body?: unknown
}

/** The id of the one user an exact email search answers, or null. */
const idOf = (body: unknown): string | null => {
    const user: unknown = Array.isArray(body) ? body[0] : undefined
    return isRecord(user) && typeof user.id === "string" ? user.id : null
}
