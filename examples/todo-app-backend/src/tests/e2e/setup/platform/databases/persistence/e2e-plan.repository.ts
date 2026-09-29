import {
    Injectable
} from "@nestjs/common"
import {
    E2EDbService
} from "../e2e-db.service"

/** The `PaymentIntentRow` shape the out-of-band read returns, column names as the table spells them. */
export interface PaymentIntentRow {
  id: string;
  subscription_id: string;
  gateway_intent_id: string;
  status: string;
}
/** The `SubscriptionRow` shape the out-of-band read returns, column names as the table spells them. */
export interface SubscriptionRow {
  id: string;
  status: string;
}

@Injectable()
/** Out-of-band reads over subscriptions and payment intents, plus the seeded stand-ins for the gateway. */
export class E2EPlanRepository {
    constructor(private readonly db: E2EDbService) {}

    async subscriptionsOf(personId: string): Promise<Array<SubscriptionRow>> {
        return this.db.query<SubscriptionRow>("select id, status from subscriptions where person_id = $1",
            [personId])
    }

    async intentById(id: string): Promise<Array<PaymentIntentRow>> {
        return this.db.query<PaymentIntentRow>(
            "select id, subscription_id, gateway_intent_id, status from payment_intents where id = $1",
            [id],
        )
    }

    async intentsOfPerson(personId: string): Promise<Array<PaymentIntentRow>> {
        return this.db.query<PaymentIntentRow>(
            `select pi.id, pi.subscription_id, pi.gateway_intent_id, pi.status
               from payment_intents pi join subscriptions s on s.id = pi.subscription_id
               where s.person_id = $1`,
            [personId],
        )
    }

    /** Stands in for t-gateway-confirmed: the row exactly as ConfirmPaymentHandler would have written it. */
    async activatePaid(personId: string, periodEnd: Date): Promise<void> {
        await this.db.query("update subscriptions set status = 'active', plan = 'paid', period_end = $2 where person_id = $1",
            [personId,
                periodEnd])
    }

    /** Seeds the pending subscription a completed create-intent would have left. */
    async seedPendingSubscription(id: string, personId: string): Promise<void> {
        await this.db.query(
            `insert into subscriptions (id, person_id, plan, status, period_end, gateway_customer_id)
               values ($1, $2, 'free', 'pending', null, null)
               on conflict (person_id) do update set status = 'pending'`,
            [id,
                personId],
        )
    }

    async seedPendingIntent(id: string, subscriptionId: string, gatewayIntentId: string): Promise<void> {
        await this.db.query(
            `insert into payment_intents (id, subscription_id, gateway, gateway_intent_id, amount, currency, status, applied_at)
               values ($1, $2, 'sepay', $3, 99000, 'VND', 'pending', null)`,
            [id,
                subscriptionId,
                gatewayIntentId],
        )
    }
}
