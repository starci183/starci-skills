import {
    Injectable
} from "@nestjs/common"
import {
    E2EDbService
} from "../e2e-db.service"

/** A persisted order as the sales_order table holds it. */
export interface E2EOrderRow {
  id: string;
  status: string;
  total_minor_units: number;
  currency: string;
  idempotency_key: string | null;
}

/** The status and captured total of one persisted order. */
export interface E2EOrderSummaryRow {
  status: string;
  total_minor_units: number;
}

/** The status of one persisted order. */
export interface E2EOrderStatusRow {
  status: string;
}

/** One persisted order line with its price snapshot. */
export interface E2EOrderLineRow {
  product_id: string;
  quantity: number;
  unit_price_minor_units: number;
}

/** A `count(*)::int` answer. */
interface CountRow {
  count: number;
}

@Injectable()
/** Out-of-band reads of the order service's persisted state: orders, order lines and carts. */
export class E2EOrdersRepository {
    constructor(private readonly db: E2EDbService) {}

    orderSummaryById(orderId: string): Promise<Array<E2EOrderSummaryRow>> {
        return this.db.query<E2EOrderSummaryRow>("SELECT status, total_minor_units FROM sales_order WHERE id = $1",
            [orderId])
    }

    async orderLineCount(orderId: string): Promise<number> {
        const rows = await this.db.query<CountRow>("SELECT COUNT(*)::int AS count FROM sales_order_line WHERE order_id = $1",
            [orderId])
        return rows[0].count
    }

    async orderCountForPerson(personId: string): Promise<number> {
        const rows = await this.db.query<CountRow>("SELECT COUNT(*)::int AS count FROM sales_order WHERE person_id = $1",
            [personId])
        return rows[0].count
    }

    orderStatusesForPerson(personId: string): Promise<Array<E2EOrderStatusRow>> {
        return this.db.query<E2EOrderStatusRow>("SELECT status FROM sales_order WHERE person_id = $1",
            [personId])
    }

    ordersForPerson(personId: string): Promise<Array<E2EOrderRow>> {
        return this.db.query<E2EOrderRow>(
            "SELECT id, status, total_minor_units, currency, idempotency_key FROM sales_order WHERE person_id = $1 ORDER BY created_at, id",
            [personId],
        )
    }

    linesForOrder(orderId: string): Promise<Array<E2EOrderLineRow>> {
        return this.db.query<E2EOrderLineRow>(
            "SELECT product_id, quantity, unit_price_minor_units FROM sales_order_line WHERE order_id = $1 ORDER BY product_id",
            [orderId],
        )
    }

    async cartItemCount(personId: string): Promise<number> {
        const rows = await this.db.query<CountRow>("SELECT COUNT(*)::int AS count FROM cart_item WHERE person_id = $1",
            [personId])
        return rows[0].count
    }
}
