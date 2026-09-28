import {
    Module 
} from "@nestjs/common"
import {
    ConfigurableModuleClass 
} from "./cart.module-definition"
import {
    CartResolver 
} from "./cart.resolver"
import {
    SessionGuard 
} from "../../../session.guard"

/** Module for the cart query. Import-free on purpose: CartService, CatalogService and the
 * identity integration client the guard calls all resolve app-wide from the composition
 * root's global registrations; SessionGuard is this module's own door wiring. */
@Module({
    providers: [CartResolver,
        SessionGuard],
})
/** cart's module: mounts CartResolver behind the session guard; the cart and catalog capabilities are composed at the app root, not imported here. */
export class CartSingleQueryModule extends ConfigurableModuleClass {}
