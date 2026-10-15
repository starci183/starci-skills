import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./cli.module-definition"
import { MigrateModule } from "./migrate/migrate.module"
import { OrderExpiryModule } from "./order-expiry/order-expiry.module"

@Module({ imports: [MigrateModule.register({}), OrderExpiryModule.register({})] })
/** The cli feature root: every command group of the back end, compiled only into apps/cli. */
export class CliModule extends ConfigurableModuleClass {}
