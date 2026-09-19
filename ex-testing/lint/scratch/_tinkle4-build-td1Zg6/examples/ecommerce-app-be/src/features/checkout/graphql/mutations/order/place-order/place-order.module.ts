import {
    Module 
} from "@nestjs/common"
import {
    ConfigurableModuleClass 
} from "./place-order.module-definition"
import {
    PlaceOrderResolver 
} from "./place-order.resolver"
import {
    SessionGuard 
} from "../../../session.guard"

/** Module for the place-order mutation. Import-free on purpose: OrderService and the identity
 * integration client the guard calls resolve app-wide from the composition root's global
 * registrations; SessionGuard is this module's own door wiring. */
@Module({
    providers: [PlaceOrderResolver,
        SessionGuard],
})
/** place-order's module: mounts PlaceOrderResolver behind the session guard; the order capability is composed at the app root, not imported here. */
export class PlaceOrderSingleMutationModule extends ConfigurableModuleClass {}
