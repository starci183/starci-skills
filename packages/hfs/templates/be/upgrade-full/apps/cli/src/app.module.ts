import { Module } from "@nestjs/common";
import { CliModule } from "@features/cli";
import { ClockModule } from "@modules/platform/clock";
import { LoggingModule } from "@modules/platform/logging";

@Module({
  imports: [
    ClockModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    CliModule,
  ],
})
/** The cli composition root; database schema changes remain delegated to the Supabase CLI. */
export class AppModule {}
