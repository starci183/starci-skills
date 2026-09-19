import {
    Module 
} from "@nestjs/common"
import {
    ConfigurableModuleClass 
} from "./clear-cart.module-definition"
import {
    ClearCartResolver 
} from "./clear-cart.resolver"
import {
    SessionGuard 
} from "../../../session.guard"

/** Module for the clear-cart mutation. Import-free on purpose: CartService and the identity
 * integration client the guard calls resolve app-wide from the composition root's global
 * registrations; SessionGuard is this module's own door wiring. */
@Module({
    providers: [ClearCartResolver,
        SessionGuard],
})
/** clear-cart's module: mounts ClearCartResolver behind the session guard; the cart capability is composed at the app root, not imported here. */
export class ClearCartSingleMutationModule extends ConfigurableModuleClass {}
