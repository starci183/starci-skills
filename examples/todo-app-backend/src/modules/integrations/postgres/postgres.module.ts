import { Module } from '@nestjs/common';
import { ConfigModule } from '../../platform/config';
import { PostgresClient } from './postgres.client';

@Module({
  imports: [ConfigModule],
  providers: [PostgresClient],
  exports: [PostgresClient],
})
export class PostgresModule {}
