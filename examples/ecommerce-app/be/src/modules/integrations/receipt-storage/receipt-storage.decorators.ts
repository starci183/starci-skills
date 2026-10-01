import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ReceiptStorageOptions } from "./receipt-storage.options"
import type { ReceiptStorage } from "./receipt-storage.port"

/** Token of the receipt storage port. */
export const RECEIPT_STORAGE: unique symbol = Symbol("integrations.receipt-storage")

/** Injects the receipt storage port. Parameter type: ReceiptStorage. */
export const InjectReceiptStorage = (): TypedParameterDecorator<ReceiptStorage> =>
    injector<ReceiptStorage>(RECEIPT_STORAGE)

/** Token of the options of the receipt storage integration. */
export const RECEIPT_STORAGE_OPTIONS: unique symbol = Symbol("integrations.receipt-storage.options")

/** Injects the options of the receipt storage integration. Parameter type: ReceiptStorageOptions. */
export const InjectReceiptStorageOptions = (): TypedParameterDecorator<ReceiptStorageOptions> =>
    injector<ReceiptStorageOptions>(RECEIPT_STORAGE_OPTIONS)
