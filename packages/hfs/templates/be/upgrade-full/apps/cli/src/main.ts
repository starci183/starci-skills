import "reflect-metadata";
import { CommandFactory } from "nest-commander";
import { SystemClockService } from "@modules/platform/clock";
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging";
import { AppModule } from "./app.module";

/** The one-off command app. Its migrate command delegates schema authority to the Supabase CLI. */
async function bootstrap(): Promise<void> {
  const logger = createJsonLogger(new SystemClockService());
  await CommandFactory.run(AppModule, {
    logger: false,
    errorHandler: (error: Error) => {
      logger.error(LoggingLogEvent.StartupFailed, error, { service: "cli" });
      process.exit(1);
    },
  });
}

bootstrap().catch((error: unknown) => {
  createJsonLogger(new SystemClockService()).error(
    LoggingLogEvent.StartupFailed,
    error,
    { service: "cli" },
  );
  process.exit(1);
});
