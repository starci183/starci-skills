import type { EntityManager } from "typeorm"
import type { sql } from "@modules/platform/database"
import { STOCK_OF } from "./e2e-verification.sql"

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

/** A persisted payment of the billing database: one confirmed bank transfer. */
export interface BillingPaymentRow {
    /** The order the payment settles. */
    order_id: string
    /** The transferred amount in minor units. */
    amount_minor_units: number
    /** The bank reference of the transfer. */
    provider_reference: string
}

/** One row of the order-summary read model, as the verification statements read it. */
export interface OrderSummaryProjectionRow {
    /** The order. */
    order_id: string
    /** The lifecycle state. */
    status: string
    /** The order total in minor units. */
    total_minor_units: number
    /** How many lines the order has. */
    line_count: number
    /** The loyalty points the order earned. */
    loyalty_points: number
}

/** The loyalty points of one order. */
export interface PointsRow {
    /** The points the order earned; zero when nothing was granted. */
    points: number
}

/** A persisted invoice of the billing database. */
export interface InvoiceRow {
    /** The order the invoice bills. */
    order_id: string
    /** The invoice state. */
    status: string
    /** The billed amount in minor units. */
    total_minor_units: number
}

/** The persisted state of one saga run of the order database. */
export interface SagaStateRow {
    /** Where the run stands. */
    status: string
    /** The fence of the run. */
    version: number
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

/** One verification statement and the shape of the rows it answers. */
export interface RowQuery<TRow> {
    /** The SQL text, built with the `sql` tag. */
    readonly text: ReturnType<typeof sql>
    /** Type-level only: the row shape the statement answers; it is never set. */
    readonly rowShape?: TRow
}

/** Runs a read of the verification statements and answers its rows. */
export const readRows = <TRow>(
    manager: EntityManager,
    query: RowQuery<TRow>,
    params: ReadonlyArray<string | number>,
): Promise<Array<TRow>> => manager.query(query.text, [...params])

/** The count a verification statement answers for one id. */
export const readCount = async (manager: EntityManager, query: RowQuery<CountRow>, id?: string): Promise<number> => {
    const rows = await readRows(manager, query, id === undefined ? [] : [id])
    return rows[0]?.count ?? 0
}

/** The stock of one product of the order database; zero when the SKU is unknown. */
export const readStock = async (manager: EntityManager, productId: string): Promise<number> => {
    const rows = await readRows(manager, STOCK_OF, [productId])
    return rows[0]?.stock ?? 0
}
