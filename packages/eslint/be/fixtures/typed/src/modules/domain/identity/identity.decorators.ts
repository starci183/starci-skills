import { PublicReason } from "./identity.contracts"

export { PublicReason }

/** Fixture: opens a door for a reason. */
export const Public = (_options: { reason: PublicReason }): MethodDecorator & ClassDecorator => () => undefined

/** Fixture: the principal of the request, as a handler parameter. */
export const CurrentPrincipal = (): ParameterDecorator => () => undefined

/** Fixture: a door authenticated by its own credential kind (api-key, run-token, tool-token). */
export const Credential = (_options: { kind: string; workflow?: string }): MethodDecorator & ClassDecorator => () => undefined
