import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';

/**
 * Static module in the house shape: the class token is the provider and the export (the identity
 * check architecture.json declares), and it is @Global because AppConfigService is genuinely
 * app-wide - the database, the cache and every HTTP client resolve their binding through it, and
 * every port and URL they need is read from metadata.json rather than restated as a literal.
 */
@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class ConfigModule {}
