import {
    Module 
} from "@nestjs/common"
import {
    ConfigModule 
} from "@modules/platform/config/order/config.module"
import {
    PostgresqlPrimaryModule 
} from "@modules/platform/databases/postgresql/order/primary.module"
import {
    CatalogModule 
} from "@modules/bussiness/catalog/catalog.module"
import {
    CartModule 
} from "@modules/bussiness/cart/cart.module"
import {
    OrderModule 
} from "@modules/bussiness/order/order.module"
import {
    PaymentModule 
} from "@modules/bussiness/payment/payment.module"
import {
    IdentityModule 
} from "@modules/integrations/identity/identity.module"
import {
    CheckoutModule 
} from "@features/checkout/checkout.module"
import {
    CheckoutGraphqlModule 
} from "@features/checkout/graphql/graphql.module"

@Module({
    imports: [
        ConfigModule.register({
            isGlobal: true 
        }),
        PostgresqlPrimaryModule.register({
            isGlobal: true 
        }),
        CatalogModule.register({
            isGlobal: true 
        }),
        CartModule.register({
            isGlobal: true 
        }),
        IdentityModule.register({
            isGlobal: true 
        }),
        PaymentModule.register({
            isGlobal: true 
        }),
        OrderModule.register({
            isGlobal: true 
        }),
        CheckoutModule,
        CheckoutGraphqlModule,
    ],
})
/**
 * Composition only, in nivo's monorepo shape (sibling of apps/identity): the order service's
 * root module wires the platform database, the four capability modules (catalog, cart, order,
 * payment), the HTTP client that verifies sessions against the identity service (the consumer
 * half of the order<->identity pair), the checkout feature's justified HTTP doors and the
 * canonical GraphQL transport for the user-facing API (features/checkout/graphql). Every
 * capability and platform module is registered `isGlobal: true` HERE - whether a capability is app-wide is a
 * fact about this application, so the root declares it and the modules never declare it about
 * themselves. That is what lets the checkout feature mount its doors and its guard without
 * importing a single capability.
 */
export class AppModule {}
