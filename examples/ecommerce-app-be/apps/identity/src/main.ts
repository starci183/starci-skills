import "reflect-metadata"
import { EnvSource } from "@modules/platform/config"
import { serveApi } from "@modules/platform/serving"
import { AppModule } from "./app.module"
import { parseIdentityAppOptions } from "./identity.options"

void serveApi("identity", () => {
    const options = parseIdentityAppOptions(EnvSource.fromProcess())
    return { module: AppModule.register(options), port: options.port }
})
