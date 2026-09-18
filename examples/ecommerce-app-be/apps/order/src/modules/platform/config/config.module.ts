import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';

/** Static module in the house shape (see apps/identity's config.module.ts for the reasoning). */
@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class ConfigModule {}
