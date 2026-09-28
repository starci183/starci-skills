import {
    Module 
} from "@nestjs/common"
import {
    ConfigModule 
} from "ecommerce-app-be/modules/platform/config/order"
import {
    PostgresqlPrimaryModule 
} from "ecommerce-app-be/modules/platform/databases/postgresql/order"
import {
    CatalogModule 
} from "ecommerce-app-be/modules/domain/catalog"
import {
    CartModule 
} from "ecommerce-app-be/modules/domain/cart"
import {
    OrderModule 
} from "ecommerce-app-be/modules/domain/order"
import {
    PaymentModule 
} from "ecommerce-app-be/modules/domain/payment"
import {
    IdentityModule 
} from "ecommerce-app-be/modules/integrations/identity"
import {
    CheckoutModule 
} from "ecommerce-app-be/features/checkout"
import {
    CheckoutGraphqlModule 
} from "ecommerce-app-be/features/checkout"

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
 * canonical GraphQL transport for the user-facing API (features/checkout/transport/graphql). Every
 * capability and platform module is registered `isGlobal: true` HERE - whether a capability is app-wide is a
 * fact about this application, so the root declares it and the modules never declare it about
 * themselves. That is what lets the checkout feature mount its doors and its guard without
 * importing a single capability.
 */
export class AppModule {}
