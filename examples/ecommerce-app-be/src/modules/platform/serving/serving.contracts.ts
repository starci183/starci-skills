import type { DynamicModule } from "@nestjs/common"

/** What one api process serves: the composed root module and the port it listens on. */
export interface ServedApiParams {
    /** The composed root module of the app. */
    readonly module: DynamicModule
    /** The port the HTTP listener binds. */
    readonly port: number
}
