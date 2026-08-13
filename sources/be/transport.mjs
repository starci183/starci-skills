const normalize = (filename) => String(filename || "").replace(/\\/g, "/")

/** The decorator's own name, whether it was written `@Controller` or `@Controller("x")`. */
const decoratorName = (node) => {
  const expression = node.expression
  if (!expression) return null
  if (expression.type === "Identifier") return expression.name
  if (expression.type === "CallExpression" && expression.callee.type === "Identifier") {
    return expression.callee.name
  }
  return null
}

/** The route string, or "" for `@Controller()` and for a path given as an object. */
const routeOf = (node) => {
  const expression = node.expression
  if (!expression || expression.type !== "CallExpression") return ""
  const first = expression.arguments[0]
  if (first && first.type === "Literal" && typeof first.value === "string") return first.value
  return ""
}

/**
 * Which of the four sanctioned reasons this file shows, if any.
 *
 * READ OFF THE FILE, NOT OFF A LIST. A registry of blessed routes rots the moment somebody adds a
 * route and forgets it; the evidence here is the same evidence a reader would use.
 */
const reasonFor = (route, filename, text) => {
  const path = normalize(filename)
  // a probe answers when the app is degraded, before the feature layer is necessarily up
  if (/^healthz?$/.test(route) || /\/health(z)?[./]/.test(path)) return "probe"
  // something outside posts to a URL we gave it, and it will never send a GraphQL document
  if (/webhook/i.test(route) || /webhook/i.test(path)) return "external"
  // bytes, not fields: multipart in, stream out
  if (/FileInterceptor|FilesInterceptor|AnyFilesInterceptor|StreamableFile|@Res\s*\(|createReadStream/.test(text)) {
    return "bytes"
  }
  // a machine registering itself, with no user session to carry
  if (/^(pods|internal|agents)\//.test(route)) return "machine"
  // an identity that is not a user session - a platform operator or a service token
  if (/^api\/ops(\/|$)/.test(route) || /Operator[A-Za-z]*Guard|ServiceToken|OPS_TOKEN/.test(text)) {
    return "operator"
  }
  return null
}

/** A REST door exists only where GraphQL cannot go, and the file has to show which case it is. */
export const restDoorNeedsAReason = {
  meta: {
    type: "problem",
    docs: { description: "A @Controller is permitted only where GraphQL cannot serve." },
    schema: [],
    messages: {
      unjustified:
        "This REST door shows none of the four reasons a door may not be GraphQL: an external system posting to a fixed URL, a payload of bytes rather than fields, a machine with no user session, or an identity that is not one. A plain JSON read belongs in the GraphQL schema, where the client already is.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    const text = (context.sourceCode || context.getSourceCode()).getText()
    return {
      Decorator(node) {
        if (decoratorName(node) !== "Controller") return
        if (reasonFor(routeOf(node), filename, text)) return
        context.report({ node, messageId: "unjustified" })
      },
    }
  },
}

/** A door is a door whatever its transport, and every door in this repository lives in features/. */
export const doorLivesInFeatures = {
  meta: {
    type: "problem",
    docs: { description: "HTTP doors sit under features/, beside the GraphQL ones." },
    schema: [],
    messages: {
      wrongTree:
        "A @Controller under src/modules/ is a door parked among the capabilities it calls, where it reads as one and gets imported like one. Every GraphQL door in this repository already lives under features/; transport was never what decided the address.",
    },
  },
  create(context) {
    const path = normalize(context.filename || context.getFilename())
    if (!/\/src\/modules\//.test(path)) return {}
    return {
      Decorator(node) {
        if (decoratorName(node) !== "Controller") return
        context.report({ node, messageId: "wrongTree" })
      },
    }
  },
}

export const rules = {
  "rest-door-needs-a-reason": restDoorNeedsAReason,
  "door-lives-in-features": doorLivesInFeatures,
}

export const recommended = {
  "starci-be/rest-door-needs-a-reason": "error",
  "starci-be/door-lives-in-features": "error",
}
