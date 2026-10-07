import { readOpManifest, resolveOpContract, paramValueError, opCheckRequirements } from '../lib/op-shared.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { buildContext } from '../context/pack.mjs';
import { resolveReadReference } from '../context/read-refs.mjs';
import { opInputPaths, recordInputs, workInputPaths, INPUT_DIGEST_SCHEMA, ABSENT } from './input-digests.mjs';
import { validateAgainstSchema } from '../lib/json-schema.mjs';
// Owner: the dispatch admission snapshot recorded before provider launch and retained by the attempt contract.
import { contractVersionOf } from '../machine/contract-version.mjs';
import { captureGateBinding } from './gate-settle.mjs';

/** Capture the current contract bytes once for the immutable admission packet. */
export const admittedVersionOf = (root, op, now) => {
  try { return contractVersionOf(root, op, { now }); } catch { return null; }
};
/**
 * Bind the packet to its admission and resolved owned target baseline before a provider starts. Mutates packet.context
 * once; a missing version or required target baseline throws, so a worker cannot launch with an unusable contract.
 */
export function admitPacket(root, { packet, op, placements, db, workflowId, now = Date.now() }) {
  const admitted = admittedVersionOf(root, op, now);
  if (!admitted) throw Object.assign(new Error('the admitted contract could not be captured'), { code: 'op-gate-tool-failed' });
  packet.context.contract = admitted;
  packet.context.gate_binding = captureGateBinding(placements, { at: admitted.admittedAt });
}

// The declared defaults with the payload's overrides on top, each value checked against its definition.
const dispatchParamsOf = (brief, payload) => {
  const params = {};
  for (const [name, definition] of Object.entries(brief.params ?? {})) if (Object.hasOwn(definition, 'default')) params[name] = definition.default;
  Object.assign(params, payload.params ?? {});
  for (const [name, value] of Object.entries(params)) {
    const definition = brief.params?.[name], error = definition ? paramValueError(name, definition, value) : `undeclared params.${name}`;
    if (error) throw Object.assign(new Error(error), { code: 'params-invalid' });
  }
  return params;
};

const requireDeclaredParams = (brief, params) => {
  for (const [name, definition] of Object.entries(brief.params ?? {})) {
    if (definition.required === true && !Object.hasOwn(params, name))
      throw Object.assign(new Error(`required params.${name} is absent`), { code: 'params-invalid' });
  }
};

const requireReadChecks = (root, checks, params) => {
  for (const check of checks.required.filter((row) => row.obligation !== 'check-id')) {
    const owner = resolveReadReference(check.path, { sourceRoot: root, params });
    if (owner.missing.length || owner.truncated || owner.resolved.length !== 1) {
      throw Object.assign(new Error(`required ${check.obligation} missing or unreadable: ${check.path}`), { code: 'op-context-refused' });
    }
  }
};

/** Resolve persisted params and a single execution contract before any launch
 * effects. The queue already owns setter authority; defaults are still validated. */
export function selectDispatchContract(root, op, payload, { planning = false } = {}) {
  const brief = readOpManifest(path.join(root, 'modules', 'ops', 'ops', `${op}.yaml`));
  const schema = parseYaml(fs.readFileSync(path.join(root, 'modules', 'schemas', 'op.schema.yaml'), 'utf8'));
  const errors = validateAgainstSchema(brief, schema);
  if (errors.length) throw Object.assign(new Error(`invalid op contract: ${errors.join('; ')}`), { code: 'op-context-refused' });
  const params = dispatchParamsOf(brief, payload);
  if (!planning) requireDeclaredParams(brief, params);
  const selected = resolveOpContract(brief, { params, allowSelect: planning });
  if (!selected.ok) throw Object.assign(new Error(selected.detail), { code: selected.reason });
  const kinds = parseYaml(fs.readFileSync(path.join(root, 'modules', 'models', 'kinds.yaml'), 'utf8'));
  const checks = opCheckRequirements(selected.contract, kinds?.kinds?.[op]);
  if (!planning) requireReadChecks(root, checks, params);
  return { brief: selected.contract, params, selected: { mode: selected.mode, contract: selected.contract, checks } };
}

/**
 * A read bound to a mode is required only in that mode: `policy.modes.<mode>`
 * names the param that selects it and the read ids the mode owns (brand.decide
 * reads.direction, direction mode params.directionArchetype). The dispatch of an
 * inactive mode leaves those reads out of the required set entirely; the mode's
 * own dispatch still enforces every one of them.
 */
const modeReadBrief = (briefDoc, params) => {
  const modes = briefDoc?.policy?.modes;
  if (!modes || typeof modes !== 'object' || Array.isArray(modes)) return briefDoc;
  const inactive = new Set();
  for (const mode of Object.values(modes)) {
    if (mode?.param && !params?.[mode.param]) for (const id of mode?.reads ?? []) inactive.add(id);
  }
  return inactive.size
    ? { ...briefDoc, reads: (briefDoc.reads ?? []).filter((read) => !inactive.has(read?.id)) }
    : briefDoc;
};

/** The `<family>` binding of grammar-law READ paths: the bound brand record's
 * declared identity.family (work/brand@1), when the dispatch params name none. */
const boundFamilyOf = (stateDir) => {
  if (!stateDir) return null;
  try {
    const family = parseYaml(fs.readFileSync(path.join(stateDir, 'brand', 'index.yaml'), 'utf8'))?.brand?.identity?.family;
    return typeof family === 'string' && /^[A-Za-z0-9_.-]+$/.test(family) ? family : null;
  } catch { return null; }
};

/** READ-resolution bindings only: the packet keeps declared params, the read
 * layer additionally binds `<family>` from the bound brand record. */
const readBindingParams = (params, stateDir) => {
  if (params?.family != null) return params;
  const family = boundFamilyOf(stateDir);
  return family ? { ...params, family } : params;
};

/** Capture selected READ files and input digests once for the immutable packet.
 * Failed measurement is not an absent optional product record or a usable snapshot. */
export function captureDispatchInputs({ skillRoot, op, packet, briefDoc, params, repo, stateDir, workDir = '.starciwork', workerCwd, planning = false, inputRecorder = recordInputs }) {
  const readBrief = modeReadBrief(briefDoc, params);
  const readParams = readBindingParams(params, stateDir);
  const contextPack = buildContext({ op, records: packet.context.records, skillRoot, briefDoc: readBrief, params: readParams,
    appRoot: workerCwd, stateDir, allowSelect: planning,
    ownedPaths: packet.context.owned_paths.map((place) => ({ ...place,
      abs: place.unresolved ? undefined : path.resolve(place.root ?? workerCwd, place.path) })),
  });
  if (!planning && (contextPack.error || contextPack.requiredMissing?.length)) {
    throw Object.assign(new Error(contextPack.error ?? `required READ inputs missing or incomplete: ${contextPack.requiredMissing.join(', ')}`), { code: 'op-context-refused' });
  }
  let inputs;
  try { inputs = inputRecorder(skillRoot, opInputPaths(readBrief, { params: readParams }), undefined, { repo, workPaths: workInputPaths({ records: packet.context.records }), workDir, strict: true }); }
  catch (error) { throw Object.assign(new Error(`input capture failed: ${error.code ?? 'unreadable'}`), { code: 'op-context-refused' }); }
  if (inputs?.schema !== INPUT_DIGEST_SCHEMA || !Array.isArray(inputs.digests) || inputs.digests.some((row) => row.kind === 'source' && row.digest === ABSENT)) {
    throw Object.assign(new Error('input capture is malformed or required Source inputs are absent'), { code: 'op-context-refused' });
  }
  packet.context.mandatoryReads = contextPack.mandatory?.map((entry) => entry.path) ?? [];
  packet.context.readRefs = contextPack.mandatory ?? [];
  return { inputs, contextPack };
}
