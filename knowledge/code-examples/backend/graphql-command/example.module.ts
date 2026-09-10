import {
    Module,
} from "@nestjs/common"
import {
    ConfigurableModuleClass,
} from "./example.module-definition"
import {
    ExampleCreateItemResolver,
} from "./example.resolver"
import {
    ExampleCreateItemService,
} from "./example.service"
import {
    ExampleCreateItemHandler,
} from "./example.handler"

@Module({
    providers: [
        ExampleCreateItemService,
        ExampleCreateItemResolver,
        ExampleCreateItemHandler,
    ],
})
/** Isolated Nest registration for the synthetic exampleCreateItem mutation unit. */
export class ExampleCreateItemSingleMutationModule extends ConfigurableModuleClass {}
