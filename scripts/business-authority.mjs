export const authorityStatus = (model) => model.schemaVersion === 2 ? model.authority.status : "implemented";

const technicalReconciliationBody = (model) => {
  const {schemaVersion: _schemaVersion, authority: _authority, sources = [], evidence = [], ...business} = model;
  return {
    business,
    sources: sources.map(({head: _head, ...identity}) => identity),
    evidence: evidence.map(({startLine: _startLine, endLine: _endLine, ...claim}) => claim),
  };
};

const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    : JSON.stringify(value);

export function proveBusinessTransition(previousHead, previousModel, nextModel) {
  const next = authorityStatus(nextModel);
  if (!previousModel) {
    if (!["pending", "implemented"].includes(next)) throw new Error(`first business revision must be pending or implemented, not ${next}`);
    if (nextModel.schemaVersion === 2 && nextModel.authority.baseHead) throw new Error("first business revision cannot name baseHead");
    return;
  }
  if (nextModel.schemaVersion !== 2) throw new Error("a feature with history can only advance through schemaVersion 2 authority transitions");
  const previous = authorityStatus(previousModel);
  if (previous === "implemented" && next === "implemented") {
    if (nextModel.authority?.basis !== "reconciled") throw new Error("technical reconciliation requires reconciled basis");
    if (nextModel.authority.previousHead !== previousHead) throw new Error(`implemented technical reconciliation must name previousHead ${previousHead}`);
    if (nextModel.authority.baseHead !== previousHead) throw new Error(`implemented technical reconciliation must preserve baseHead ${previousHead}`);
    if (canonical(technicalReconciliationBody(previousModel)) !== canonical(technicalReconciliationBody(nextModel))) {
      throw new Error("technical reconciliation cannot change business claims, source identities or evidence claims");
    }
    return;
  }
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
