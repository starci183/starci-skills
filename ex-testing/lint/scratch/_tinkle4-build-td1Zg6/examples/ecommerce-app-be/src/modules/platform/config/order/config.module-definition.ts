import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/**
 * The isGlobal knob every house module carries: whether this capability is app-wide is a fact
 * about the APPLICATION, so it is declared at the composition root (`apps/<service>`) as
 * `.register({ isGlobal: true })` - never as a `@Global()` the module declares about itself.
 */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
