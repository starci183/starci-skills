import "reflect-metadata"
import {
    NestFactory 
} from "@nestjs/core"
import {
    AppConfigService 
} from "@modules/platform/config/index"
import {
    runPrimaryMigrations 
} from "@modules/platform/databases/index"
import {
    LogEvent, WinstonService 
} from "@modules/platform/logging/index"
import {
    AppModule 
} from "./app.module"

/** Applies the pending migrations once and exits; api and worker apps start only after this has finished. */
async function bootstrap(): Promise<void> {
    const context = await NestFactory.createApplicationContext(AppModule)
    try {
        const applied = await runPrimaryMigrations(context.get(AppConfigService).getDatabaseUrl())
        context.get(WinstonService).log(LogEvent.MigrationsApplied,
            {
                applied 
            })
    } finally {
        await context.close()
    }
}

void bootstrap()
