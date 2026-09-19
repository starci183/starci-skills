const { readFileSync } = require('node:fs');
const HOST = 'https://sonar.starci.org';
const DIR = 'D:/Repositories/starci-academy-backend/.stacks/dev/runtime/files';
const tok = readFileSync(`${DIR}/sonarqube-admin-token.key`, 'utf8').trim();
const id = process.argv[2];
(async () => {
  for (const p of [`/api/ce/task?taskId=${id}`, `/api/ce/task?task=${id}`, `/api/ce/component?component=starci-ecommerce-app-be`]) {
    const r = await fetch(`${HOST}${p}`, { headers: { Authorization: `Bearer ${tok}` } });
    console.log(`\n$ ${p.slice(0, 40)} -> HTTP ${r.status}`);
    console.log((await r.text()).slice(0, 600));
  }
})();
