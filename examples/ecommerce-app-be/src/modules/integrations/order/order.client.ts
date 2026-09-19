import {
    Injectable 
} from "@nestjs/common"
import {
    AppConfigService 
} from "@modules/platform/config/identity/app-config.service"
import {
    OrderServiceUnavailableException 
} from "@modules/platform/exceptions/errors/integrations/order-service-unavailable"
import {
    OrderContractMismatchException 
} from "@modules/platform/exceptions/errors/integrations/order-contract-mismatch"

/** The buyer-status answer the order service's internal door provides for a person. */
export interface BuyerStatusResult {
  personId: string;
  hasOrders: boolean;
}

@Injectable()
/**
 * The consumer half of contract.checkout.order-for-identity: does this person have orders?
 * A real HTTP call (global fetch) against the base URL AppConfigService resolves from
 * metadata.json - never a hardcoded port literal. An unreachable order service is a typed
 * 503 failure with a stable code, never an implied `hasOrders: false` - the contract says an
 * absent answer is not a no, and the caller must not retry into inventing one.
 */
export class OrderApiClient {
    constructor(private readonly config: AppConfigService) {}

    async getBuyerStatus(personId: string): Promise<BuyerStatusResult> {
        const url = `${this.config.getOrderApiBaseUrl()}/internal/buyers/${encodeURIComponent(personId)}`
        let response: Response
        try {
            response = await fetch(url,
                {
                    signal: AbortSignal.timeout(3000) 
                })
        } catch {
            throw new OrderServiceUnavailableException({
                message: "The order service could not be reached." 
            })
        }
        if (response.status === 404) return {
            personId, hasOrders: false 
        }
        if (!response.ok) {
            throw new OrderServiceUnavailableException({
                message: `The order service answered ${response.status}.` 
            })
        }
        let body: Partial<BuyerStatusResult>
        try {
            body = (await response.json()) as Partial<BuyerStatusResult>
        } catch {
            throw new OrderContractMismatchException({
            })
        }
        if (body.personId !== personId || typeof body.hasOrders !== "boolean") {
            throw new OrderContractMismatchException({
            })
        }
        return {
            personId: body.personId, hasOrders: body.hasOrders 
        }
    }
}
