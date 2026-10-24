import { Module } from "@nestjs/common"
import { CheckoutModule } from "../../checkout.module"
import { ConfigurableModuleClass } from "./checkout-http.module-definition"
import { OperationsController } from "./operations.controller"

@Module({ imports: [CheckoutModule.register({})], controllers: [OperationsController] })
/** The HTTP transport of the checkout feature: the versioned operation route. */
export class CheckoutHttpModule extends ConfigurableModuleClass {}
