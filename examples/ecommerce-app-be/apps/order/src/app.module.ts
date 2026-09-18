import { Module } from '@nestjs/common';
import { ConfigModule } from './modules/platform/config';
import { PostgresqlPrimaryModule } from './modules/platform/databases/postgresql/primary';
import { CatalogModule } from './modules/bussiness/catalog';
import { CartModule } from './modules/bussiness/cart';
import { OrderModule } from './modules/bussiness/order';
import { PaymentModule } from './modules/bussiness/payment';
import { IdentityModule } from './modules/integrations/identity';
import { CheckoutModule } from './features/checkout/checkout.module';

/**
 * Composition only, in nivo's monorepo shape (sibling of apps/identity): the order service's root
 * module wires the platform database, the four capability modules (catalog, cart, order, payment),
 * the HTTP client that verifies sessions against the identity service (the consumer half of the
 * order<->identity pair) and the checkout feature's transport.
 */
@Module({
  imports: [
    ConfigModule,
    PostgresqlPrimaryModule,
    CatalogModule,
    CartModule,
    IdentityModule,
    PaymentModule,
    OrderModule,
    CheckoutModule,
  ],
})
export class AppModule {}
