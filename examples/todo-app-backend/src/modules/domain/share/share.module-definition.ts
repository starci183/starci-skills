import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** See databases/postgresql/primary.module-definition.ts's comment: same isGlobal knob, every module. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
