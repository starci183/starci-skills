import { Module } from "@nestjs/common"
import { MigrateModule } from "./migrate/migrate.module"
import { SeedModule } from "./seed/seed.module"

@Module({ imports: [MigrateModule, SeedModule] })
/** The cli feature root: every command group of the back end, compiled only into apps/cli. */
export class CliModule {}
