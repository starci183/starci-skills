/** A lookalike of the identity decorator, declared by another owner: it carries no principal. */
export const CurrentPrincipal = (): ParameterDecorator => () => undefined
