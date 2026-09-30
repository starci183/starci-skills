import { ORDER_CONNECTION } from "@modules/platform/database"
import { PaymentEntity } from "./entities/payment.entity"
import { CreatePayments1789800004000 } from "./migrations/1789800004000-create-payments"

/** The connection whose database holds the tables of the payment capability. */
export const CONNECTION = ORDER_CONNECTION

/** The entities of the payment capability, for the connection that holds them. */
export const paymentEntities = [PaymentEntity]

/** The migrations of the payment capability, in the order they run. */
export const paymentMigrations = [CreatePayments1789800004000]
