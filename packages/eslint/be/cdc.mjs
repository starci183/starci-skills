const isProjectionListener = (filename) => /projection\.listener\.ts$/.test(
  String(filename || "").replace(/\\/g, "/"),
) && !String(filename || "").replace(/\\/g, "/").endsWith("/abstract-projection.listener.ts")

const isProjectionService = (filename) => /-projection\.service\.ts$/.test(
  String(filename || "").replace(/\\/g, "/"),
)

const memberName = (member) => member.key && (member.key.name || member.key.value)

/** A groupId literal is safe: a plain string, or a template with no `${}` substitution. */
const isStaticStringValue = (node) => {
  if (!node) return false
  if (node.type === "Literal" && typeof node.value === "string") return true
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return true
  return false
}

/** Flatten a function's parameter list to the names it binds, through destructuring/defaults/rest. */
const collectParamNames = (params, names = []) => {
  for (const param of params || []) {
    if (!param) continue
    if (param.type === "Identifier") {
      names.push(param.name)
    } else if (param.type === "AssignmentPattern") {
      collectParamNames([param.left], names)
    } else if (param.type === "RestElement") {
      collectParamNames([param.argument], names)
    } else if (param.type === "ObjectPattern") {
      for (const prop of param.properties || []) {
        if (prop.type === "Property" && prop.key) {
          names.push(prop.key.name || prop.key.value)
        } else if (prop.type === "RestElement") {
          collectParamNames([prop.argument], names)
        }
      }
    }
  }
  return names
}

const DELTA_LIKE_PARAMS = new Set(["amount", "delta", "points", "increment"])

/** A projection listener declares mapping while AbstractProjectionListener owns Kafka lifecycle. */
export const projectionListenerContract = {
  meta: {
    type: "problem",
    docs: { description: "Projection CDC listeners share one Kafka lifecycle contract." },
    schema: [],
    messages: {
      base: "A projection CDC listener extends AbstractProjectionListener; the shared base owns subscription, envelope parsing and failure isolation.",
      member: "A projection CDC listener must declare `{{name}}`.",
      lifecycle: "A concrete projection listener must not override `onModuleInit`; Kafka lifecycle belongs to AbstractProjectionListener.",
    },
  },
  create(context) {
    if (!isProjectionListener(context.filename || context.getFilename())) return {}
    return {
      ClassDeclaration(node) {
        if (!node.superClass || node.superClass.name !== "AbstractProjectionListener") {
          context.report({ node: node.id || node, messageId: "base" })
        }
        const members = node.body.body || []
        const names = new Set(members.map(memberName))
        for (const name of ["groupId", "topics", "deriveTargets", "recomputeTarget"]) {
          if (!names.has(name)) {
            context.report({ node: node.id || node, messageId: "member", data: { name } })
          }
        }
        const lifecycle = members.find((member) => memberName(member) === "onModuleInit")
        if (lifecycle) context.report({ node: lifecycle.key, messageId: "lifecycle" })
      },
    }
  },
}

/** CDC Rule 3 (CDC-2): a projection's consumer group id is a constant, not computed at boot. */
export const noDynamicProjectionGroupId = {
  meta: {
    type: "problem",
    docs: {
      description: "CDC Rule 3 (CDC-2): `groupId` is a stable string literal, not a value computed at boot.",
    },
    schema: [],
    messages: {
      dynamic: "CDC Rule 3 (CDC-2): `groupId` must be a constant string literal. A template substitution, a call (`Date.now()`, `randomUUID()`, `hostname()`), or an env/instance read makes the consumer group unstable across restarts, so each restart replays the whole history in a fresh group instead of resuming from the committed offset.",
    },
  },
  create(context) {
    if (!isProjectionListener(context.filename || context.getFilename())) return {}
    return {
      PropertyDefinition(node) {
        if (memberName(node) !== "groupId") return
        if (node.value && !isStaticStringValue(node.value)) {
          context.report({ node: node.value, messageId: "dynamic" })
        }
      },
    }
  },
}

/** CDC Rules 1 and 6 (CDC-4): recompute rebuilds from source by UPSERT, never by applying a delta. */
export const projectionRecomputeMustUpsert = {
  meta: {
    type: "problem",
    docs: {
      description: "CDC Rules 1 and 6 (CDC-4): a projection recomputes from source rows by UPSERT; it is never updated by applying an event's delta.",
    },
    schema: [],
    messages: {
      delta: "CDC Rules 1 and 6 (CDC-4): `recompute` must not take a `{{name}}` parameter. Recompute takes only the target's identity and rebuilds the value from authoritative source rows -- a delta/amount/points parameter means a duplicate delivery doubles the projection and a lost delivery never heals.",
      upsert: "CDC Rules 1 and 6 (CDC-4): a projection service with a `recompute` method must write through an UPSERT (`ON CONFLICT`). A value assembled without one is not safe to replay, and replay is the one guarantee a broker actually offers.",
    },
  },
  create(context) {
    if (!isProjectionService(context.filename || context.getFilename())) return {}
    let hasRecompute = false
    return {
      MethodDefinition(node) {
        if (memberName(node) !== "recompute") return
        hasRecompute = true
        const params = collectParamNames(node.value.params)
        for (const name of params) {
          if (DELTA_LIKE_PARAMS.has(String(name).toLowerCase())) {
            context.report({ node, messageId: "delta", data: { name } })
          }
        }
      },
      "Program:exit"(node) {
        if (!hasRecompute) return
        const source = context.sourceCode || context.getSourceCode()
        if (!/on\s*conflict/i.test(source.getText())) {
          context.report({ node, messageId: "upsert" })
        }
      },
    }
  },
}

export const rules = {
  "projection-listener-contract": projectionListenerContract,
  "no-dynamic-projection-group-id": noDynamicProjectionGroupId,
  "projection-recompute-must-upsert": projectionRecomputeMustUpsert,
}

export const recommended = {
  "starci-be/projection-listener-contract": "error",
  "starci-be/no-dynamic-projection-group-id": "error",
  "starci-be/projection-recompute-must-upsert": "error",
}
