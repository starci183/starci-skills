const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** The NATS bridge rejects self-echo and claims redelivery before local fan-out. */
export const natsBridgeDeliveryContract = {
  meta: {
    type: "problem",
    docs: { description: "The central NATS bridge preserves cross-instance delivery invariants." },
    schema: [],
    messages: {
      origin: "Drop envelopes whose producer id matches this instance before local emit.",
      digest: "Claim/check the envelope digest before local emit so redelivery is idempotent.",
    },
  },
  create(context) {
    if (!normalizePath(context.filename || context.getFilename()).endsWith(
      "/event/nats/nats-bridge.service.ts",
    )) return {}
    return {
      "Program:exit"(node) {
        const source = context.sourceCode || context.getSourceCode()
        const text = source.getText()
        const originIndex = text.search(/parsed\.id\s*===\s*this\.instanceService\.getId\(\)/)
        const digestIndex = text.indexOf("parsed.digest")
        const emitIndex = text.indexOf("this.eventEmitter.emit")
        if (originIndex < 0 || emitIndex < 0 || originIndex > emitIndex) {
          context.report({ node, messageId: "origin" })
        }
        if (digestIndex < 0 || emitIndex < 0 || digestIndex > emitIndex) {
          context.report({ node, messageId: "digest" })
        }
      },
    }
  },
}

const isEmitCallOnEventEmitterService = (node) =>
  node.callee.type === "MemberExpression" &&
  !node.callee.computed &&
  node.callee.property.type === "Identifier" &&
  node.callee.property.name === "emit" &&
  node.callee.object.type === "MemberExpression" &&
  !node.callee.object.computed &&
  node.callee.object.property.type === "Identifier" &&
  node.callee.object.property.name === "eventEmitterService"

const findObjectProperty = (objectExpression, name) => {
  if (!objectExpression || objectExpression.type !== "ObjectExpression") return null
  return objectExpression.properties.find(
    (property) => property.type === "Property" &&
      !property.computed &&
      (property.key.name === name || property.key.value === name),
  ) || null
}

/** DELIVERY Rule 2 (DELIVERY-2): transport is declared per event in one config, never at the call site. */
export const noCallSiteTransportOverride = {
  meta: {
    type: "problem",
    docs: {
      description: "DELIVERY Rule 2 (DELIVERY-2): transport is declared per event in the central config; it is never chosen at the call site.",
    },
    schema: [],
    messages: {
      callsite: "DELIVERY Rule 2 (DELIVERY-2): do not pass `options.useLocal`/`options.useNats` to `eventEmitterService.emit(...)`. Transport is part of the event's definition in the central config, not a per-call decision -- a call site choosing it is a promise the config never made and a reader has to guess at.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isEmitCallOnEventEmitterService(node)) return
        const args = node.arguments[0]
        const optionsProperty = findObjectProperty(args, "options")
        if (!optionsProperty) return
        const optionsValue = optionsProperty.value
        const hasUseLocal = findObjectProperty(optionsValue, "useLocal")
        const hasUseNats = findObjectProperty(optionsValue, "useNats")
        if (hasUseLocal || hasUseNats) {
          context.report({ node: optionsProperty, messageId: "callsite" })
        }
      },
    }
  },
}

export const rules = {
  "nats-bridge-delivery-contract": natsBridgeDeliveryContract,
  "no-call-site-transport-override": noCallSiteTransportOverride,
}

export const recommended = {
  "starci-be/nats-bridge-delivery-contract": "error",
  "starci-be/no-call-site-transport-override": "error",
}
