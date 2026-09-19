import fs from 'node:fs';
const oldId = 'ac.plan.caps.limit.refuses-over-cap';
const esc = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const re = new RegExp(`(^|\\n)(\\s*(?:-\\s*)?id:[ \\t]*)${esc}(?=[ \\t]*\\n|$)`, 'g');
const t = fs.readFileSync('examples/todo-app-backend/.starciwork/features/plan/uat/upgrade-after-cap/runs/20260919T143402Z-5c10a673/manifest.yaml', 'utf8');
const matches = t.match(new RegExp(`(^|\\n)(\\s*(?:-\\s*)?id:[ \\t]*)${esc.replaceAll('.', '\\.')}(?=[ \\t]*\\n|$)`, 'g'));
console.log('id-pattern matches in current file:', matches);
const listRe = new RegExp(`(^|\\n)(\\s*-[ \\t]*)${esc}(?=[ \\t]*\\n|$)`, 'g');
console.log('list-pattern matches:', t.match(listRe));
