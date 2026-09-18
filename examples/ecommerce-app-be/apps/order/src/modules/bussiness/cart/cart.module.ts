import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartItemEntity, POSTGRESQL_PRIMARY } from '../../platform/databases/postgresql/primary';
import { CartService } from './cart.service';

@Module({
  imports: [TypeOrmModule.forFeature([CartItemEntity], POSTGRESQL_PRIMARY)],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
