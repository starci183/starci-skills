// The user-facing workflow topology sits above operator execution modes. Its vocabulary and law
// live once in resources/orchestrator.json#workflowTopologies; these helpers interpret that record
// without teaching session callers a second copy of its names, thresholds or state addresses.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';

const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const filled = (value) => typeof value === 'string' && value.trim().length > 0;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateSchema = JSON.parse(readFileSync(path.join(root, 'templates', 'step', 'state.schema.json'), 'utf8'));
const stateAddressParts = (address) => {
  const match = /^state\.json#([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)+)$/.exec(address ?? '');
  return match ? match[1].split('.') : null;
};
const readParts = (record, parts) => parts.reduce((value, key) => value?.[key], record);
const schemaPart = (parts) => Array.isArray(parts) ? parts.reduce((node, key) => node?.properties?.[key], stateSchema) : undefined;
const schemaHasType = (rule, type) => (Array.isArray(rule?.type) ? rule.type : [rule?.type]).includes(type);
const peerSchema = (policy) => schemaPart(stateAddressParts(policy?.tracking))?.additionalProperties;
const peerHeadPattern = (policy) => new RegExp(peerSchema(policy).properties.head.pattern);
const fullHeadPattern = /^[0-9a-f]{40}$/;
const writeParts = (record, parts, value) => {
  let target = record;
  for (const key of parts.slice(0, -1)) {
    if (!plainObject(target[key])) target[key] = {};
    target = target[key];
  }
  target[parts.at(-1)] = value;
};
const policyPath = (policy, key) => {
  const parts = stateAddressParts(policy?.[key]);
  if (!parts) throw new Error(`orchestrator.json: workflowTopologies.${key} must be a nested state.json address`);
  return parts;
};

export const workflowTopologyMode = (policy, state) => readParts(state, policyPath(policy, 'state'));
export const setWorkflowTopologyMode = (policy, state, mode) => writeParts(state, policyPath(policy, 'state'), mode);
export const workflowTopologyPeers = (policy, state) => readParts(state, policyPath(policy, 'tracking'));
export const setWorkflowTopologyPeers = (policy, state, peers) => writeParts(state, policyPath(policy, 'tracking'), peers);

export function workflowTopologyPolicyErrors(policy) {
  const errors = [];
  if (!plainObject(policy)) return ['orchestrator.json: workflowTopologies must be an object'];
  if (!filled(policy.default)) errors.push('orchestrator.json: workflowTopologies.default must name one declared mode');
  for (const key of ['state', 'tracking']) {
    const parts = stateAddressParts(policy[key]);
    if (!parts) errors.push(`orchestrator.json: workflowTopologies.${key} must be a nested state.json address`);
    else {
      const declared = schemaPart(parts);
      if (!declared) errors.push(`orchestrator.json: workflowTopologies.${key} ${policy[key]} is not declared by templates/step/state.schema.json`);
      else if (key === 'state' && !schemaHasType(declared, 'string')) errors.push(`orchestrator.json: workflowTopologies.state must resolve to a string schema`);
      else if (key === 'tracking' && !schemaHasType(declared, 'object')) errors.push(`orchestrator.json: workflowTopologies.tracking must resolve to an object schema`);
    }
  }
  const trackedPeer = peerSchema(policy);
  const headPattern = trackedPeer?.properties?.head?.pattern;
  if (!plainObject(trackedPeer)) errors.push('orchestrator.json: workflowTopologies.tracking must declare an additionalProperties peer schema');
  else if (!filled(headPattern)) errors.push('orchestrator.json: workflowTopologies.tracking peer head must declare a pattern');
  else try { new RegExp(headPattern); } catch { errors.push('orchestrator.json: workflowTopologies.tracking peer head pattern must be a valid regular expression'); }
  if (!filled(policy.rule)) errors.push('orchestrator.json: workflowTopologies.rule must state how user demand selects a topology');
  if (!Array.isArray(policy.sources) || !policy.sources.length || policy.sources.some((source) => !filled(source))) errors.push('orchestrator.json: workflowTopologies.sources must cite at least one evidence file');

  const modes = policy.modes;
  if (!plainObject(modes)) return [...errors, 'orchestrator.json: workflowTopologies.modes must be an object'];
  const names = Object.keys(modes);
  if (!names.length) errors.push('orchestrator.json: workflowTopologies.modes must declare at least one mode');
  if (filled(policy.default) && !Object.hasOwn(modes, policy.default)) errors.push(`orchestrator.json: workflowTopologies.default ${policy.default} is not a declared mode`);
  for (const [name, mode] of Object.entries(modes)) {
    const at = `orchestrator.json: workflowTopologies.modes.${name}`;
    if (!plainObject(mode)) { errors.push(`${at} must be an object`); continue; }
    for (const key of ['owner', 'completion']) if (!filled(mode[key])) errors.push(`${at}.${key} must be declared`);
    if (!Number.isInteger(mode.minimumPeers) || mode.minimumPeers < 0) errors.push(`${at}.minimumPeers must be a non-negative integer`);
    if (mode.maximumPeers !== null && (!Number.isInteger(mode.maximumPeers) || mode.maximumPeers < mode.minimumPeers)) errors.push(`${at}.maximumPeers must be null or an integer no smaller than minimumPeers`);
    if (!['optional', 'required'].includes(mode.terminalPeerHeads)) errors.push(`${at}.terminalPeerHeads must be optional or required`);
    if (typeof mode.distinctPeerOwnership !== 'boolean') errors.push(`${at}.distinctPeerOwnership must be true or false`);
    if (mode.peerTopology !== undefined && (!filled(mode.peerTopology) || !Object.hasOwn(modes, mode.peerTopology))) errors.push(`${at}.peerTopology must name a declared mode`);
    if (mode.completionOperator !== undefined && (!filled(mode.completionOperator) || !/^[a-z]+(?:\.[a-z]+)+$/.test(mode.completionOperator))) errors.push(`${at}.completionOperator must name an operator`);
    if (mode.completionOperator !== undefined && (!Array.isArray(mode.ancestralEvidenceOperators)
      || mode.ancestralEvidenceOperators.some(operator => !filled(operator) || !/^[a-z]+(?:\.[a-z]+)+$/.test(operator))
      || new Set(mode.ancestralEvidenceOperators).size !== mode.ancestralEvidenceOperators.length)) errors.push(`${at}.ancestralEvidenceOperators must be a distinct operator-id array`);
    if (mode.minimumPeers > 0 || mode.maximumPeers === null || mode.maximumPeers > 0) {
      for (const key of ['communication', 'communicationRule', 'lifecycle', 'wait', 'failure']) if (!filled(mode[key])) errors.push(`${at}.${key} must be declared when peers are allowed`);
    }
  }
  return errors;
}

export function selectWorkflowTopology(policy, requested) {
  const policyErrors = workflowTopologyPolicyErrors(policy);
  if (policyErrors.length) throw new Error(policyErrors.join('\n'));
  if (requested !== undefined && (!plainObject(requested) || Object.keys(requested).some((key) => key !== 'mode'))) throw new Error('draft.topology must be an object containing only mode');
  if (requested !== undefined && !filled(requested.mode)) throw new Error('draft.topology.mode is required when topology is explicit');
  const mode = requested?.mode ?? policy.default;
  if (!Object.hasOwn(policy.modes, mode)) throw new Error(`draft.topology.mode ${mode} is unknown; expected ${Object.keys(policy.modes).join(' or ')}`);
  return { mode };
}

export function sessionWorkflowTopologyErrors(policy, state, { dispatch = false, terminal = false } = {}) {
  const policyErrors = workflowTopologyPolicyErrors(policy);
  if (policyErrors.length) return policyErrors;
  const errors = [];
  const modePath = policyPath(policy, 'state');
  const mode = readParts(state, modePath);
  const topologyRecord = readParts(state, modePath.slice(0, -1));
  if (mode === undefined) return (dispatch || terminal)
    ? [`state.json: ${policy.state} is required before dispatch or successful close; archive the old ledger and open a fresh current session`]
    : []; // Unmarked topology is not current execution authority.
  if (!plainObject(topologyRecord) || Object.keys(topologyRecord).some((key) => key !== modePath.at(-1))) return [`state.json: ${policy.state} must be the only field in its topology record`];
  if (!Object.hasOwn(policy.modes, mode)) return [`state.json: ${policy.state} ${mode ?? 'missing'} is not declared by resources/orchestrator.json#workflowTopologies`];
  const rule = policy.modes[mode];
  const peerRecord = workflowTopologyPeers(policy, state);
  const peers = Object.entries(plainObject(peerRecord) ? peerRecord : {});
  for (const [peerId] of peers) if (!filled(peerId)) errors.push(`state.json: ${policy.tracking} contains an empty peer task id`);
  const trackedPeerSchema = peerSchema(policy);
  for (const [peerId, peer] of peers) errors.push(...validateAgainst(trackedPeerSchema, peer, `state.json: ${policy.tracking}.${peerId || '<empty>'}`));
  for (const [peerId, peer] of peers) {
    if (!Array.isArray(peer?.heads)) continue;
    const aliases = peer.heads.map(item => item?.alias).filter(filled);
    if (aliases.length !== peer.heads.length || new Set(aliases).size !== aliases.length) errors.push(`state.json: ${policy.tracking}.${peerId || '<empty>'}.heads requires one distinct routed workspace alias per repository boundary`);
  }
  if (peers.some(([peerId]) => peerId === state.hostBinding?.hostId)) errors.push(`state.json: ${mode} cannot track its own hostBinding.hostId as a peer task`);
  if (rule.maximumPeers !== null && peers.length > rule.maximumPeers) errors.push(`state.json: ${mode} tracks at most ${rule.maximumPeers} peer tasks in ${policy.tracking}; found ${peers.length}`);
  if (rule.distinctPeerOwnership) {
    const owns = peers.map(([, peer]) => plainObject(peer) && filled(peer.owns) ? peer.owns.trim() : null).filter(Boolean);
    if (owns.length !== peers.length || new Set(owns).size !== peers.length) errors.push(`state.json: ${mode} requires one distinct non-empty owns value per peer task`);
  }
  if (dispatch || terminal) {
    const stage = terminal ? 'completion' : 'dispatch';
    if (peers.length < rule.minimumPeers) errors.push(`state.json: ${mode} ${stage} tracks at least ${rule.minimumPeers} peer tasks in ${policy.tracking}; found ${peers.length}`);
    if (terminal && rule.terminalPeerHeads === 'required') {
      const requiredHead = peerHeadPattern(policy);
      for (const [peerId, peer] of peers) {
        const legacy = plainObject(peer) && typeof peer.head === 'string' && requiredHead.test(peer.head);
        const bounded = plainObject(peer) && Array.isArray(peer.heads) && peer.heads.length > 0
          && peer.heads.every(item => plainObject(item) && filled(item.alias) && fullHeadPattern.test(item.head));
        if (!legacy && !bounded) errors.push(`state.json: ${mode} completion requires a recorded peer head or repository head set for ${peerId || '<empty>'}`);
      }
    }
  }
  return errors;
}
