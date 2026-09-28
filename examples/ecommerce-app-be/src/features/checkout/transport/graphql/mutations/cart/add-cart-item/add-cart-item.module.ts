import {
    Module 
} from "@nestjs/common"
import {
    ConfigurableModuleClass 
} from "./add-cart-item.module-definition"
import {
    AddCartItemResolver 
} from "./add-cart-item.resolver"
import {
    SessionGuard 
} from "../../../session.guard"

/** Module for the add-cart-item mutation. Import-free on purpose: CartService and the identity
 * integration client the guard calls resolve app-wide from the composition root's global
 * registrations; SessionGuard is this module's own door wiring. */
@Module({
    providers: [AddCartItemResolver,
        SessionGuard],
})
/** add-cart-item's module: mounts AddCartItemResolver behind the session guard; the cart capability is composed at the app root, not imported here. */
export class AddCartItemSingleMutationModule extends ConfigurableModuleClass {}
