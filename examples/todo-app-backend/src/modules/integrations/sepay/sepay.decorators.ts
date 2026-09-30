import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { SepayClient } from "./sepay.client"
import type { SepayOptions } from "./sepay.options"

/** Token of the options of the SePay integration. */
export const SEPAY_OPTIONS: unique symbol = Symbol("integrations.sepay.options")

/** Injects the options of the SePay integration. Parameter type: SepayOptions. */
export const InjectSepayOptions = (): TypedParameterDecorator<SepayOptions> => injector<SepayOptions>(SEPAY_OPTIONS)

/** Token of the SePay client. */
export const SEPAY: unique symbol = Symbol("integrations.sepay.client")

/** Injects the SePay client. Parameter type: SepayClient. */
export const InjectSepay = (): TypedParameterDecorator<SepayClient> => injector<SepayClient>(SEPAY)
