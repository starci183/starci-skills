/** The GraphQL documents the identity service sends to the order service, checked against its published schema by the contract layer. */
export const ORDER_API_DOCUMENTS = {
    buyerStatus: "query BuyerStatus { buyerStatus { personId hasOrders } }",
} as const
