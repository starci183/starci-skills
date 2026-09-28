import "reflect-metadata"
import {
    NestFactory 
} from "@nestjs/core"
import {
    AppModule 
} from "./app.module"
import {
    AppConfigService 
} from "ecommerce-app-be/modules/platform/config/order"

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule)
    const config = app.get(AppConfigService)
    await app.listen(config.getPort())
}

void bootstrap()
