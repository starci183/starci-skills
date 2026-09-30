import { Injectable } from "@nestjs/common"
import { callGraphql, InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { isRecord } from "@modules/platform/primitives"
import { OrderApiError, OrderApiErrorCode } from "./errors/order-api.error"
import { InjectOrderApiOptions } from "./order-api.decorators"
import type { OrderApiOptions } from "./order-api.options"

const BUYER_STATUS_QUERY = "query BuyerStatus { buyerStatus { personId hasOrders } }"

/** Whether the caller of the order service is a buyer. */
export interface OrderApiBuyerStatus {
    /** The person the bearer token authenticates. */
    readonly personId: string
    /** True when the person has confirmed orders. */
    readonly hasOrders: boolean
}

@Injectable()
/** The identity service view of the order service: it asks the order GraphQL door whether the bearer of a token is a buyer. */
export class OrderApiClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectOrderApiOptions() private readonly options: OrderApiOptions,
    ) {}

    /** The buyer status of the person `sessionToken` authenticates, read live from the order service. */
    async getBuyerStatus(sessionToken: string): Promise<OrderApiBuyerStatus> {
        try {
            const answer = await callGraphql(this.http, {
                url: `${this.options.url}/graphql`,
                query: BUYER_STATUS_QUERY,
                headers: { authorization: `Bearer ${sessionToken}` },
                timeoutMs: this.options.timeoutMs,
            })
            const status = answer?.data?.buyerStatus
            if (answer && answer.errorCodes.length > 0) {
                throw new OrderApiError({ code: OrderApiErrorCode.Unavailable, params: { reason: answer.errorCodes.join(",") } })
            }
            if (!isRecord(status) || typeof status.personId !== "string" || typeof status.hasOrders !== "boolean") {
                throw new OrderApiError({ code: OrderApiErrorCode.ContractMismatch })
            }
            return { personId: status.personId, hasOrders: status.hasOrders }
        } catch (cause) {
            throw cause instanceof OrderApiError ? cause : new OrderApiError({ code: OrderApiErrorCode.Unavailable, cause })
        }
    }
}
