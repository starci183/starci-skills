import { readDistJson } from '../core/runtime-root.mjs';

export const SDS_SCHEMA = 'starci/specification@3';
export const sdsSchema = readDistJson('specifications', 'sds.schema.json');
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);

// Deliberately only the JSON Schema vocabulary used by the published SDS schema.
// Unsupported keywords in a future schema require implementation and regression tests.
function shape(value, schema, at, errors) {
  if (schema.$ref) return shape(value, schema.$ref.slice(2).split('/').reduce((v, k) => v[k], sdsSchema), at, errors);
  const fail = message => errors.push(`${at}: ${message}`);
  if(schema.oneOf){const attempts=schema.oneOf.map(branch=>{const branchErrors=[];shape(value,branch,at,branchErrors);return branchErrors;});if(attempts.filter(x=>!x.length).length!==1)fail('must match exactly one supported shape');return;}
  for (const branch of schema.allOf ?? []) shape(value, branch, at, errors);
  if (schema.if) { const probe = []; shape(value, schema.if, at, probe); if (!probe.length && schema.then) shape(value, schema.then, at, errors); }
  if (schema.const !== undefined && value !== schema.const) fail('constant differs');
  if (schema.enum && !schema.enum.includes(value)) fail('unsupported value');
  if (schema.type && !(schema.type === 'object' ? object(value) : schema.type === 'array' ? Array.isArray(value) : typeof value === schema.type)) { fail(`expected ${schema.type}`); return; }
  if (typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) fail('empty text');
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) fail('invalid text');
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) fail('items required');
    if (schema.uniqueItems && new Set(value.map(x => JSON.stringify(x))).size !== value.length) fail('duplicate items');
    if (schema.items) value.forEach((x, i) => shape(x, schema.items, `${at}[${i}]`, errors));
  }
  if (object(value)) {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) fail(`missing ${key}`);
    for (const [key, val] of Object.entries(value)) {
      if (schema.properties?.[key]) shape(val, schema.properties[key], `${at}.${key}`, errors);
      else if (schema.additionalProperties === false) fail(`unexpected ${key}`);
    }
  }
}

export function validateSDS(spec) {
  const errors = [];
  shape(spec, sdsSchema, 'SDS', errors);
  if (errors.length) return {ok: false, errors};
  const unique = (rows, key, at) => {
    const seen = new Set();
    for (const row of rows) {
      if (seen.has(row[key])) errors.push(`${at}: duplicate ${key} ${row[key]}`);
      seen.add(row[key]);
      if (typeof row[key] === 'string' && row[key].includes('#')) errors.push(`${at}: # is reserved for cross-node references`);
    }
  };
  for (const name of ['views', 'decisions', 'checks', 'references']) unique(spec[name], 'id', name);
  for (const name of ['businessRefs', 'designRefs']) unique(spec[name], 'nodeId', name);
  const views = new Map(spec.views.map(v => [v.id, v]));
  const imported = new Set(spec.designRefs.flatMap(r => (r.viewIds??r.items.map(x=>x.id)).map(id => `${r.nodeId}#${id}`)));
  const businessIds = field => new Set(spec.businessRefs.flatMap(r => r[field].map(id => `${r.nodeId}#${id}`)));
  const checkRef = (id, kinds, at) => {
    if (imported.has(id)) return; // Owner and view kind are checked by workspace resolution below.
    const view = views.get(id);
    if (!view || (kinds && !kinds.includes(view.kind))) errors.push(`${at}: unresolved/wrong-kind design reference ${id}`);
  };
  const flowIds = businessIds('flowIds'), acceptanceIds = businessIds('acceptanceIds');
  const checkIds = new Set(spec.checks.map(c => c.id));
  for (const view of spec.views) {
    shape(view.content, sdsSchema.$defs[view.kind], view.id, errors);
    if (errors.length) continue;
    for (const ref of designEdges(view)) checkRef(ref.id, ref.kinds, view.id);
    const c = view.content;
    if (view.kind === 'runtime') {
      unique(c.steps, 'id', view.id);
      for (const id of c.businessFlowRefs) if (!flowIds.has(id)) errors.push(`${view.id}: undeclared Business flow ${id}`);
      for (const step of c.steps) if (!c.participants.includes(step.owner)) errors.push(`${view.id}: step owner not in participants`);
    }
    if (view.kind === 'concerns') for (const scenario of c.scenarios) for (const id of scenario.checkIds) if (!checkIds.has(id)) errors.push(`${view.id}: missing design check ${id}`);
  }
  for (const decision of spec.decisions) {
    decision.appliesTo.forEach(id => checkRef(id, null, decision.id));
    for (const id of decision.referenceIds) if (!spec.references.some(r => r.id === id)) errors.push(`${decision.id}: missing pattern/design reference ${id}`);
    if (spec.status === 'pass' && decision.blocking && decision.status !== 'accepted') errors.push(`${decision.id}: unresolved blocking decision`);
  }
  for (const check of spec.checks) for (const id of check.businessAcceptanceRefs) if (!acceptanceIds.has(id)) errors.push(`${check.id}: undeclared Business acceptance ${id}`);
  return {ok: errors.length === 0, errors};
}

function designEdges(view) {
  const c = view.content, edges = [];
  const add = (ids, kinds) => ids.forEach(id => edges.push({id, kinds}));
  if (view.kind === 'structure') add(c.dependencies, ['structure']);
  if (view.kind === 'contracts') add([c.caller, c.receiver], ['structure']);
  if (view.kind === 'data') add([c.owner], ['structure']);
  if (view.kind === 'runtime') {
    add(c.participants, ['structure']);
    for (const step of c.steps) { add([step.owner], ['structure']); add(step.contractRefs, ['contracts']); add(step.dataRefs, ['data']); }
  }
  if (view.kind === 'deployment') {
    add(c.connections, ['contracts']);
    for (const p of c.placements) { add([p.component], ['structure']); add(p.stores, ['data']); }
  }
  return edges;
}

/** Resolve only explicitly declared canonical Work owners; never inspect source code. */
export function validateSDSBindings(spec, {nodes, allowedNodeIds}) {
  const errors = [], find = id => nodes.find(n => n.meta.id === id);
  for (const ref of spec.businessRefs) {
    const node = find(ref.nodeId), business = node?.meta.extensions?.work3?.specification;
    if (!allowedNodeIds.has(ref.nodeId) || node?.meta.kind !== 'business' || business?.op !== 'business.decide') { errors.push(`Unbound Business owner ${ref.nodeId}`); continue; }
    for (const [field, section] of [['requirementIds', 'requirements'], ['flowIds', 'flows'], ['acceptanceIds', 'acceptance']]) {
      for (const id of ref[field]) if (!business[section]?.some(row => row.id === id)) errors.push(`Missing Business ${section} ${ref.nodeId}#${id}`);
    }
    for (const id of ref.requirementIds) {
      const requirement = business.requirements?.find(r => r.id === id);
      if (requirement && !requirement.acceptanceIds?.some(ac => ref.acceptanceIds.includes(ac))) errors.push(`Business requirement has no selected acceptance: ${ref.nodeId}#${id}`);
      if (requirement?.kind === 'FR' && !business.flows?.some(f => ref.flowIds.includes(f.id) && f.requirementIds?.includes(id))) errors.push(`Business FR has no selected flow: ${ref.nodeId}#${id}`);
    }
    for (const id of ref.acceptanceIds) {
      const ac = business.acceptance?.find(a => a.id === id);
      if (ac && !ac.requirementIds?.some(r => ref.requirementIds.includes(r))) errors.push(`Unrelated Business acceptance: ${ref.nodeId}#${id}`);
    }
    if (spec.status === 'pass' && business.status !== 'pass') errors.push(`Business input not accepted: ${ref.nodeId}`);
  }
  const imported = new Map();
  for (const ref of spec.designRefs) {
    const node = find(ref.nodeId), design = node?.meta.extensions?.work3?.specification;
    if(ref.schema==='starci/sds@4'){
      if(!allowedNodeIds.has(ref.nodeId)||node?.meta.kind!=='architecture'||design?.schema!=='starci/sds@4'){errors.push(`Unbound SDS@4 owner ${ref.nodeId}`);continue;}
      const reverse={structure:'code-unit',contracts:'contract',data:'data'};
      for(const item of ref.items){if(design.id!==item.id||design.nodeType!==reverse[item.kind])errors.push(`Missing/wrong-kind SDS@4 item ${ref.nodeId}#${item.id}`);else imported.set(`${ref.nodeId}#${item.id}`,{kind:item.kind});}
      if(spec.status==='pass'&&design.status!=='pass')errors.push(`Shared design not accepted: ${ref.nodeId}`);
    }else{
      if (!allowedNodeIds.has(ref.nodeId) || node?.meta.kind !== 'architecture' || design?.schema !== SDS_SCHEMA) { errors.push(`Unbound SDS owner ${ref.nodeId}`); continue; }
      for (const id of ref.viewIds) {const view = design.views.find(v => v.id === id);if (!view) errors.push(`Missing SDS view ${ref.nodeId}#${id}`);else imported.set(`${ref.nodeId}#${id}`, view);}
      if (spec.status === 'pass' && design.status !== 'pass') errors.push(`Shared design not accepted: ${ref.nodeId}`);
    }
  }
  for (const view of spec.views) for (const ref of designEdges(view)) {
    if (ref.id.includes('#') && (!imported.has(ref.id) || !ref.kinds.includes(imported.get(ref.id).kind))) errors.push(`Wrong-kind imported SDS view ${ref.id}`);
  }
  return errors;
}
