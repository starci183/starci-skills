const { readFileSync } = require('node:fs');
const HOST = 'https://sonar.starci.org';
const DIR = 'D:/Repositories/starci-academy-backend/.stacks/dev/runtime/files';
const tok = readFileSync(`${DIR}/sonarqube-admin-token.key`, 'utf8').trim();
(async () => {
  for (const key of ['starci-todo-app-backend', 'starci-ecommerce-app-be']) {
    const res = await fetch(`${HOST}/api/components/show?component=${key}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const json = await res.json();
    const c = json.component || {};
    console.log(`${key}: analysisDate=${c.analysisDate} version=${c.version} ncloc=?`);
    const m = await fetch(
      `${HOST}/api/measures/component?component=${key}&metricKeys=ncloc,security_rating,vulnerabilities,bugs,code_smells,coverage`,
      { headers: { Authorization: `Bearer ${tok}` } },
    );
    const mj = await m.json();
    console.log('  ' + (mj.component?.measures || []).map((x) => `${x.metric}=${x.value}`).join(' '));
  }
})();
