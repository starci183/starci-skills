import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresModule, SessionEntity } from '../../integrations/postgres';
import { ConfigModule } from '../../platform/config';
import { SessionRepository } from './session.repository';

@Module({
  imports: [PostgresModule, TypeOrmModule.forFeature([SessionEntity]), ConfigModule],
  providers: [SessionRepository],
  exports: [SessionRepository],
})
export class SessionModule {}
