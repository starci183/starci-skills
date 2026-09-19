import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** See primary.module-definition.ts's comment: nivo gives every owned module this same isGlobal knob. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
