// Lane v5-4: attribute the failing new-code gate conditions to concrete files, and read the
// post-scan security measures. Read-only; uses the admin user token (project tokens are refused
// on some endpoints).
const { readFileSync } = require('node:fs');
const HOST = 'https://sonar.starci.org';
const DIR = 'D:/Repositories/starci-academy-backend/.stacks/dev/runtime/files';
const tok = readFileSync(`${DIR}/sonarqube-admin-token.key`, 'utf8').trim();

const PROJECTS = {
  'todo-be': 'starci-todo-app-backend',
  'ec-be': 'starci-ecommerce-app-be',
};

async function get(path) {
  const res = await fetch(`${HOST}${path}`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!res.ok) return { __error: `HTTP ${res.status} ${(await res.text()).slice(0, 160)}` };
  return res.json();
}

(async () => {
  for (const [app, key] of Object.entries(PROJECTS)) {
    console.log(`\n########## ${app} (${key}) ##########`);
    const m = await get(
      `/api/measures/component?component=${key}&metricKeys=vulnerabilities,security_rating,reliability_rating,coverage,new_coverage,security_hotspots,new_violations,code_smells,ncloc,duplicated_lines_density,new_duplicated_lines_density`,
    );
    if (m.__error) console.log('measures: ' + m.__error);
    else
      console.log(
        m.component.measures.map((x) => `${x.metric}=${x.value}`).join('\n  '),
      );

    // The gate counts conditions, not issues: list the actual new-code issues behind them.
    const nu = await get(
      `/api/issues/search?componentKeys=${key}&branch=main&inNewCodePeriod=true&resolved=false&ps=100&facets=types,files,rules`,
    );
    if (nu.__error) console.log('new issues: ' + nu.__error);
    else {
      console.log(`  new-code open issues total=${nu.paging.total}`);
      for (const f of nu.facets || []) {
        if (f.property !== 'types') continue;
        console.log(
          '  by type: ' + f.values.filter((v) => v.count).map((v) => `${v.val}=${v.count}`).join(' '),
        );
      }
      const issues = nu.issues || [];
      const byFile = new Map();
      for (const it of issues) {
        const file = (nu.components.find((c) => c.key === it.component) || {}).longName || it.component;
        const k = `${file}`;
        byFile.set(k, (byFile.get(k) || 0) + 1);
      }
      console.log('  new-code issues by file:');
      for (const [file, n] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`    ${String(n).padStart(3)}  ${file}`);
      }
      console.log('  rule/severity detail:');
      for (const it of issues) {
        const file = (nu.components.find((c) => c.key === it.component) || {}).longName || it.component;
        console.log(`    ${it.type}/${it.severity} ${it.rule} ${file}:${it.line || '-'}`);
      }
    }
  }
})();
