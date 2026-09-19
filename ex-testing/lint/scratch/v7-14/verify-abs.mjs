/**
 * v7-14: re-verify the applied absolute->relative conversion. For every path value in the eight records I
 * rewrote, resolve it and, where the record pins a sha256 beside it, compare the pin with the current bytes.
 * A path whose pin matches proves the record's identity claim survives the rewrite; a path that resolves but
 * whose pin no longer matches is reported as historical drift (the record says what was read, not what is
 * there now) — never rewritten by this lane.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../core/yaml.mjs';

const HOST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const TODO = 'examples/todo-app-backend/.starciwork';

const files = [`${TODO}/brand/index.yaml`,
  ...['audit/ui/privacy', 'login/ui/sign-in', 'notify/ui/preferences', 'plan/ui/usage',
    'recur/ui/schedule', 'share/ui/invite', 'task/ui/list'].map(f => `${TODO}/features/${f}/index.yaml`)];

let ok = 0, drift = 0, missing = 0, machineLeft = 0;
for (const rel of files) {
  const file = path.join(HOST, rel);
  const text = fs.readFileSync(file, 'utf8');
  machineLeft += (text.match(/[A-Za-z]:[\\/](?:Users|Program Files|PROGRA~1)/g) ?? []).length;
  const data = parseYaml(text);
  // Values under a named inspection root (`brand.sources[].path`, `grammar.inspectedFiles[].path`,
  // `color.tokens[].source`) are relative to that root, and an artwork master is relative to the record
  // it names — the same resolution the gate's own readers use, not a guess.
  const namedRoots = [];
  const collectRoots = node => {
    if (Array.isArray(node)) return node.forEach(collectRoots);
    if (!node || typeof node !== 'object') return;
    for (const key of ['inspectionRoot', 'resolvedPath']) {
      const v = node[key];
      if (typeof v !== 'string') continue;
      for (const base of [path.join(HOST, v), path.join(HOST, 'examples', path.basename(v))]) {
        if (fs.existsSync(base) && !namedRoots.includes(base)) namedRoots.push(base);
      }
    }
    Object.values(node).forEach(collectRoots);
  };
  collectRoots(data);
  const recordDirs = new Map([[TODO + '/brand', path.join(HOST, TODO, 'brand')]]);
  const bases = [path.dirname(file), path.join(HOST, TODO), path.join(HOST, 'examples/todo-app-backend'),
    path.join(HOST, 'examples/todo-app-frontend'), HOST, ...namedRoots];
  const stack = [[data, '']];
  const rows = [];
  while (stack.length) {
    const [node, trail] = stack.pop();
    if (Array.isArray(node)) { node.forEach((v, i) => stack.push([v, `${trail}[${i}]`])); continue; }
    if (!node || typeof node !== 'object') continue;
    const p = node.path ?? node.inspectionRoot ?? node.resolvedPath ?? node.inspectedPath ?? node.source;
    if (typeof p === 'string' && (p.includes('/') || /^[a-z]:/i.test(p))) {
      const masterOf = trail.endsWith('.master') && typeof node.record === 'string'
        ? recordDirs.get(`${TODO}/${node.record}`) : null;
      const hit = [...(masterOf ? [masterOf] : []), ...bases].map(b => path.join(b, p)).find(x => fs.existsSync(x));
      if (!hit) rows.push(['MISSING', trail, p]);
      else if (typeof node.sha256 === 'string') rows.push([sha(hit) === node.sha256 ? 'PIN_MATCHES' : 'PIN_HISTORICAL', trail, p]);
      else rows.push(['RESOLVES', trail, p]);
    }
    for (const [k, v] of Object.entries(node)) if (v && typeof v === 'object') stack.push([v, trail ? `${trail}.${k}` : k]);
  }
  const tally = {};
  for (const [v] of rows) tally[v] = (tally[v] ?? 0) + 1;
  ok += tally.PIN_MATCHES ?? 0; missing += tally.MISSING ?? 0; drift += tally.PIN_HISTORICAL ?? 0;
  console.log(`${rel.replace(TODO + '/', '')}\t${JSON.stringify(tally)}\tmachine-prefix-left:${(text.match(/[A-Za-z]:[\\/](?:Users|Program Files)/g) ?? []).length}`);
  for (const [v, trail, p] of rows.filter(r => r[0] === 'MISSING')) console.log(`    MISSING ${trail} ${p}`);
}
console.log(`\ntotals: pins still matching current bytes ${ok}; resolved-but-historical ${drift}; unresolvable ${missing}; machine paths left in these records ${machineLeft}`);
