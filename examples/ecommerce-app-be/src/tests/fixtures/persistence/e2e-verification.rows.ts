/** A persisted person. */
export interface PersonRow {
    /** The person id. */
    id: string
    /** The email the person registered with. */
    email: string
}

/** The status and total of one persisted order. */
export interface OrderSummaryRow {
    /** The lifecycle state. */
    status: string
    /** The order total in minor units. */
    total_minor_units: number
}

/** A persisted order. */
export interface OrderRow extends OrderSummaryRow {
    /** The order id. */
    id: string
    /** The currency. */
    currency: string
    /** The replay key the confirmation carried, when it had one. */
    idempotency_key: string | null
}

/** One persisted order line with its price snapshot. */
export interface OrderLineRow {
    /** The SKU. */
    product_id: string
    /** How many units. */
    quantity: number
    /** The unit price captured at confirmation. */
    unit_price_minor_units: number
}

/** A persisted payment. */
export interface PaymentRow {
    /** The payment id. */
    id: string
    /** The order the payment settles. */
    order_id: string
    /** The ledger state. */
    status: string
    /** The captured amount in minor units. */
    amount_minor_units: number
}

/** A count answered by an aggregate read. */
export interface CountRow {
    /** The number of rows. */
    count: number
}

/** The stock of one product. */
export interface StockRow {
    /** The units still on sale. */
    stock: number
}

/** The name of one table of the public schema. */
export interface TableRow {
    /** The table name. */
    table_name: string
}
