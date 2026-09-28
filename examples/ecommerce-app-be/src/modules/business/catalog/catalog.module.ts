import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    CatalogService 
} from "./catalog.service"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./catalog.module-definition"

@Module({
})
/**
 * The `catalog` capability module: the product list and the stock truth the checkout policy
 * reads. Persistence is the primary EntityManager the order database module registers app-wide
 * at `apps/order`; this module's own globality is declared there too.
 */
export class CatalogModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                CatalogService],
            exports: [CatalogService],
        }
    }
}
