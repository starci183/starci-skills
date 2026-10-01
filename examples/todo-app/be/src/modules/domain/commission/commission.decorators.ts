import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { CommissionOptions } from "./commission.options"

/** Token of the options of the commission capability. */
export const COMMISSION_OPTIONS: unique symbol = Symbol("domain.commission.options")

/** Injects the options of the commission capability. Parameter type: CommissionOptions. */
export const InjectCommissionOptions = (): TypedParameterDecorator<CommissionOptions> =>
    injector<CommissionOptions>(COMMISSION_OPTIONS)
