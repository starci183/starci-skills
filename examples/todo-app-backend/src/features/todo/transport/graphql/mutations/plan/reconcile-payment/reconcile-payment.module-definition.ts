import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** ReconcilePayment takes no options beyond the isGlobal extra. */
export type ReconcilePaymentOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ReconcilePaymentOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
