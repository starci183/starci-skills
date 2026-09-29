import {
    Module 
} from "@nestjs/common"
import {
    ConfigModule 
} from "@modules/platform/config/index"
import {
    WinstonService 
} from "@modules/platform/logging/index"

@Module({
    imports: [ConfigModule.register()],
    providers: [WinstonService],
})
/** Composition root of the migrate app: the configuration it reads the database URL from and the logger it reports through. */
export class AppModule {}
