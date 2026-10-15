import { Module } from "@nestjs/common";
import { ConfigurableModuleClass } from "./cli.module-definition";
import { MigrateModule } from "./migrate/migrate.module";

@Module({ imports: [MigrateModule.register({})] })
/** The cli feature root of the upgraded app. */
export class CliModule extends ConfigurableModuleClass {}
