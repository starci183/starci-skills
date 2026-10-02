import { Module } from "@nestjs/common"
import { StoreReceiptStep } from "./steps/store-receipt.step"

@Module({ providers: [StoreReceiptStep], exports: [StoreReceiptStep] })
/** The application of the send-receipt job: its step; the queue transport module imports it. */
export class SendReceiptModule {}
