import { Module } from "@nestjs/common"

/** The catalog capability module (fixture). */
@Module({})
export class CatalogModule {
    /** Builds the dynamic module. */
    static register(options: { isGlobal: boolean }): { module: typeof CatalogModule; global: boolean } {
        return { module: CatalogModule, global: options.isGlobal }
    }
}
