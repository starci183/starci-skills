import { Module } from "@nestjs/common"
import { IssueInvoiceHandler } from "./application/issue-invoice.handler"

@Module({ providers: [IssueInvoiceHandler] })
/** The invoicing feature: the handler that invoices a placed order. */
export class InvoicingModule {}
