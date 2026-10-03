import { Module } from "@nestjs/common";
import { MigrateModule } from "./migrate/migrate.module";

@Module({ imports: [MigrateModule] })
/** The cli feature root of the upgraded app. */
export class CliModule {}
