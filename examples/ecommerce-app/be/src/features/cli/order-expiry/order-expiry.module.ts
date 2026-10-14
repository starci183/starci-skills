import { Module } from "@nestjs/common"
import { OrderExpiryCli } from "./order-expiry.cli"
import { TickCli } from "./subs/tick.cli"

@Module({ providers: [OrderExpiryCli, TickCli] })
/** The expiry command group; the app composes its domain capability. */
export class OrderExpiryModule {}
