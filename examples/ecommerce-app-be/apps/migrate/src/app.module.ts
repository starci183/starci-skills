import {
    Module 
} from "@nestjs/common"
import {
    ClockModule 
} from "ecommerce-app-be/modules/platform/clock"
import {
    IdentityConfigModule, OrderConfigModule 
} from "ecommerce-app-be/modules/platform/config"
import {
    LoggingModule 
} from "ecommerce-app-be/modules/platform/logging"

@Module({
    imports: [
        ClockModule.register({
            isGlobal: true 
        }),
        LoggingModule,
        IdentityConfigModule.register(),
        OrderConfigModule.register(),
    ],
})
/** Composition root of the migrate app: the clock and logger it reports through and the configuration of both services whose databases it migrates. */
export class AppModule {}
