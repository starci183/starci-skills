const isProjectionListener = (filename) => /projection\.listener\.ts$/.test(
  String(filename || "").replace(/\\/g, "/"),
) && !String(filename || "").replace(/\\/g, "/").endsWith("/abstract-projection.listener.ts")

const memberName = (member) => member.key && (member.key.name || member.key.value)

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

export const rules = { "projection-listener-contract": projectionListenerContract }

export const recommended = {
  "starci-be/projection-listener-contract": "error",
}
