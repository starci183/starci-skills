import { Module } from "@nestjs/common"
import { ReceiptQueue } from "./receipt.queue"

@Module({ providers: [ReceiptQueue], exports: [ReceiptQueue] })
/** The receipt queue: its typed producer, imported by the domain module whose service enqueues. */
export class ReceiptModule {}
