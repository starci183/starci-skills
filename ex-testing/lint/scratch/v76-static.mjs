import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';
import {walk} from '../../../scripts/check-example-work.mjs';

const root = path.resolve('.');
const workRoot = path.join(root, 'examples/todo-app-backend/.starciwork');
const BE = path.join(root, 'examples/todo-app-backend');
const FE = path.join(root, 'examples/todo-app-frontend');

const inv = JSON.parse(fs.readFileSync(path.join(root, 'ex-testing/lint/scratch/v76-inv.json'), 'utf8'));
const targets = inv.files.filter(f => !f.staleFlag && (f.recordDigestMismatch || f.codeDigestMismatch));

// --- source index for -t name-filter checks -----------------------------------
function sourceIndex(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceIndex(abs));
    else if (/\.(ts|tsx|js|cjs|mjs)$/.test(entry.name)) out.push({abs, rel: path.relative(dir, abs).replaceAll('\\', '/'), text: fs.readFileSync(abs, 'utf8')});
  }
  return out;
}
const beSrc = sourceIndex(path.join(BE, 'src'));
const feSrc = sourceIndex(path.join(FE, 'src'));

const scriptsOf = dir => {
  try { return Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).scripts ?? {}); } catch { return []; }
};
const beScripts = new Set(scriptsOf(BE));
const feScripts = new Set(scriptsOf(FE));

function cwdFor(node, command) {
  const recordDir = path.join(workRoot, node);
  if (/^node verify-captures\.mjs/.test(command)) return {dir: FE, why: 'verify-captures.mjs lives at fe root'};
  if (/^cat /.test(command)) return {dir: recordDir, why: 'cat ../../uat/... is relative to the record dir'};
  if (/^cd \.\.\/todo-app-frontend/.test(command)) return {dir: BE, why: 'cd ../todo-app-frontend from be root'};
  if (/todo-app-frontend/.test(node)) return {dir: FE, why: 'fe implementation record'};
  return {dir: BE, why: 'backend record'};
}

const results = [];
for (const t of targets) {
  const per = [];
  for (const a of t.assertions) {
    const cmd = a.command;
    const {dir: cwd, why} = cwdFor(t.node, cmd);
    const notes = [];
    // path tokens
    for (const m of cmd.matchAll(/(?:^|\s|'|")((?:\.\.\/|src\/|scripts\/|uat\/)[\w./[\]-]*\.(?:ts|tsx|js|mjs|cjs|json|sh|md|yaml))(?=["'\s]|$)/g)) {
      const p = m[1];
      const abs = path.resolve(cwd, p);
      const alt = path.resolve(BE, p);
      const altFe = path.resolve(FE, p);
      notes.push(`path ${p}: ${fs.existsSync(abs) ? 'EXISTS@' + path.relative(root, cwd) : (fs.existsSync(alt) ? 'missing-at-cwd-but-at-be' : (fs.existsSync(altFe) ? 'missing-at-cwd-but-at-fe' : 'MISSING'))}`);
    }
    // -t filters
    for (const m of cmd.matchAll(/-t\s+"([^"]+)"/g)) {
      const needle = m[1];
      const pool = cwd === FE ? feSrc : beSrc;
      const hits = pool.filter(f => f.text.includes(needle)).map(f => f.rel);
      notes.push(`-t "${needle}": ${hits.length ? hits.slice(0, 3).join(',') : 'NO SOURCE MATCH'}`);
    }
    for (const m of cmd.matchAll(/-t\s+([A-Za-z0-9_.:@-]+)/g)) {
      const needle = m[1];
      const pool = cwd === FE ? feSrc : beSrc;
      const hits = pool.filter(f => f.text.includes(needle)).map(f => f.rel);
      notes.push(`-t ${needle}: ${hits.length ? hits.slice(0, 3).join(',') : 'NO SOURCE MATCH'}`);
    }
    // npm run
    for (const m of cmd.matchAll(/npm run ([\w:-]+)/g)) {
      const s = m[1];
      notes.push(`npm run ${s}: ${(cwd === FE ? feScripts : beScripts).has(s) ? 'script exists' : 'NO SCRIPT'}${s === 'test:e2e' ? ' (positional pattern below)' : ''}`);
    }
    const bareT = /npx jest -t/.test(cmd) && !/src\//.test(cmd);
    if (bareT) notes.push('full-suite jest name-filter run (slow)');
    if (/^bash /.test(cmd)) notes.push('PATH bash = WSL bash (fails on this host)');
    if (/^docker exec /.test(cmd)) notes.push(`container ${cmd.split(/\s+/)[3]} must be running`);
    per.push({id: a.id, cwd: path.relative(root, cwd).replaceAll('\\', '/'), why, prevExit: a.exit, notes});
  }
  results.push({node: t.node, state: t.state, RD: t.recordDigestMismatch, CD: t.codeDigestMismatch, assertions: per});
}
console.log(JSON.stringify(results, null, 1));
