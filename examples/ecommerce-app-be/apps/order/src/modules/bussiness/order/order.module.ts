import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CartItemEntity,
  OrderEntity,
  OrderLineEntity,
  PaymentEntity,
  POSTGRESQL_PRIMARY,
  ProductEntity,
} from '../../platform/databases/postgresql/primary';
import { CatalogModule } from '../catalog';
import { CartModule } from '../cart';
import { PaymentModule } from '../payment';
import { CheckoutPolicy } from './checkout.policy';
import { OrderService } from './order.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductEntity, CartItemEntity, OrderEntity, OrderLineEntity, PaymentEntity], POSTGRESQL_PRIMARY),
    CatalogModule,
    CartModule,
    PaymentModule,
  ],
  providers: [OrderService, CheckoutPolicy],
  exports: [OrderService],
})
export class OrderModule {}
