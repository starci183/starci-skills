import { Module } from "@nestjs/common"
import { IssueInvoiceHandler } from "./application/issue-invoice.handler"
import { ConfigurableModuleClass } from "./invoicing.module-definition"

@Module({ providers: [IssueInvoiceHandler] })
/** The invoicing feature: the handler that invoices a placed order. */
export class InvoicingModule extends ConfigurableModuleClass {}
