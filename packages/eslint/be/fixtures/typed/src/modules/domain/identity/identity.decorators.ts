import { PublicReason } from "./identity.contracts"

export { PublicReason }

/** Fixture: opens a door for a reason. */
export const Public = (_options: { reason: PublicReason }): MethodDecorator & ClassDecorator => () => undefined

/** Fixture: the principal of the request, as a handler parameter. */
export const CurrentPrincipal = (): ParameterDecorator => () => undefined
