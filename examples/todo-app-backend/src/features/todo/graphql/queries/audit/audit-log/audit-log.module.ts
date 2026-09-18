import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './audit-log.module-definition';
import { AuditLogResolver } from './audit-log.resolver';

@Module({
  imports: [CqrsModule],
  providers: [AuditLogResolver],
})
export class AuditLogSingleQueryModule extends ConfigurableModuleClass {}
