import { Global, Module } from '@nestjs/common';
import { RedisPrimaryClient } from './redis.client';

/** Static class-token registration, house shape (see config.module.ts's note). */
@Global()
@Module({
  providers: [RedisPrimaryClient],
  exports: [RedisPrimaryClient],
})
export class RedisPrimaryModule {}
