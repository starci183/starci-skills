/**
 * tinkle-4 migration: consolidate every check module under scripts/checks/.
 * Run from the skill root (.claude). Moves files, then fixes every importer/doc reference.
 * Idempotent per-edit: a missing pattern is reported, never fatal.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const log = { moved: [], edited: [], missing: [], left: [] };
const P = p => path.join(ROOT, p);
const exists = p => fs.existsSync(P(p));
const read = p => fs.readFileSync(P(p), 'utf8');
const write = (p, t) => fs.writeFileSync(P(p), t);

function move(src, dst) {
  if (!exists(src)) { log.missing.push(`move:${src}`); return; }
  fs.mkdirSync(path.dirname(P(dst)), { recursive: true });
  fs.renameSync(P(src), P(dst));
  log.moved.push(`${src} -> ${dst}`);
}

/** apply ordered [RegExp, replacement] pairs; report per-rule hit counts */
function patch(file, pairs) {
  if (!exists(file)) { log.missing.push(`edit:${file}`); return; }
  let text = read(file); const before = text; const counts = [];
  for (const [re, to] of pairs) {
    let n = 0;
    text = text.replace(re, typeof to === 'function' ? (...a) => { n += 1; return to(...a); } : () => { n += 1; return to; });
    counts.push(`${re} x${n}`);
  }
  if (text !== before) { write(file, text); log.edited.push(`${file}: ${counts.join(' | ')}`); }
  else log.left.push(`${file}: unchanged`);
}

// named skill checks dir refs only — never run-dir checks/ (which hold <opId>.json)
const CHECK_FILE = /(?<!scripts\/)checks\/(acceptance|proof|render|brand|stacks|work-change|work-layout|architecture)\.mjs/g;
const CHECK_DIR = /(?<!scripts\/)checks\/(architecture|code-patterns)\//g;
const CHECK_GLOB = /(?<!scripts\/)checks\/\*\*/g;
const CHECK_PROSE = /(?<!scripts\/)(?<!\.dist\/)checks\//g; // last-resort path mentions inside moved files

// ---------- 1. MOVE ----------
if (!exists('scripts/checks')) fs.mkdirSync(P('scripts/checks'), { recursive: true });
for (const f of fs.readdirSync(P('scripts')))
  if (/^check-.*\.mjs$/.test(f)) move(`scripts/${f}`, `scripts/checks/${f}`);
if (exists('checks')) {
  for (const f of fs.readdirSync(P('checks'))) {
    const rel = `checks/${f}`;
    if (fs.statSync(P(rel)).isFile()) move(rel, `scripts/checks/${f}`);
  }
  for (const sub of ['architecture', 'code-patterns']) {
    if (!exists(`checks/${sub}`)) continue;
    for (const f of fs.readdirSync(P(`checks/${sub}`))) move(`checks/${sub}/${f}`, `scripts/checks/${sub}/${f}`);
    fs.rmdirSync(P(`checks/${sub}`));
  }
  if (fs.readdirSync(P('checks')).length === 0) fs.rmdirSync(P('checks'));
  else log.left.push('checks/ not empty after move - inspect manually');
}

// ---------- 2. moved scripts/checks/check-*.mjs : depth + sibling fixes ----------
const movedScripts = fs.readdirSync(P('scripts/checks')).filter(f => /^check-.*\.mjs$/.test(f));
for (const f of movedScripts) {
  patch(`scripts/checks/${f}`, [
    [/'\.\.\/core\//g, `'../../core/`],
    [/'\.\.\/kernel\//g, `'../../kernel/`],
    [/'\.\.\/checks\//g, `'./`],
    [/\.\.\/checks\//g, `./`],                                   // dynamic imports / new URL(...)
    [/from '\.\/example-/g, `from '../example-`],                 // example-*.mjs stay in scripts/
    [/(path\.resolve\(path\.dirname\(fileURLToPath\(import\.meta\.url\)\),\s*)'\.\.'(\))/g, `$1'../..'$2`],
    [/scripts\/check-/g, `scripts/checks/check-`],                // usage strings / comments
    [CHECK_PROSE, `scripts/checks/`],                             // remaining checks/ path mentions
  ]);
}

// ---------- 3. moved scripts/checks/*.mjs (former checks/ root) + subdirs ----------
for (const f of fs.readdirSync(P('scripts/checks')).filter(f => f.endsWith('.mjs') && !/^check-/.test(f))) {
  patch(`scripts/checks/${f}`, [
    [/'\.\.\/core\//g, `'../../core/`],
    [/'\.\.\/schemas\//g, `'../../schemas/`],
    [CHECK_PROSE, `scripts/checks/`],
  ]);
}
for (const sub of ['architecture', 'code-patterns']) {
  if (!exists(`scripts/checks/${sub}`)) continue;
  for (const f of fs.readdirSync(P(`scripts/checks/${sub}`)).filter(f => f.endsWith('.mjs'))) {
    patch(`scripts/checks/${sub}/${f}`, [[CHECK_PROSE, `scripts/checks/`]]);
  }
}

// ---------- 4. scripts/ stayers ----------
for (const f of fs.readdirSync(P('scripts')).filter(f => f.endsWith('.mjs'))) {
  patch(`scripts/${f}`, [
    [/from '\.\/check-/g, `from './checks/check-`],
    [/'\.\.\/checks\//g, `'../scripts/checks/`],
    [/\.\.\/checks\//g, `../scripts/checks/`],
    [/scripts\/check-/g, `scripts/checks/check-`],
    [CHECK_PROSE, `scripts/checks/`],
  ]);
}
// runtime-modules.txt is the .dist mirror manifest: bare skill-root paths
patch('scripts/runtime-modules.txt', [
  [/^checks\//gm, `scripts/checks/`],
  [/^scripts\/check-/gm, `scripts/checks/check-`],
]);

// ---------- 5. cli / kernel / hosts / workflows / models / execution / core / contracts .mjs ----------
const CODE_DIRS = ['cli', 'kernel', 'hosts', 'workflows', 'models', 'execution', 'core', 'contracts', 'specifications', 'approvals', 'providers', 'bin', 'mcp', 'ops'];
const mjsFiles = [];
const walkMjs = d => { if (!exists(d)) return; for (const e of fs.readdirSync(P(d), { withFileTypes: true })) { const r = `${d}/${e.name}`; if (e.isDirectory()) walkMjs(r); else if (e.name.endsWith('.mjs')) mjsFiles.push(r); } };
for (const d of CODE_DIRS) walkMjs(d);
for (const f of mjsFiles) {
  patch(f, [
    [/'\.\.\/scripts\/check-/g, `'../scripts/checks/check-`],
    [/'\.\.\/checks\//g, `'../scripts/checks/`],
    [/\.\.\/checks\//g, `../scripts/checks/`],
    [/scripts\/check-/g, `scripts/checks/check-`],
  ]);
}
// kernel/audit.mjs regexes must keep classifying both spellings
patch('kernel/audit.mjs', [
  [/scripts\\\/check-stales\\\.mjs/g, `scripts\\/(?:checks\\/)?check-stales\\.mjs`],
  [/scripts\\\/check-scoped-lint\\\.mjs/g, `scripts\\/(?:checks\\/)?check-scoped-lint\\.mjs`],
]);

// ---------- 6. tests/ ----------
for (const f of fs.readdirSync(P('tests')).filter(f => f.endsWith('.mjs'))) {
  patch(`tests/${f}`, [
    [/'\.\.\/scripts\/check-/g, `'../scripts/checks/check-`],
    [/\.\.\/scripts\/check-/g, `../scripts/checks/check-`],
    [/'\.\.\/checks\//g, `'../scripts/checks/`],
    [/\.\.\/checks\//g, `../scripts/checks/`],
    [/scripts\/check-/g, `scripts/checks/check-`],
    [/\.dist\/checks\//g, `.dist/scripts/checks/`],
    [/\.claude\/checks\//g, `.claude/scripts/checks/`],
    [/'scripts', 'check-/g, `'scripts', 'checks', 'check-`],
    [/'scripts','check-/g, `'scripts','checks','check-`],
    [CHECK_FILE, `scripts/checks/$1.mjs`],
    [CHECK_DIR, `scripts/checks/$1/`],
  ]);
}
// fixture layout fixes that simple patterns cannot express
patch('tests/stacks.spec.mjs', [
  [/path\.join\(dist,'checks'\)/g, `path.join(dist,'scripts','checks')`],
  [/path\.join\(dist,'checks','stacks\.mjs'\)/g, `path.join(dist,'scripts','checks','stacks.mjs')`],
  [/path\.join\(payload,'\.dist','checks','stacks\.mjs'\)/g, `path.join(payload,'.dist','scripts','checks','stacks.mjs')`],
]);
patch('tests/application-stacks-integration.spec.mjs', [
  [/'models','checks','providers'/g, `'models','providers'`],
]);
patch('tests/build-entry.spec.mjs', [
  [/'models','checks','providers'/g, `'models','providers'`],
]);
patch('tests/backend-handoff.spec.mjs', [
  [/'contracts','checks','\.dist'/g, `'contracts','.dist'`],
]);

// ---------- 7. ops / model / schemas / knowledge / other yaml+json ----------
const YAML_DIRS = ['ops', 'model', 'schemas', 'knowledge', 'workflows', 'contracts', 'approvals', 'providers', 'execution', 'specifications', 'init', 'skills'];
const yamlFiles = [];
const walkYaml = d => { if (!exists(d)) return; for (const e of fs.readdirSync(P(d), { withFileTypes: true })) { const r = `${d}/${e.name}`; if (e.isDirectory()) walkYaml(r); else if (/\.(yaml|yml|json)$/.test(e.name)) yamlFiles.push(r); } };
for (const d of YAML_DIRS) walkYaml(d);
for (const f of yamlFiles) {
  patch(f, [
    [/scripts\/check-/g, `scripts/checks/check-`],
    [CHECK_FILE, `scripts/checks/$1.mjs`],
    [CHECK_DIR, `scripts/checks/$1/`],
    [CHECK_GLOB, `scripts/checks/**`],
  ]);
}

// ---------- 8. docs + top-level markdown ----------
const MD = [];
const walkMd = d => { if (!exists(d)) return; for (const e of fs.readdirSync(P(d), { withFileTypes: true })) { const r = `${d}/${e.name}`; if (e.isDirectory()) walkMd(r); else if (e.name.endsWith('.md')) MD.push(r); } };
walkMd('docs'); walkMd('notes'); walkMd('upgrades');
for (const f of ['SKILL.md', 'README.md', 'MASTER.md', 'goal.md', 'PARALLEL-AMAP.md']) if (exists(f)) MD.push(f);
for (const f of MD) {
  patch(f, [
    [/scripts\/check-/g, `scripts/checks/check-`],
    [CHECK_FILE, `scripts/checks/$1.mjs`],
    [CHECK_DIR, `scripts/checks/$1/`],
    [CHECK_GLOB, `scripts/checks/**`],
  ]);
}

// ---------- 9. INDEX.yaml + package.json + CI ----------
patch('INDEX.yaml', [
  [/  checks: Machine checks[^\n]*\n/, ''],
  [/  scripts: Build tooling\n/, '  scripts: Build tooling; scripts/checks/ holds the machine checks that read bytes rather than claims\n'],
]);
patch('package.json', [/    "checks\/",\n/, '']);
patch('.github/workflows/todo-app-example.yml', [
  [/scripts\/check-/g, `scripts/checks/check-`],
  [CHECK_GLOB, `scripts/checks/**`],
]);

// ---------- 10. examples/ real importers (asset .mjs helpers) ----------
patch('examples/todo-app-frontend/verify-captures.mjs', [
  [/\.\.\/checks\//g, `../scripts/checks/`],
  [CHECK_PROSE, `scripts/checks/`],
]);
patch('examples/ecommerce-app-fe/captures/verify-render.mjs', [
  [/\.\.\/checks\//g, `../scripts/checks/`],
  [CHECK_PROSE, `scripts/checks/`],
]);
patch('examples/todo-app-backend/.starciwork/brand/assets/verify-rev3.mjs', [
  [/\.\.\/checks\//g, `../scripts/checks/`],
  [CHECK_PROSE, `scripts/checks/`],
]);
patch('examples/todo-app-backend/.starciwork/features/task/impl/todo-app-frontend/task-list/assets/render-check.mjs', [
  [/path\.join\('checks', 'render\.mjs'\)/g, `path.join('scripts', 'checks', 'render.mjs')`],
  [/path\.join\(repoRoot, 'checks', 'render\.mjs'\)/g, `path.join(repoRoot, 'scripts', 'checks', 'render.mjs')`],
  [CHECK_PROSE, `scripts/checks/`],
]);
patch('examples/todo-app-backend/README.md', [[CHECK_PROSE, `scripts/checks/`]]);
for (const f of [
  'examples/todo-app-backend/.starciwork/features/audit/ui/privacy/assets/verify-captures.mjs',
  'examples/todo-app-backend/.starciwork/features/notify/impl/todo-app-frontend/preferences/assets/capture.mjs',
  'examples/todo-app-backend/.starciwork/features/login/impl/todo-app-frontend/sign-in/assets/capture.mjs',
]) patch(f, [[CHECK_PROSE, `scripts/checks/`]]);

console.log(JSON.stringify(log, null, 2));
