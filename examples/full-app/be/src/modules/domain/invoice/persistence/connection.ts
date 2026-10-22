import { InvoiceEntity } from "./entities/invoice.entity"
import { CreateInvoices1789800006000 } from "./migrations/1789800006000-create-invoices"

/** The entities of the invoice capability, for the connection that holds them. */
export const invoiceEntities = [InvoiceEntity]

/** The migrations of the invoice capability, in the order they run. */
export const invoiceMigrations = [CreateInvoices1789800006000]
