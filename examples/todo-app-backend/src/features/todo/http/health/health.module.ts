import { DynamicModule, Module } from '@nestjs/common';
import { PostgresqlPrimaryModule } from '@modules/platform/databases/postgresql/primary';
import { ConfigurableModuleClass, OPTIONS_TYPE } from './health.module-definition';
import { HealthController } from './health.controller';

@Module({})
export class HealthModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    const base = super.register(options);
    return { ...base, imports: [PostgresqlPrimaryModule.register()], controllers: [HealthController] };
  }
}
