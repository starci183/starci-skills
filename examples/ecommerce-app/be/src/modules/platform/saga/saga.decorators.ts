import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { SagaService } from "./saga.service"

/** Token of the SagaService of this capability, for the features that orchestrate a saga. */
export const SAGA_SERVICE: unique symbol = Symbol("platform.saga.service")

/** Injects the SagaService. Parameter type: SagaService. */
export const InjectSagaService = (): TypedParameterDecorator<SagaService> => injector<SagaService>(SAGA_SERVICE)
