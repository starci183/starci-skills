// Lane v5-4 classification experiment: snapshot the measures that a sonar-project.properties
// scope change can move, so variants are compared on numbers rather than on expectation.
const { readFileSync } = require('node:fs');
const HOST = 'https://sonar.starci.org';
const DIR = 'D:/Repositories/starci-academy-backend/.stacks/dev/runtime/files';
const tok = readFileSync(`${DIR}/sonarqube-admin-token.key`, 'utf8').trim();

const KEY = { 'todo-be': 'starci-todo-app-backend', 'ec-be': 'starci-ecommerce-app-be' };
const METRICS =
  'vulnerabilities,security_rating,reliability_rating,code_smells,bugs,coverage,ncloc,' +
  'duplicated_lines_density,security_hotspots,tests,test_errors,sqale_index';

async function get(path) {
  const res = await fetch(`${HOST}${path}`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!res.ok) return { __error: `HTTP ${res.status}` };
  return res.json();
}

(async () => {
  const app = process.argv[2] || 'ec-be';
  const label = process.argv[3] || '';
  const key = KEY[app];
  const m = await get(`/api/measures/component?component=${key}&metricKeys=${METRICS}`);
  const values = new Map(
    (m.component?.measures || []).map((x) => [x.metric, x.value]),
  );
  console.log(`### ${app} ${label}`);
  for (const metric of METRICS.split(',')) {
    console.log(`  ${metric}=${values.get(metric) ?? '-'}`);
  }
  const v = await get(
    `/api/issues/search?componentKeys=${key}&resolved=false&types=VULNERABILITY&ps=100`,
  );
  console.log(`  vulnerabilities open=${v.paging?.total}`);
  for (const it of v.issues || []) {
    const file = (v.components.find((c) => c.key === it.component) || {}).longName || it.component;
    console.log(`    ${it.rule} ${file}:${it.line || '-'} ${it.severity}`);
  }
  const g = await get(`/api/qualitygates/project_status?projectKey=${key}`);
  const ps = g.projectStatus || {};
  console.log(`  gate=${ps.status}`);
  for (const c of ps.conditions || []) console.log(`    ${c.metricKey} ${c.comparator} ${c.errorThreshold} actual=${c.actualValue} -> ${c.status}`);
  console.log('');
})();
