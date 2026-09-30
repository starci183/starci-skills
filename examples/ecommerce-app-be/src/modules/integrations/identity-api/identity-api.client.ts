import { Injectable } from "@nestjs/common"
import { callGraphql, InjectHttpClient } from "@modules/platform/http"
import type { GraphqlAnswer, HttpClient } from "@modules/platform/http"
import type { Probe } from "@modules/platform/probes"
import { isRecord } from "@modules/platform/primitives"
import { IdentityApiError, IdentityApiErrorCode } from "./errors/identity-api.error"
import { InjectIdentityApiOptions } from "./identity-api.decorators"
import type { IdentityApiOptions } from "./identity-api.options"

/** The wire code the identity service answers when no live session matches a token. */
const SESSION_INVALID_CODE = "SESSION_INVALID"

const VERIFY_SESSION_QUERY =
    "query VerifySession($input: VerifySessionInput!) { verifySession(request: $input) { personId } }"

/** The person behind a live session, as the identity service names them. */
export interface IdentitySession {
    /** The person the token authenticates. */
    readonly personId: string
}

@Injectable()
/** The order service view of the identity service: it verifies bearer tokens over the identity GraphQL door and probes its health. */
export class IdentityApiClient implements Probe {
    /** The name the health report lists this dependency under. */
    readonly name = "identity"

    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectIdentityApiOptions() private readonly options: IdentityApiOptions,
    ) {}

    /** The session behind `sessionToken`, or null when the identity service refuses the token. */
    async verify(sessionToken: string): Promise<IdentitySession | null> {
        const answer = await this.ask(sessionToken)
        if (answer === null) throw new IdentityApiError({ code: IdentityApiErrorCode.ContractMismatch })
        if (answer.errorCodes.includes(SESSION_INVALID_CODE)) return null
        if (answer.errorCodes.length > 0) {
            throw new IdentityApiError({
                code: IdentityApiErrorCode.Unavailable,
                params: { reason: answer.errorCodes.join(",") },
            })
        }
        const verified = answer.data?.verifySession
        if (!isRecord(verified) || typeof verified.personId !== "string") {
            throw new IdentityApiError({ code: IdentityApiErrorCode.ContractMismatch })
        }
        return { personId: verified.personId }
    }

    /** Resolves when the identity service reports itself healthy. */
    async check(): Promise<void> {
        try {
            const response = await this.http.request({
                method: "GET",
                url: `${this.options.url}/health`,
                timeoutMs: this.options.timeoutMs,
            })
            if (response.status !== 200) {
                throw new IdentityApiError({
                    code: IdentityApiErrorCode.Unavailable,
                    params: { status: response.status },
                })
            }
        } catch (cause) {
            throw cause instanceof IdentityApiError
                ? cause
                : new IdentityApiError({ code: IdentityApiErrorCode.Unavailable, cause })
        }
    }

    private async ask(sessionToken: string): Promise<GraphqlAnswer | null> {
        try {
            return await callGraphql(this.http, {
                url: `${this.options.url}/graphql`,
                query: VERIFY_SESSION_QUERY,
                variables: { input: { sessionToken } },
                timeoutMs: this.options.timeoutMs,
            })
        } catch (cause) {
            throw new IdentityApiError({ code: IdentityApiErrorCode.Unavailable, cause })
        }
    }
}
