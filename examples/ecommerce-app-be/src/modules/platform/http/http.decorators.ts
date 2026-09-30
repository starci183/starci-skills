import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { HttpClient } from "./http.port"

/** Token of the HttpClient port. */
export const HTTP_CLIENT: unique symbol = Symbol("platform.http.client")

/** Injects the HttpClient port. Parameter type: HttpClient. */
export const InjectHttpClient = (): TypedParameterDecorator<HttpClient> => injector<HttpClient>(HTTP_CLIENT)
