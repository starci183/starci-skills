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

export const rules = { "nats-bridge-delivery-contract": natsBridgeDeliveryContract }

export const recommended = {
  "starci-be/nats-bridge-delivery-contract": "error",
}
