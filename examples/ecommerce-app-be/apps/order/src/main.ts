import "reflect-metadata"
import { EnvSource } from "@modules/platform/config"
import { serveApi } from "@modules/platform/serving"
import { AppModule } from "./app.module"
import { parseOrderAppOptions } from "./order.options"

void serveApi("order", () => {
    const options = parseOrderAppOptions(EnvSource.fromProcess())
    return { module: AppModule.register(options), port: options.port }
})
