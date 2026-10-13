import { createAuthApolloClient, graphqlResponseOf } from "@ecommerce/api"
import type { GraphQLResponse, OperationParams } from "@ecommerce/api"
import { authClient } from "@/modules/auth"
import { orderGraphqlUrl } from "@/modules/config"
import { graphql } from "../__generated__"
import type { QueryOrderReceiptResponse, QueryOrderReceiptRequest } from "./types/order-receipt"

const query = graphql(`
    query OrderReceipt($input: OrderReceiptInput!) {
        orderReceipt(input: $input) {
            url
            expiresAt
        }
    }
`)

/** A download link of the receipt of one of the person's orders: a presigned URL of the private receipt archive that expires. A receipt the archive has not taken yet is refused with `ORDER_RECEIPT_NOT_READY`. */
export const queryOrderReceipt = async ({
    request,
    signal,
}: OperationParams<QueryOrderReceiptRequest>): Promise<GraphQLResponse<QueryOrderReceiptResponse>> =>
    graphqlResponseOf(
        await createAuthApolloClient({ uri: orderGraphqlUrl(), auth: authClient, signal }).query({
            query,
            variables: { input: request },
        }),
        (data) => data.orderReceipt,
    )
