import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { AppConfigService } from '../../../config';
import { POSTGRESQL_PRIMARY } from './constants/connection';
import { PostgresPrimaryClient } from './primary.client';
import { CartItemEntity, OrderEntity, OrderLineEntity, PaymentEntity, ProductEntity } from './entities';

/**
 * The one platform database module (house shape, see apps/identity's), owning the order service's
 * tables - product, cart_item, sales_order, sales_order_line, payment - in the same dev Postgres
 * database as the identity service's schema (they are disjoint; integration.checkout.postgres).
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: POSTGRESQL_PRIMARY,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        type: 'postgres' as const,
        url: config.getDatabaseUrl(),
        entities: [ProductEntity, CartItemEntity, OrderEntity, OrderLineEntity, PaymentEntity],
        migrations: [join(__dirname, 'migrations', '*.{js,ts}')],
        migrationsRun: true,
        synchronize: false,
        retryAttempts: 2,
      }),
    }),
  ],
  providers: [PostgresPrimaryClient],
  exports: [PostgresPrimaryClient],
})
export class PostgresqlPrimaryModule {}
