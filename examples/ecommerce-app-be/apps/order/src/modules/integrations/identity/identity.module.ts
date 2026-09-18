import { Module } from '@nestjs/common';
import { IdentityApiClient } from './identity.client';

@Module({
  providers: [IdentityApiClient],
  exports: [IdentityApiClient],
})
export class IdentityModule {}
