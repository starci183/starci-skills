const { readFileSync } = require('node:fs');
const HOST = 'https://sonar.starci.org';
const DIR = 'D:/Repositories/starci-academy-backend/.stacks/dev/runtime/files';
const tok = readFileSync(`${DIR}/sonarqube-admin-token.key`, 'utf8').trim();

async function get(path) {
  const res = await fetch(`${HOST}${path}`, { headers: { Authorization: `Bearer ${tok}` } });
  const body = await res.text();
  console.log(`\n$ ${path}`);
  if (!res.ok) return console.log(`  HTTP ${res.status} ${body.slice(0, 200)}`);
  return JSON.parse(body);
}

(async () => {
  const f = await get(
    '/api/issues/search?resolved=false&types=VULNERABILITY&ps=1&facets=projects,severities,rules',
  );
  if (f) {
    console.log('  total(all projects) =', f.paging.total);
    for (const facet of f.facets) {
      console.log(`  facet ${facet.property}:`);
      for (const v of facet.values) console.log(`    ${v.val} -> ${v.count}`);
    }
  }
  for (const key of ['starci-todo-app-backend', 'starci-ecommerce-app-be']) {
    const a = await get(`/api/issues/search?componentKeys=${key}&resolved=false&types=VULNERABILITY&ps=1`);
    if (a) console.log(`  componentKeys=${key} -> total=${a.paging.total}`, a.issues[0]?.component);
    const b = await get(`/api/issues/search?componentKeys=${key}:src&resolved=false&types=VULNERABILITY&ps=1`);
    if (b) console.log(`  componentKeys=${key}:src -> total=${b.paging.total}`, b.issues[0]?.component);
  }
})();
