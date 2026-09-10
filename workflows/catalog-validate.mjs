const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys, optional = []) => plain(x) && keys.every(k => Object.hasOwn(x, k)) && Object.keys(x).every(k => [...keys, ...optional].includes(k));

/** Structural catalog checks only; safe to import during source builds before `.dist` exists. */
export function validateWorkflowCatalog(catalog, jobs, frontend) {
  const errors = [];
  const skillOk = catalog?.skill === '../SKILL.md' || catalog?.skill === '../../SKILL.md';
  if (!exact(catalog, ['schema', 'skill', 'gates', 'fallback', 'readOnly', 'unknownExplicitWorkflow', 'limits', 'workflows']) || catalog.gates !== 'gates.json' || catalog.schema !== 'starci/workflow-catalog@1' || !skillOk || catalog.fallback !== 'none' || catalog.readOnly !== 'answer-or-inspect' || catalog.unknownExplicitWorkflow !== 'error' || !Array.isArray(catalog.workflows)) return { ok: false, errors: ['Invalid workflow catalog'] };
  if (!exact(catalog.limits, ['rows', 'columns', 'secondaryDefinitions']) || Object.values(catalog.limits).some(n => n !== 3)) errors.push('Invalid limits');
  const expected = new Set([frontend.id, ...jobs.workflows.map(w => w.id)]), ids = new Set(), intents = new Set();
  for (const row of catalog.workflows) {
    if (!exact(row, ['id', 'intent', 'when', 'definition', 'execution']) || Object.values(row).some(x => typeof x !== 'string' || !x.trim())) { errors.push('Invalid workflow entry'); continue; }
    if (ids.has(row.id) || intents.has(row.intent) || !expected.has(row.id)) errors.push('Duplicate or unknown workflow');
    ids.add(row.id); intents.add(row.intent);
    const isFrontend = row.id === frontend.id; if (row.definition !== (isFrontend ? 'frontend.json' : 'jobs.json') || row.execution !== (isFrontend ? 'frontend-gate' : row.id === 'analyze-request' ? 'read-only-analysis' : 'explicit-coordinator')) errors.push('Wrong workflow source or execution claim');
  }
  if (ids.size !== expected.size || [...expected].some(id => !ids.has(id))) errors.push('Incomplete workflow discovery');
  return { ok: errors.length === 0, errors };
}
