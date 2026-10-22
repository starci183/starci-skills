import { PaymentEntity } from "./entities/payment.entity"
import { CreatePayments1789800004000 } from "./migrations/1789800004000-create-payments"

/** The entities of the payment capability, for the connection that holds them. */
export const paymentEntities = [PaymentEntity]

/** The migrations of the payment capability, in the order they run. */
export const paymentMigrations = [CreatePayments1789800004000]
