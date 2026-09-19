/**
 * The rule that holds `authorization.md`.
 *
 * ONE rule, and the honest reason is worth stating: authorization is decided against a row, and a
 * parser does not know which row a handler is reaching for or what owning it means. AUTHZ-3, -4 and
 * -5 all turn on that, so a rule aimed at them would fire on shape rather than on meaning - and a
 * rule that fires on shape is one authors learn to disable, which leaves the law worse off than when
 * nothing enforced it.
 *
 * AUTHZ-1 was measured and deliberately left alone. A handler checking `if (!user)` reads like
 * duplication of the door's guard and is not: the guard belongs to one door and the handler belongs
 * to every caller of the bus. A rule refusing it would fire on the majority of correct handlers in
 * this tree, which is a gate contradicting canon rather than holding it.
 *
 * What IS checkable in one file is the door: a resolver method that READS the authenticated user
 * while nothing on that method or its class establishes the identity. That failure looks like
 * nothing at all - the parameter still says `user`, the handler still receives one - and the only
 * missing piece is the line that proved it belonged to the caller.
 */

/** Parameter decorators that read an already-authenticated identity off the request. */
const IDENTITY_PARAM_DECORATORS = new Set([
  "KeycloakGraphQLUser",
  "KeycloakUser",
  "CurrentUser",
])

/** The decorator that establishes the identity a door then reads. */
const GUARD_DECORATOR = "UseGuards"

/** Reads the callee name off a decorator expression, whether or not it is called. */
const decoratorName = (decorator) => {
  const expression = decorator.expression
  if (!expression) return undefined
  if (expression.type === "CallExpression") {
    return expression.callee && expression.callee.type === "Identifier"
      ? expression.callee.name
      : undefined
  }
  return expression.type === "Identifier" ? expression.name : undefined
}

/** Whether any decorator in the list is the guard. */
const hasGuard = (decorators) =>
  (decorators || []).some((decorator) => decoratorName(decorator) === GUARD_DECORATOR)

/** The identity parameter on a method, when it has one. */
const identityParameter = (node) => {
  for (const parameter of node.value && node.value.params ? node.value.params : []) {
    // a decorated parameter carries its decorators on the parameter node itself, and TS-ESTree
    // wraps a typed+decorated parameter in TSParameterProperty for constructor promotion
    const carrier = parameter.type === "TSParameterProperty" ? parameter.parameter : parameter
    const decorators = parameter.decorators || (carrier && carrier.decorators) || []
    for (const decorator of decorators) {
      if (IDENTITY_PARAM_DECORATORS.has(decoratorName(decorator))) return parameter
    }
  }
  return undefined
}

// -- AUTHZ-2 ---------------------------------------------------------------------------------------

/** A door that reads an identity carries the guard that establishes it. */
export const identityNeedsGuard = {
  meta: {
    type: "problem",
    docs: {
      description:
        "A resolver or controller method reading the authenticated user must carry a guard on that method or its class.",
    },
    schema: [],
    messages: {
      unguarded:
        "This door reads the authenticated user through `@{{decorator}}()` while neither the method nor its class carries `@UseGuards(...)`. Nothing established the identity, so what reaches the handler is whatever the pipeline left there - and the failure is silent, because the parameter still says `user` and the handler still receives one. Put the guard on the door that reads the identity.",
    },
  },
  create(context) {
    return {
      MethodDefinition(node) {
        const parameter = identityParameter(node)
        if (!parameter) return
        if (hasGuard(node.decorators)) return

        // the guard may sit on the class instead, covering every method on it
        const classBody = node.parent
        const classNode = classBody && classBody.parent
        if (classNode && hasGuard(classNode.decorators)) return

        const carrier = parameter.type === "TSParameterProperty" ? parameter.parameter : parameter
        const decorators = parameter.decorators || (carrier && carrier.decorators) || []
        const named = decorators.map(decoratorName).find((name) => IDENTITY_PARAM_DECORATORS.has(name))
        context.report({ node: parameter, messageId: "unguarded", data: { decorator: named } })
      },
    }
  },
}

/** Every rule this module ships, by the name a config switches it on under. */
export const rules = {
  "identity-needs-guard": identityNeedsGuard,
}

/** The level a consuming repository switches this on at. */
export const recommended = {
  "starci-be/identity-needs-guard": "error",
}
