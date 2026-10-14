import { Module } from "@nestjs/common"
import { MigrateModule } from "./migrate/migrate.module"
import { OrderExpiryModule } from "./order-expiry/order-expiry.module"

@Module({ imports: [MigrateModule, OrderExpiryModule] })
/** The cli feature root: every command group of the back end, compiled only into apps/cli. */
export class CliModule {}
