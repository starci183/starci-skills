import { Module } from '@nestjs/common';
import { OrderApiClient } from './order.client';

@Module({
  providers: [OrderApiClient],
  exports: [OrderApiClient],
})
export class OrderModule {}
