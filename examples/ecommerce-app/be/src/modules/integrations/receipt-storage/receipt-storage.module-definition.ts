import { ConfigurableModuleBuilder } from "@nestjs/common"
import { RECEIPT_STORAGE_OPTIONS } from "./receipt-storage.decorators"
import type { ReceiptStorageOptions } from "./receipt-storage.options"

/** The configurable-module base of the receipt storage integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ReceiptStorageOptions>({ optionsInjectionToken: RECEIPT_STORAGE_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
