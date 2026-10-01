import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { IssueInvoiceRequest, IssueInvoiceResult } from "./issue-invoice.contracts"

/** Asks to invoice one placed order; the order-placed consumer sends it for every delivered event. */
export class IssueInvoiceCommand extends Command<IssueInvoiceResult> {
    constructor(readonly params: PublicExecuteParams<IssueInvoiceRequest>) {
        super()
    }
}
