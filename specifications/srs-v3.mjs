// Compatibility reader for pre-upstream leaves. New authoring uses srs-sections.mjs.
export const SRS_V3_SCHEMA = 'starci/srs@3';

const text = value => typeof value === 'string' && value.trim().length > 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, fields, at, errors) => {
  if (!object(value)) { errors.push(`${at}: object required`); return false; }
  const actual = Object.keys(value);
  for (const field of fields) if (!Object.hasOwn(value, field)) errors.push(`${at}: missing ${field}`);
  for (const field of actual) if (!fields.includes(field)) errors.push(`${at}: unexpected ${field}`);
  return true;
};
const texts = (value, at, errors, required = true) => {
  if (!Array.isArray(value) || (required && !value.length) || value.some(item => !text(item))) errors.push(`${at}: ${required ? 'nonempty ' : ''}text array required`);
};
const unique = (rows, at, errors) => {
  const seen = new Set();
  for (const row of rows ?? []) {
    if (!text(row?.id) || seen.has(row.id) || row.id.includes('#')) errors.push(`${at}: stable unique id required`);
    seen.add(row?.id);
  }
};

const common = ['schema','op','status','id','nodeType','name','summary','refs','content'];
const contentFields = {
  'functional-requirement': ['goal','source','actors','trigger','preconditions','inputs','flowId','mainFlow','alternativeFlows','exceptionFlows','branchReview','postconditions','businessRuleRefs','nfrRefs','acceptanceCriteria'],
  'non-functional-requirement': ['statement','rationale','source','scope','measurement','target','acceptanceRefs'],
  'business-rule': ['statement','rationale','source','appliesTo','conditions','outcomes'],
  data: ['meaning','owner','classification','attributes','validations','states','transitions','lifecycle'],
  'customer-journey': ['actor','goal','context','start','preconditions','stages','significantPaths','end','outcomeCriteria']
};

export function validateSRSV3(spec) {
  const errors = [];
  if (!exact(spec, common, 'SRS', errors)) return {ok:false, errors};
  if (spec.schema !== SRS_V3_SCHEMA) errors.push('SRS.schema: expected starci/srs@3');
  if (spec.op !== 'business.decide') errors.push('SRS.op: expected business.decide');
  if (!['draft','blocked','pass'].includes(spec.status)) errors.push('SRS.status: unsupported value');
  if (!text(spec.id) || spec.id.includes('#') || !text(spec.name) || !text(spec.summary)) errors.push('SRS: stable id, name and summary required');
  if (!Object.hasOwn(contentFields, spec.nodeType)) errors.push('SRS.nodeType: unsupported value');
  if (!Array.isArray(spec.refs)) errors.push('SRS.refs: array required');
  for (const [index, ref] of (spec.refs ?? []).entries()) {
    if (!exact(ref, ['type','nodeId','itemId'], `SRS.refs[${index}]`, errors)) continue;
    if (!['functional-requirement','non-functional-requirement','business-rule','data','customer-journey','acceptance','flow','branch'].includes(ref.type) || !text(ref.nodeId) || !text(ref.itemId)) errors.push(`SRS.refs[${index}]: typed resolvable reference required`);
  }
  const fields = contentFields[spec.nodeType];
  if (!fields || !exact(spec.content, fields, `${spec.id}.content`, errors)) return {ok:errors.length===0, errors};
  const c = spec.content;
  if (spec.nodeType === 'functional-requirement') validateFR(spec, c, errors);
  if (spec.nodeType === 'non-functional-requirement') validateNFR(c, errors);
  if (spec.nodeType === 'business-rule') {
    for (const key of ['statement','rationale']) if (!text(c[key])) errors.push(`${spec.id}.${key}: text required`);
    validateSource(c.source, errors); texts(c.appliesTo, `${spec.id}.appliesTo`, errors); texts(c.conditions, `${spec.id}.conditions`, errors); texts(c.outcomes, `${spec.id}.outcomes`, errors);
  }
  if (spec.nodeType === 'data') validateData(c, errors);
  if (spec.nodeType === 'customer-journey') validateJourney(c, errors);
  if (spec.status === 'pass') {
    if (Object.hasOwn(c,'source') && c.source?.acceptance !== 'accepted') errors.push(`${spec.id}: pass requires accepted requirement source`);
    if (spec.nodeType === 'non-functional-requirement' && c.target.status === 'undecided') errors.push(`${spec.id}: undecided NFR target cannot pass`);
  }
  return {ok:errors.length===0, errors};
}

function validateSource(source, errors) {
  if (!exact(source, ['authority','origin','scope','acceptance'], 'source', errors)) return;
  if (![source.authority,source.origin,source.scope].every(text) || !['proposed','accepted','rejected','undecided'].includes(source.acceptance)) errors.push('source: authority, origin, scope and honest acceptance required');
}
function validateFR(spec, c, errors) {
  if (![c.goal,c.trigger,c.flowId].every(text)) errors.push(`${spec.id}: goal, trigger and stable flowId required`);
  validateSource(c.source, errors); texts(c.actors, `${spec.id}.actors`, errors); texts(c.preconditions, `${spec.id}.preconditions`, errors); texts(c.inputs, `${spec.id}.inputs`, errors);
  texts(c.postconditions, `${spec.id}.postconditions`, errors); texts(c.businessRuleRefs, `${spec.id}.businessRuleRefs`, errors, false); texts(c.nfrRefs, `${spec.id}.nfrRefs`, errors, false);
  validateSteps(c.mainFlow, `${spec.id}.mainFlow`, errors); unique(c.mainFlow, `${spec.id}.mainFlow`, errors);
  const main = new Set(c.mainFlow?.map(step => step.id)); const branches = [];
  for (const key of ['alternativeFlows','exceptionFlows']) {
    if (!Array.isArray(c[key])) errors.push(`${spec.id}.${key}: array required`);
    if (!c[key]?.length && !text(c.branchReview?.[key])) errors.push(`${spec.id}.${key}: branch or applicability rationale required`);
    for (const branch of c[key] ?? []) {
      branches.push(branch);
      if (!exact(branch, ['id','fromStep','condition','steps','resumeAt','end','postconditions','acceptanceIds'], `${spec.id}.${key}`, errors)) continue;
      if (!main.has(branch.fromStep) || !(branch.resumeAt === 'end' || main.has(branch.resumeAt))) errors.push(`${branch.id}: fromStep/resumeAt must resolve`);
      if (!text(branch.condition) || !text(branch.end)) errors.push(`${branch.id}: condition and explicit end required`);
      validateSteps(branch.steps, branch.id, errors); texts(branch.postconditions, `${branch.id}.postconditions`, errors); texts(branch.acceptanceIds, `${branch.id}.acceptanceIds`, errors);
    }
  }
  if (!exact(c.branchReview, ['alternativeFlows','exceptionFlows'], `${spec.id}.branchReview`, errors)) return;
  unique(branches, `${spec.id}.branches`, errors);
  if (!Array.isArray(c.acceptanceCriteria) || !c.acceptanceCriteria.length) errors.push(`${spec.id}.acceptanceCriteria: required`);
  unique(c.acceptanceCriteria, `${spec.id}.acceptanceCriteria`, errors);
  const branchIds = new Set(branches.map(branch => branch.id));
  for (const ac of c.acceptanceCriteria ?? []) {
    if (!exact(ac, ['id','given','when','then','flowRef','branchRef'], `${spec.id}.acceptance`, errors)) continue;
    if (![ac.given,ac.when,ac.then].every(text) || ac.flowRef !== c.flowId || !(ac.branchRef === 'main' || branchIds.has(ac.branchRef))) errors.push(`${ac.id}: Given/When/Then and local flow/branch link required`);
  }
  const acIds = new Set(c.acceptanceCriteria?.map(ac => ac.id));
  for (const step of c.mainFlow ?? []) for (const id of step.acceptanceIds ?? []) if (!acIds.has(id)) errors.push(`${step.id}: missing acceptance ${id}`);
  for (const branch of branches) for (const id of branch.acceptanceIds ?? []) if (!acIds.has(id)) errors.push(`${branch.id}: missing acceptance ${id}`);
  for (const branch of branches) for (const step of branch.steps ?? []) for (const id of step.acceptanceIds ?? []) if (!acIds.has(id)) errors.push(`${step.id}: missing acceptance ${id}`);
  for (const branch of branches) for (const id of branch.acceptanceIds ?? []) if (c.acceptanceCriteria.find(ac => ac.id === id)?.branchRef !== branch.id) errors.push(`${branch.id}: acceptance ${id} must link back to its owning branch`);
  for (const step of c.mainFlow ?? []) if (!step.acceptanceIds?.some(id => c.acceptanceCriteria.some(ac => ac.id === id && ac.branchRef === 'main'))) errors.push(`${step.id}: main step needs linked main-flow acceptance`);
}
function validateSteps(steps, at, errors) {
  if (!Array.isArray(steps) || !steps.length) { errors.push(`${at}: ordered steps required`); return; }
  for (const step of steps) {
    if (!exact(step, ['id','actor','action','systemResponse','guard','stateEffect','acceptanceIds'], at, errors)) continue;
    if (![step.id,step.actor,step.action,step.systemResponse,step.guard,step.stateEffect].every(text)) errors.push(`${at}: complete step fields required`);
    texts(step.acceptanceIds, `${step.id}.acceptanceIds`, errors, false);
  }
}
function validateNFR(c, errors) {
  for (const key of ['statement','rationale']) if (!text(c[key])) errors.push(`NFR.${key}: text required`);
  validateSource(c.source, errors);
  if (!exact(c.scope, ['kind','refs','rationale'], 'NFR.scope', errors) || !['product','selected'].includes(c.scope?.kind) || !Array.isArray(c.scope?.refs) || !text(c.scope?.rationale)) errors.push('NFR.scope: product/selected scope and rationale required');
  if (!exact(c.measurement, ['method','conditions','evaluation'], 'NFR.measurement', errors) || ![c.measurement?.method,c.measurement?.conditions,c.measurement?.evaluation].every(text)) errors.push('NFR.measurement: complete verification method required');
  if (!exact(c.target, ['status','value','decisionOwner','missingDecision'], 'NFR.target', errors) || !['decided','undecided'].includes(c.target?.status)) errors.push('NFR.target: decided/undecided required');
  if (c.target?.status === 'decided' ? !text(c.target.value) : !text(c.target?.decisionOwner) || !text(c.target?.missingDecision)) errors.push('NFR.target: decided value or honest missing decision/owner required');
  texts(c.acceptanceRefs, 'NFR.acceptanceRefs', errors);
}
function validateData(c, errors) {
  if (![c.meaning,c.owner,c.classification,c.lifecycle].every(text)) errors.push('data: meaning, owner, classification and lifecycle required');
  for (const key of ['attributes','transitions']) { if (!Array.isArray(c[key]) || !c[key].length) errors.push(`data.${key}: required`); unique(c[key], `data.${key}`, errors); }
  texts(c.validations, 'data.validations', errors); texts(c.states, 'data.states', errors);
  for (const a of c.attributes ?? []) if (!exact(a,['id','meaning','type','validation','sensitivity'],'data.attribute',errors) || ![a.id,a.meaning,a.type,a.validation,a.sensitivity].every(text)) errors.push('data.attribute: complete definition required');
  for (const t of c.transitions ?? []) if (!exact(t,['id','from','to','trigger','ruleRefs'],'data.transition',errors) || !c.states?.includes(t.from) || !c.states?.includes(t.to) || !text(t.trigger) || !Array.isArray(t.ruleRefs)) errors.push('data.transition: states, trigger and rule refs required');
}
function validateJourney(c, errors) {
  for (const key of ['actor','goal','context','start','end']) if (!text(c[key])) errors.push(`journey.${key}: text required`);
  texts(c.preconditions,'journey.preconditions',errors); texts(c.outcomeCriteria,'journey.outcomeCriteria',errors);
  if (!Array.isArray(c.stages) || !c.stages.length) errors.push('journey.stages: required'); unique(c.stages,'journey.stages',errors);
  for (const stage of c.stages ?? []) if (!exact(stage,['id','actorAction','touchpoint','observableResponse','outcome','functionalRequirementRef','flowRef','nfrRefs'],'journey.stage',errors) || ![stage.actorAction,stage.touchpoint,stage.observableResponse,stage.outcome,stage.functionalRequirementRef,stage.flowRef].every(text) || !Array.isArray(stage.nfrRefs)) errors.push('journey.stage: observable stage and SRS refs required');
  if (!Array.isArray(c.significantPaths)) errors.push('journey.significantPaths: array required');
  for (const route of c.significantPaths ?? []) if (!exact(route,['condition','branchRef','observableOutcome'],'journey.path',errors) || ![route.condition,route.branchRef,route.observableOutcome].every(text)) errors.push('journey.path: reference FR branch, do not clone it');
}

export function validateSRSV3Bindings(spec, {nodes, allowedNodeIds}) {
  return validateTypedBindings(spec, {nodes, allowedNodeIds, schema:SRS_V3_SCHEMA, ownerKind:'business'});
}

export function validateTypedBindings(spec, {nodes, allowedNodeIds, schema, ownerKind}) {
  const errors = [];
  for (const ref of spec.refs ?? []) {
    const node = nodes.find(candidate => candidate.meta.id === ref.nodeId);
    const target = node?.meta.extensions?.work3?.specification;
    if (!allowedNodeIds.has(ref.nodeId) || node?.meta.kind !== ownerKind || target?.schema !== schema) errors.push(`Unbound ${schema} owner ${ref.nodeId}`);
    else { let found=target.id===ref.itemId&&target.nodeType===ref.type; if(schema===SRS_V3_SCHEMA&&ref.type==='flow')found=target.nodeType==='functional-requirement'&&target.content.flowId===ref.itemId; if(ref.type==='acceptance')found=target.nodeType==='functional-requirement'&&target.content.acceptanceCriteria?.some(x=>x.id===ref.itemId); if(ref.type==='branch')found=target.nodeType==='functional-requirement'&&[...target.content.alternativeFlows??[],...target.content.exceptionFlows??[]].some(x=>x.id===ref.itemId); if(!found)errors.push(`Missing/wrong-kind ${ref.type} ${ref.nodeId}#${ref.itemId}`); }
  }
  return errors;
}
