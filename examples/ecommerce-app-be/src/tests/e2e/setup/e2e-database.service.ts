import { openTestDatabase } from "@tests/fixtures/database"
import type { TestDatabase } from "@tests/fixtures/database"
import {
    CART_ITEM_COUNT,
    DELETE_PERSON,
    LINES_OF_ORDER,
    ORDER_COUNT,
    ORDER_LINE_COUNT,
    ORDER_SUMMARY,
    ORDERS_OF_PERSON,
    PAYMENT_COUNT,
    PAYMENTS_OF_PERSON,
    PERSON_BY_ID,
    PING_DATABASE,
    PRODUCT_COUNT,
    PUBLIC_TABLES,
    STOCK_OF,
} from "@tests/fixtures/persistence/e2e-verification.sql"
import type { E2EStack } from "./e2e-stack.service"

/** A persisted person. */
export interface PersonRow {
    id: string
    email: string
}

/** The status and total of one persisted order. */
export interface OrderSummaryRow {
    status: string
    total_minor_units: number
}

/** A persisted order. */
export interface OrderRow extends OrderSummaryRow {
    id: string
    currency: string
    idempotency_key: string | null
}

/** One persisted order line with its price snapshot. */
export interface OrderLineRow {
    product_id: string
    quantity: number
    unit_price_minor_units: number
}

/** A persisted payment. */
export interface PaymentRow {
    id: string
    order_id: string
    status: string
    amount_minor_units: number
}

interface CountRow {
    count: number
}

/**
 * Out-of-band reads of the run persisted state, one connection per database (`identity`, `order`). The door for
 * asserting that a flow really persisted: it is never used to shortcut the flow under test.
 */
export class E2EDatabase {
    private constructor(
        private readonly identity: TestDatabase,
        private readonly order: TestDatabase,
    ) {}

    /** Opens both databases of the stack. */
    static async open(stack: E2EStack): Promise<E2EDatabase> {
        return new E2EDatabase(await openTestDatabase(stack.databaseUrl("identity")), await openTestDatabase(stack.databaseUrl("order")))
    }

    /** Closes both connections. */
    async close(): Promise<void> {
        await this.identity.close()
        await this.order.close()
    }

    /** Whether the order database answers. */
    async ping(): Promise<boolean> {
        const rows: Array<{ alive: number }> = await this.order.manager.query(PING_DATABASE, [])
        return rows[0]?.alive === 1
    }

    /** The tables the migrations created in both databases. */
    async tables(): Promise<Array<string>> {
        const identity: Array<{ table_name: string }> = await this.identity.manager.query(PUBLIC_TABLES, [])
        const order: Array<{ table_name: string }> = await this.order.manager.query(PUBLIC_TABLES, [])
        return [...identity, ...order].map((row) => row.table_name)
    }

    /** The persisted person with this id (zero or one row). */
    personById(personId: string): Promise<Array<PersonRow>> {
        return this.identity.manager.query(PERSON_BY_ID, [personId])
    }

    /** Removes a person out-of-band so a spec can guarantee its rows are gone without a delete door the product does not expose. */
    async deletePerson(personId: string): Promise<void> {
        await this.identity.manager.query(DELETE_PERSON, [personId])
    }

    /** The status and total of one order. */
    orderSummary(orderId: string): Promise<Array<OrderSummaryRow>> {
        return this.order.manager.query(ORDER_SUMMARY, [orderId])
    }

    /** How many lines one order has. */
    orderLineCount(orderId: string): Promise<number> {
        return this.count(ORDER_LINE_COUNT, orderId)
    }

    /** How many orders one person has. */
    orderCount(personId: string): Promise<number> {
        return this.count(ORDER_COUNT, personId)
    }

    /** The orders of one person in creation order. */
    ordersOfPerson(personId: string): Promise<Array<OrderRow>> {
        return this.order.manager.query(ORDERS_OF_PERSON, [personId])
    }

    /** The lines of one order with their price snapshot. */
    linesOfOrder(orderId: string): Promise<Array<OrderLineRow>> {
        return this.order.manager.query(LINES_OF_ORDER, [orderId])
    }

    /** How many cart lines one person holds. */
    cartItemCount(personId: string): Promise<number> {
        return this.count(CART_ITEM_COUNT, personId)
    }

    /** The payments of one person in capture order. */
    paymentsOfPerson(personId: string): Promise<Array<PaymentRow>> {
        return this.order.manager.query(PAYMENTS_OF_PERSON, [personId])
    }

    /** How many payments one person has. */
    paymentCount(personId: string): Promise<number> {
        return this.count(PAYMENT_COUNT, personId)
    }

    /** The stock of one product. */
    async stockOf(productId: string): Promise<number> {
        const rows: Array<{ stock: number }> = await this.order.manager.query(STOCK_OF, [productId])
        return rows[0]?.stock ?? 0
    }

    /** How many products the catalog holds. */
    async productCount(): Promise<number> {
        const rows: Array<CountRow> = await this.order.manager.query(PRODUCT_COUNT, [])
        return rows[0]?.count ?? 0
    }

    private async count(statement: typeof ORDER_COUNT, id: string): Promise<number> {
        const rows: Array<CountRow> = await this.order.manager.query(statement, [id])
        return rows[0]?.count ?? 0
    }
}
