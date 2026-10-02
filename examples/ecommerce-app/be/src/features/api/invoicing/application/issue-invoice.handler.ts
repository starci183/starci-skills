import { CommandHandler } from "@nestjs/cqrs"
import { InvoiceService } from "@modules/domain/invoice"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { IssueInvoiceResult } from "./issue-invoice.contracts"
import { IssueInvoiceCommand } from "./issue-invoice.command"

@CommandHandler(IssueInvoiceCommand)
/** Invoices one placed order; the invoice service claims the event, decides the limit and announces a rejection. */
export class IssueInvoiceHandler extends ICQRSHandler<IssueInvoiceCommand, IssueInvoiceResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invoices: InvoiceService,
    ) {
        super(logger)
    }

    protected override process(command: IssueInvoiceCommand): Promise<IssueInvoiceResult> {
        return this.invoices.issue(command.params.request)
    }
}
