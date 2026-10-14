import { Module } from "@nestjs/common";
import { cliModules } from "./compose/cli";
import { platformModules } from "./compose/platform";

@Module({
  imports: [
    ...platformModules(),
    ...cliModules(),
  ],
})
/** The cli composition root; database schema changes remain delegated to the Supabase CLI. */
export class AppModule {}
