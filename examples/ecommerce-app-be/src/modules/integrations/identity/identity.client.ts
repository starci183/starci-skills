import {
    Injectable 
} from "@nestjs/common"
import {
    AppConfigService 
} from "ecommerce-app-be/modules/platform/config/order"
import {
    IdentityServiceUnavailableException 
} from "ecommerce-app-be/modules/platform/errors"
import {
    IdentityContractMismatchException 
} from "ecommerce-app-be/modules/platform/errors"
import {
    LogId, Logger 
} from "ecommerce-app-be/modules/platform/logging"
import {
    IDENTITY_PROBE_TIMEOUT_MS, IDENTITY_VERIFY_TIMEOUT_MS
} from "./identity.config"

/** The person behind a live session, as identity's internal verify door answers it. */
export interface SessionPersonResult {
  personId: string;
}

/** Identity service answer for a live session; null means the bearer was refused. */
export type VerifiedSessionPersonResult = SessionPersonResult | null

@Injectable()
/**
 * The order service's real HTTP client toward the identity service (its internal/sessions/verify
 * door): every authenticated checkout call passes through here, on a base URL resolved from
 * metadata.json - never a hardcoded port literal. A refused token answers null (the consumer
 * turns it into its own 401, same doctrine as todo's contract refusal propagation); an
 * unreachable identity answers a typed 503 - never a pass-through.
 */
export class IdentityApiClient {
    constructor(private readonly config: AppConfigService, private readonly logger: Logger) {}

    async verifySession(sessionToken: string): Promise<VerifiedSessionPersonResult> {
        let response: Response
        try {
            response = await fetch(`${this.config.getIdentityApiBaseUrl()}/internal/sessions/verify`,
                {
                    method: "POST",
                    headers: {
                        "content-type": "application/json" 
                    },
                    body: JSON.stringify({
                        sessionToken 
                    }),
                    signal: AbortSignal.timeout(IDENTITY_VERIFY_TIMEOUT_MS),
                })
        } catch {
            throw new IdentityServiceUnavailableException({
                message: "The identity service could not be reached." 
            })
        }
        if (response.status === 401) return null
        if (!response.ok) {
            throw new IdentityServiceUnavailableException({
                message: `The identity service answered ${response.status}.` 
            })
        }
        let body: Partial<SessionPersonResult>
        try {
            body = (await response.json()) as Partial<SessionPersonResult>
        } catch {
            throw new IdentityContractMismatchException({
            })
        }
        if (typeof body.personId !== "string" || !body.personId) {
            throw new IdentityContractMismatchException({
            })
        }
        return {
            personId: body.personId 
        }
    }

    /** The identity service's own /health - order's /health reports it as a dependency. */
    async isHealthy(): Promise<boolean> {
        try {
            const response = await fetch(`${this.config.getIdentityApiBaseUrl()}/health`,
                {
                    signal: AbortSignal.timeout(IDENTITY_PROBE_TIMEOUT_MS) 
                })
            return response.ok
        } catch (error) {
            this.logger.warn(LogId.DependencyProbeFailed,
                {
                    dependency: "identity", message: error instanceof Error ? error.message : String(error) 
                })
            return false
        }
    }
}
