import type { DynamicModule } from "@nestjs/common"
import { IdentityModule } from "@modules/domain/identity"
import { InvoiceModule } from "@modules/domain/invoice"
import { PaymentModule } from "@modules/domain/payment"
import { IDENTITY_API } from "@modules/integrations/identity-api"
import type { BillingAppOptions } from "../billing.options"

/** The invoice and payment capabilities with the identity verifier. */
export const invoicingModules = (options: BillingAppOptions): Array<DynamicModule> => [
    InvoiceModule.register({ isGlobal: true, ...options.invoice }),
    PaymentModule.register({ isGlobal: true }),
    IdentityModule.register({ isGlobal: true, verifier: IDENTITY_API }),
]
