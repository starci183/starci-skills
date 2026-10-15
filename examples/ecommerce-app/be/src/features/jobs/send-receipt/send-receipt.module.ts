import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./send-receipt.module-definition"
import { StoreReceiptStep } from "./steps/store-receipt.step"

@Module({ providers: [StoreReceiptStep], exports: [StoreReceiptStep] })
/** The application of the send-receipt job: its step; the queue transport module imports it. */
export class SendReceiptModule extends ConfigurableModuleClass {}
