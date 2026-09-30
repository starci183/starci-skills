import { Module } from "@nestjs/common"

/** The catalog capability module (fixture). */
@Module({})
export class CatalogModule {
    /** Builds the dynamic module. */
    static register(): { module: typeof CatalogModule } {
        return { module: CatalogModule }
    }
}
