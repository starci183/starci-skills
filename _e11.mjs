import fs from 'node:fs';
const p = 'tests/architecture-clones.spec.mjs';
let s = fs.readFileSync(p, 'utf8');
const a = "  assert.match(hits[0].message, /apps\/web\/src\/modules\/<capability>\/ \(pure\) or apps\/web\/src\/hooks\/<domain>\/ \(React hook\)/);";
if (!s.includes(a)) throw Error('a');
s = s.replace(a, "  assert.match(hits[0].message, /apps\/<app>\/src\/modules\/<capability>\/ when pure, apps\/<app>\/src\/hooks\/<domain>\/ for a React hook/);");
fs.writeFileSync(p, s);
