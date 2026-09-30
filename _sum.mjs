import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const by = {};
for (const v of r.violations) (by[v.ruleId] ??= []).push(v);
for (const [k, v] of Object.entries(by)) console.log(k, v.length, v.slice(0, 3).map(x => `${x.path}: ${x.message.slice(0, 170)}`).join(' || '));
console.log('errors', JSON.stringify(r.errors).slice(0, 1500));
