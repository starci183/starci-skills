const fail = message => { throw new Error(message); };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
function shape(x, required, optional = []) {
  if (!object(x) || required.some(k => !Object.hasOwn(x, k)) || Object.keys(x).some(k => ![...required, ...optional].includes(k))) fail(`Invalid fields; expected ${required.join(', ')}`);
}
function string(x) { if (typeof x !== 'string' || !x.trim()) fail('Expected nonempty string'); }
function array(x, min = 0) { if (!Array.isArray(x) || x.length < min) fail('Invalid array'); }
function strings(x, min = 0) { array(x, min); x.forEach(string); }
function unique(x) { if (new Set(x).size !== x.length) fail('Duplicate identity'); }
function member(x, values) { if (!values.includes(x)) fail(`Invalid value: ${x}`); }

function checkDefinitions(checks) {
  array(checks); unique(checks.map(x => x.id));
  for (const x of checks) { shape(x, ['id', 'question', 'expected']); string(x.id); string(x.question); member(x.expected, ['yes', 'no']); }
}
function flow(x, implemented) {
  shape(x, ['id', 'title', 'entry', 'actor', 'preconditions', 'steps', 'cleanup', ...(implemented ? ['sourcePaths'] : [])]);
  ['id', 'title', 'entry', 'actor'].forEach(k => string(x[k]));
  strings(x.preconditions); strings(x.cleanup, 1);
  if (implemented) strings(x.sourcePaths, 1);
  array(x.steps, 1); unique(x.steps.map(s => s.id));
  for (const s of x.steps) { shape(s, ['id', 'action', 'expected', 'uxChecks']); ['id', 'action', 'expected'].forEach(k => string(s[k])); checkDefinitions(s.uxChecks); }
}
function flows(xs, implemented) { array(xs, 1); unique(xs.map(x => x.id)); xs.forEach(x => flow(x, implemented)); }

export function validateJourneys(value, { implemented = false, allowEmpty = false } = {}) {
  if (allowEmpty && Array.isArray(value) && value.length === 0) return true;
  flows(value, implemented);
  return true;
}
