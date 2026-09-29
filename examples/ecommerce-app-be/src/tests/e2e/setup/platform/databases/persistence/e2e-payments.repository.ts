import {
    Injectable
} from "@nestjs/common"
import {
    E2EDbService
} from "../e2e-db.service"

/** A persisted payment as the payment table holds it. */
export interface E2EPaymentRow {
  id: string;
  order_id: string;
  status: string;
  amount_minor_units: number;
  idempotency_key: string;
}

/** The status and amount of one persisted payment. */
export interface E2EPaymentSummaryRow {
  status: string;
  amount_minor_units: number;
}

/** A `count(*)::int` answer. */
interface CountRow {
  count: number;
}

@Injectable()
/** Out-of-band reads of the order service's persisted payments. */
export class E2EPaymentsRepository {
    constructor(private readonly db: E2EDbService) {}

    paymentSummariesForPerson(personId: string): Promise<Array<E2EPaymentSummaryRow>> {
        return this.db.query<E2EPaymentSummaryRow>("SELECT status, amount_minor_units FROM payment WHERE person_id = $1",
            [personId])
    }

    paymentsForPerson(personId: string): Promise<Array<E2EPaymentRow>> {
        return this.db.query<E2EPaymentRow>(
            "SELECT id, order_id, status, amount_minor_units, idempotency_key FROM payment WHERE person_id = $1 ORDER BY created_at, id",
            [personId],
        )
    }

    async paymentCountForPerson(personId: string): Promise<number> {
        const rows = await this.db.query<CountRow>("SELECT COUNT(*)::int AS count FROM payment WHERE person_id = $1",
            [personId])
        return rows[0].count
    }
}
