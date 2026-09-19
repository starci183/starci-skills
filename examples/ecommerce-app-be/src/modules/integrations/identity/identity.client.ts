import {
    Injectable 
} from "@nestjs/common"
import {
    AppConfigService 
} from "@modules/platform/config/order/app-config.service"
import {
    IdentityServiceUnavailableException 
} from "@modules/platform/exceptions/errors/integrations/identity-service-unavailable"
import {
    IdentityContractMismatchException 
} from "@modules/platform/exceptions/errors/integrations/identity-contract-mismatch"

/** The person behind a live session, as identity's internal verify door answers it. */
export interface SessionPersonResult {
  personId: string;
}

@Injectable()
/**
 * The order service's real HTTP client toward the identity service (its internal/sessions/verify
 * door): every authenticated checkout call passes through here, on a base URL resolved from
 * metadata.json - never a hardcoded port literal. A refused token answers null (the consumer
 * turns it into its own 401, same doctrine as todo's contract refusal propagation); an
 * unreachable identity answers a typed 503 - never a pass-through.
 */
export class IdentityApiClient {
    constructor(private readonly config: AppConfigService) {}

    async verifySession(sessionToken: string): Promise<SessionPersonResult | null> {
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
                    signal: AbortSignal.timeout(3000),
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
                    signal: AbortSignal.timeout(2000) 
                })
            return response.ok
        } catch {
            return false
        }
    }
}
