import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./order-expiry-ticks.module-definition"
import { OrderExpiryTicksService } from "./order-expiry-ticks.service"

@Module({ providers: [OrderExpiryTicksService], exports: [OrderExpiryTicksService] })
/** The manual counterpart of the order app's recurring expiry scheduler. */
export class OrderExpiryTicksModule extends ConfigurableModuleClass {}
