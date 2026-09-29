import {
    Module
} from "@nestjs/common"
import {
    RevokeSessionUseCase
} from "../../application/revoke-session.use-case"
import {
    VerifySessionUseCase
} from "../../application/verify-session.use-case"
import {
    HealthController
} from "./health.controller"
import {
    SessionController
} from "./session.controller"

/** The HTTP transport of the identity feature: the internal session doors and the /health probe. */
@Module({
    controllers: [SessionController,
        HealthController],
    providers: [VerifySessionUseCase,
        RevokeSessionUseCase],
})
export class IdentityHttpModule {}
