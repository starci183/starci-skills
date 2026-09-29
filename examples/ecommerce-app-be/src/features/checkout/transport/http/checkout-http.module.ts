import {
    Module
} from "@nestjs/common"
import {
    BuyerStatusUseCase
} from "../../application/buyer-status.use-case"
import {
    BuyerController
} from "./buyer.controller"
import {
    HealthController
} from "./health.controller"

@Module({
    controllers: [BuyerController,
        HealthController],
    providers: [BuyerStatusUseCase],
})
/** The HTTP transport of the checkout feature: the internal buyer door and the /health probe. */
export class CheckoutHttpModule {}
