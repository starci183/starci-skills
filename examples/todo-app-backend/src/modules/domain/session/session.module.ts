import { Module } from '@nestjs/common';
import { PostgresModule } from '../../integrations/postgres';
import { ConfigModule } from '../../platform/config';
import { SessionRepository } from './session.repository';

@Module({
  imports: [PostgresModule, ConfigModule],
  providers: [SessionRepository],
  exports: [SessionRepository],
})
export class SessionModule {}
