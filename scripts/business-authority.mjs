export const authorityStatus = (model) => model.schemaVersion === 2 ? model.authority.status : "implemented";

export function proveBusinessTransition(previousHead, previousModel, nextModel) {
  const next = authorityStatus(nextModel);
  if (!previousModel) {
    if (!["pending", "implemented"].includes(next)) throw new Error(`first business revision must be pending or implemented, not ${next}`);
    if (nextModel.schemaVersion === 2 && nextModel.authority.baseHead) throw new Error("first business revision cannot name baseHead");
    return;
  }
  if (nextModel.schemaVersion !== 2) throw new Error("a feature with history can only advance through schemaVersion 2 authority transitions");
  const previous = authorityStatus(previousModel);
  const allowed = {
    implemented: new Set(["pending"]),
    pending: new Set(["in-progress", "rejected"]),
    "in-progress": new Set(["implemented", "rejected"]),
    rejected: new Set(["pending"]),
  };
  if (!allowed[previous]?.has(next)) throw new Error(`invalid business authority transition ${previous} -> ${next}`);
  if (nextModel.authority.previousHead !== previousHead) throw new Error(`${next} revision must name previousHead ${previousHead}`);
  const expectedBase = previous === "implemented" ? previousHead : previousModel.authority?.baseHead;
  if (next !== "implemented" && nextModel.authority.baseHead !== expectedBase) throw new Error(`${next} revision must preserve implemented baseHead ${expectedBase}`);
}
