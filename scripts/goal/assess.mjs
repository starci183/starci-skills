#!/usr/bin/env node
// assess.mjs — bounded cold-scan state snapshot of target repos.
// Feeds define-goal --plan: heuristics only, no test runs, finishes in seconds.
//
//   node scripts/goal/assess.mjs --repo <path> [--repo <path2>...] [--json]
//
// Per-repo JSON:
//   { repo, exists, size:{files,tsFiles,loc}, testInfra:{framework,specFiles,
//     e2eFiles,coverageConfig}, lint:{eslintConfig,eslintDisableFiles,
//     anyLeakFiles}, sonar:{configured}, starciwork:{present,nodeCount,
//     uatCount,evidenceCount,mediaCount}, deps:{count,devCount,lockfileAge,
//     hasPackageLock,pnpmLock}, signals:[...] }
import fs from 'node:fs';
import path from 'node:path';

const FILE_CAP = 20000;          // max files enumerated per tree walk
const CONTENT_CAP = 2000;        // max files content-grepped (eslint-disable / any)
const LOC_READ_CAP = 6000;       // max files actually read for line counting
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'out']);
const LOC_RE = /\.(ts|tsx|js)$/i;
const TS_RE = /\.(tsx?|mts|cts)$/i;
const SPEC_RE = /\.(spec|test)\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const IMG_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;

// ---------------------------------------------------------------- walk ----
// Iterative readdir(withFileTypes). Never throws: unreadable/locked dirs are
// collected into `notes` and the walk continues.
function walk(root) {
  const files = [];
  const notes = [];
  let truncated = false;
  const stack = [''];
  while (stack.length) {
    if (files.length >= FILE_CAP) { truncated = true; break; }
    const rel = stack.pop();
    const abs = rel ? path.join(root, rel) : root;
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); }
    catch (e) { notes.push(`unreadable dir: ${rel || '.'} (${e.code || e.message})`); continue; }
    for (const ent of entries) {
      const relPath = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        if (!SKIP_DIRS.has(ent.name)) stack.push(relPath);
      } else if (ent.isFile()) {
        files.push(relPath);
        if (files.length >= FILE_CAP) { truncated = true; break; }
      }
    }
  }
  return { files, truncated, notes };
}

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const exists = (f) => { try { fs.statSync(f); return true; } catch { return false; } };
const daysOld = (f) => {
  try { return Math.max(0, Math.floor((Date.now() - fs.statSync(f).mtimeMs) / 86400000)); }
  catch { return null; }
};

// ------------------------------------------------------------ assessment --
function assessRepo(repoPath) {
  const repo = path.resolve(repoPath);
  const out = {
    repo, exists: false,
    size: { files: 0, tsFiles: 0, loc: 0 },
    testInfra: { framework: 'none', specFiles: 0, e2eFiles: 0, coverageConfig: false },
    lint: { eslintConfig: false, eslintDisableFiles: 0, anyLeakFiles: 0 },
    sonar: { configured: false },
    starciwork: { present: false, nodeCount: 0, uatCount: 0, evidenceCount: 0, mediaCount: 0 },
    deps: { count: 0, devCount: 0, lockfileAge: null, hasPackageLock: false, pnpmLock: false },
    signals: [],
    notes: [],
  };
  let st;
  try { st = fs.statSync(repo); } catch { out.signals.push('repo path does not exist'); return out; }
  out.exists = true;
  if (!st.isDirectory()) { out.notes.push('path is not a directory'); return out; }

  const pkg = readJson(path.join(repo, 'package.json')) || {};
  const pkgDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const pkgScripts = Object.values(pkg.scripts || {}).join(' ');

  // -- full-tree walk (bounded) -------------------------------------------
  const { files, truncated, notes } = walk(repo);
  out.notes.push(...notes.slice(0, 10));
  if (notes.length > 10) out.notes.push(`(+${notes.length - 10} more unreadable dirs)`);
  if (truncated) out.notes.push(`file scan truncated at ${FILE_CAP}`);

  out.size.files = files.length;
  const rel = (f) => f.replace(/\\/g, '/');
  const inStarciwork = (f) => rel(f).split('/')[0] === '.starciwork';
  const srcFiles = files.filter(f => !inStarciwork(f));
  const locFiles = srcFiles.filter(f => LOC_RE.test(f));
  out.size.tsFiles = srcFiles.filter(f => TS_RE.test(f)).length;
  out.testInfra.specFiles = srcFiles.filter(f => SPEC_RE.test(f)).length;
  out.testInfra.e2eFiles = srcFiles.filter(f =>
    rel(f).split('/').slice(0, -1).some(seg => /e2e/i.test(seg)) || /\.e2e[-.]/i.test(f)).length;

  // config markers discovered anywhere in the tree (monorepo-safe)
  const base = (f) => path.basename(f).toLowerCase();
  const hasFile = (re) => files.some(f => re.test(base(f)));
  const eslintCfg = hasFile(/^eslint\.config\.|^\.eslintrc/) || !!pkg.eslintConfig;
  out.lint.eslintConfig = eslintCfg;
  out.sonar.configured = hasFile(/^sonar-project\.properties$|^\.sonarcloud\.properties$/)
    || /\bsonar/.test(pkgScripts);

  const jestCfg = hasFile(/^jest\.config\.|jest-harness.*\.json$/) || !!pkg.jest;
  const vitestCfg = hasFile(/^vitest\.config\.|^vitest\.workspace\./);
  const pwCfg = hasFile(/^playwright\.config\./);
  const hasDep = (n) => n in pkgDeps;
  if (hasDep('vitest') || vitestCfg) out.testInfra.framework = 'vitest';
  else if (hasDep('jest') || hasDep('@nestjs/testing') || jestCfg) out.testInfra.framework = 'jest';
  else if (hasDep('@playwright/test') || pwCfg) out.testInfra.framework = 'playwright';

  // coverage config: rc files, codecov, or coverage key in root test configs/scripts
  let covCfg = hasFile(/^\.nycrc|^\.c8rc|^codecov\.yml$/) || /\bcoverage\b/.test(pkgScripts)
    || !!(pkg.jest && (pkg.jest.collectCoverage || pkg.jest.coverageThreshold))
    || !!(pkg.nyc || pkg.c8);
  if (!covCfg) {
    for (const f of files) {
      if (/^(jest|vitest)\.config\./.test(base(f))) {
        try { if (/\bcoverage|collectCoverage/.test(fs.readFileSync(path.join(repo, f), 'utf8'))) { covCfg = true; break; } }
        catch { /* unreadable config — treat as absent */ }
      }
    }
  }
  out.testInfra.coverageConfig = covCfg;

  // -- content greps + LOC (bounded reads, .ts/.tsx/.js only) --------------
  let loc = 0, read = 0;
  for (const f of locFiles) {
    if (read >= LOC_READ_CAP) break;
    let txt;
    try { txt = fs.readFileSync(path.join(repo, f), 'utf8'); } catch { continue; }
    read++;
    loc += txt.split('\n').length - (txt.endsWith('\n') ? 1 : 0);
    if (read <= CONTENT_CAP) {
      if (txt.includes('eslint-disable')) out.lint.eslintDisableFiles++;
      if (/:\s*any\b/.test(txt) || /\bas any\b/.test(txt)) out.lint.anyLeakFiles++;
    }
  }
  // extrapolate LOC for files past the read cap — it is an estimate by contract
  if (read > 0 && locFiles.length > read) loc += Math.round((loc / read) * (locFiles.length - read));
  out.size.loc = loc;
  if (locFiles.length > read) out.notes.push(`loc extrapolated for ${locFiles.length - read} files past read cap`);

  // -- .starciwork subtree --------------------------------------------------
  const swRoot = path.join(repo, '.starciwork');
  if (exists(swRoot)) {
    out.starciwork.present = true;
    const sw = walk(swRoot);
    out.notes.push(...sw.notes.slice(0, 5).map(n => `.starciwork: ${n}`));
    for (const f of sw.files) {
      const b = base(f), r = rel(f);
      if (b === 'index.yaml') out.starciwork.nodeCount++;
      if (/uat|acceptance/i.test(b)) out.starciwork.uatCount++;
      if (/evidence/i.test(r)) out.starciwork.evidenceCount++;
      if (IMG_RE.test(b)) out.starciwork.mediaCount++;
    }
  }

  // -- deps -----------------------------------------------------------------
  out.deps.count = Object.keys(pkg.dependencies || {}).length;
  out.deps.devCount = Object.keys(pkg.devDependencies || {}).length;
  out.deps.hasPackageLock = exists(path.join(repo, 'package-lock.json'));
  out.deps.pnpmLock = exists(path.join(repo, 'pnpm-lock.yaml'));
  const lockAges = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']
    .map(f => daysOld(path.join(repo, f))).filter(d => d !== null);
  out.deps.lockfileAge = lockAges.length ? Math.min(...lockAges) : null;

  // -- signals: one `<area>: <finding>` line per finding --------------------
  const s = out.signals;
  if (out.testInfra.framework === 'none') s.push('tests: no test framework detected');
  if (out.testInfra.specFiles === 0) s.push('tests: zero spec files');
  if (out.testInfra.e2eFiles === 0) s.push('tests: no e2e files');
  else if (out.testInfra.e2eFiles <= 5) s.push(`tests: e2e is smoke-only (${out.testInfra.e2eFiles} files)`);
  if (!out.testInfra.coverageConfig) s.push('tests: no coverage config');
  if (!out.lint.eslintConfig) s.push('static-correctness: no eslint config');
  if (out.lint.eslintDisableFiles > 50) s.push(`static-correctness: lint relaxed — ${out.lint.eslintDisableFiles} files with eslint-disable`);
  else if (out.lint.eslintDisableFiles > 0) s.push(`static-correctness: ${out.lint.eslintDisableFiles} files with eslint-disable`);
  if (out.lint.anyLeakFiles > 0) s.push(`static-correctness: ${out.lint.anyLeakFiles} files contain ': any'/'as any'`);
  if (!out.sonar.configured) s.push('sonar: not configured');
  if (!out.starciwork.present) s.push('starciwork-artifacts: starciwork missing');
  else {
    if (out.starciwork.nodeCount === 0) s.push('starciwork-artifacts: no index nodes');
    if (out.starciwork.uatCount === 0) s.push('starciwork-artifacts: no UAT');
    if (out.starciwork.evidenceCount === 0) s.push('starciwork-artifacts: no evidence');
    if (out.starciwork.mediaCount === 0) s.push('starciwork-artifacts: no media assets');
  }
  if (out.deps.lockfileAge === null) s.push('dependencies: no lockfile');
  else if (out.deps.lockfileAge > 90) s.push(`dependencies: lockfile stale (~${out.deps.lockfileAge}d)`);
  if (truncated) s.push(`scan: truncated at ${FILE_CAP} files`);
  if (notes.length) s.push(`scan: partial — ${notes.length} unreadable dirs`);
  return out;
}

// ------------------------------------------------------------------ cli ---
const args = process.argv.slice(2);
const repos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--repo' && args[i + 1]) repos.push(args[++i]);
}
const asJson = args.includes('--json');
if (args.includes('--help') || (!repos.length && !asJson)) {
  console.log('usage: assess.mjs --repo <path> [--repo <path2>...] [--json]');
  process.exit(repos.length ? 0 : 2);
}
if (!repos.length) repos.push(process.cwd());

const results = repos.map(r => { try { return assessRepo(r); } catch (e) { return { repo: r, exists: false, signals: [`assessment failed: ${e.message}`], notes: [] }; } });

if (asJson) {
  console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
} else {
  for (const r of results) {
    console.log(`\n${path.basename(r.repo)}  (${r.repo})`);
    if (!r.exists) { console.log('  MISSING — ' + (r.signals.join('; ') || 'no path')); continue; }
    const yn = (b) => (b ? 'yes' : 'no');
    console.log(`  size     ${r.size.files} files | ${r.size.tsFiles} ts | ~${r.size.loc} loc`);
    console.log(`  tests    ${r.testInfra.framework} | ${r.testInfra.specFiles} specs | e2e ${r.testInfra.e2eFiles} files | coverage cfg: ${yn(r.testInfra.coverageConfig)}`);
    console.log(`  lint     eslint cfg: ${yn(r.lint.eslintConfig)} | disables: ${r.lint.eslintDisableFiles} files | any leaks: ${r.lint.anyLeakFiles} files`);
    console.log(`  sonar    ${r.sonar.configured ? 'configured' : 'not configured'}`);
    const w = r.starciwork;
    console.log(`  work     ${w.present ? `nodes ${w.nodeCount} | uat ${w.uatCount} | evidence ${w.evidenceCount} | media ${w.mediaCount}` : 'absent'}`);
    console.log(`  deps     ${r.deps.count}+${r.deps.devCount} dev | lock: ${r.deps.lockfileAge === null ? 'none' : `~${r.deps.lockfileAge}d`} | npm:${yn(r.deps.hasPackageLock)} pnpm:${yn(r.deps.pnpmLock)}`);
    if (r.signals.length) console.log(`  signals  ${r.signals.join(' ; ')}`);
    if (r.notes.length) console.log(`  notes    ${r.notes.join(' ; ')}`);
  }
}
