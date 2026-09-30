import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./sepay.module-definition"
import type { SepayClient } from "./sepay.client"
import type { SepayOptions } from "./sepay.options"

/** Injects the options of the SePay integration. Parameter type: SepayOptions. */
export const InjectSepayOptions = (): TypedParameterDecorator<SepayOptions> => injector<SepayOptions>(MODULE_OPTIONS_TOKEN)

/** Token of the SePay client. */
export const SEPAY: unique symbol = Symbol("integrations.sepay.client")

/** Injects the SePay client. Parameter type: SepayClient. */
export const InjectSepay = (): TypedParameterDecorator<SepayClient> => injector<SepayClient>(SEPAY)
