/** Fixture: receipt ports and intakes. Only a domain class whose constructor takes platform ports, one of them the Inbox, is a receipt port. */
import type { Inbox } from "@modules/platform/inbox/inbox.port"
import type { EntityManager } from "typeorm"
import { PaymentService } from "./payment.service"

/** A domain receipt port: its only dependency is the platform Inbox, so it records the delivery and processes nothing. */
export class PaymentReceiptService {
    constructor(private readonly inbox: Inbox) {}

    claim(manager: EntityManager, deliveryId: string): Promise<boolean> {
        return this.inbox.claim("payment", deliveryId, manager)
    }
}

/** Holds the Inbox and also a domain service, so a call on it may process the delivery. */
export class PaymentProcessingReceiptService {
    constructor(private readonly inbox: Inbox, private readonly payments: PaymentService) {}

    claim(manager: EntityManager, deliveryId: string): Promise<boolean> {
        return this.inbox.claim("payment", deliveryId, manager)
    }
}

/** A domain service with platform dependencies only, but no Inbox: it is not a receipt port. */
export class PaymentBookService {
    constructor(private readonly database: EntityManager) {}

    book(manager: EntityManager, deliveryId: string): Promise<boolean> {
        return manager.query(deliveryId).then(() => true)
    }
}

/** A subclass inherits dependencies its own constructor does not show, so it is not a receipt port. */
export class InheritedReceiptService extends PaymentProcessingReceiptService {
    constructor(inbox: Inbox, payments: PaymentService) {
        super(inbox, payments)
    }
}

/** The domain intakes a webhook door calls. */
export class PaymentIntakeService {
    constructor(
        private readonly database: EntityManager,
        private readonly receipts: PaymentReceiptService,
        private readonly processing: PaymentProcessingReceiptService,
        private readonly books: PaymentBookService,
        private readonly inherited: InheritedReceiptService,
    ) {}

    async throughReceiptPort(deliveryId: string): Promise<void> {
        await this.database.transaction(async (manager) => {
            if (!(await this.receipts.claim(manager, deliveryId))) return
        })
    }

    async throughProcessingReceipt(deliveryId: string): Promise<void> {
        await this.database.transaction(async (manager) => {
            if (!(await this.processing.claim(manager, deliveryId))) return
        })
    }

    async throughBookService(deliveryId: string): Promise<void> {
        await this.database.transaction(async (manager) => {
            if (!(await this.books.book(manager, deliveryId))) return
        })
    }

    async throughInheritedReceipt(deliveryId: string): Promise<void> {
        await this.database.transaction(async (manager) => {
            if (!(await this.inherited.claim(manager, deliveryId))) return
        })
    }
}
