import { Module } from '@nestjs/common';
import { CartModule } from '../../modules/bussiness/cart';
import { CatalogModule } from '../../modules/bussiness/catalog';
import { OrderModule } from '../../modules/bussiness/order';
import { PaymentModule } from '../../modules/bussiness/payment';
import { IdentityModule } from '../../modules/integrations/identity';
import { PostgresqlPrimaryModule } from '../../modules/platform/databases/postgresql/primary';
import { CartController } from './transport/http/cart.controller';
import { OrderController } from './transport/http/order.controller';
import { BuyerController } from './transport/http/buyer.controller';
import { HealthController } from './transport/http/health.controller';
import { SessionGuard } from './transport/http/session.guard';

/**
 * The checkout feature of apps/order: the HTTP transport for cart, confirmation and the buyer
 * surface, with the session guard in front of every person-scoped door. Capability modules own
 * the behavior; this module only wires.
 */
@Module({
  imports: [
    PostgresqlPrimaryModule,
    CatalogModule,
    CartModule,
    IdentityModule,
    PaymentModule,
    OrderModule,
  ],
  controllers: [CartController, OrderController, BuyerController, HealthController],
  providers: [SessionGuard],
})
export class CheckoutModule {}
