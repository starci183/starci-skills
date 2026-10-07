#!/usr/bin/env node
// assess.mjs — bounded cold-scan state snapshot of target repos.
// Feeds define-goal --plan: heuristics only, no test runs, finishes in seconds.
//
//   starci workflow assess --repo <path> [--repo <path2>...] [--json]
//
// Per-repo JSON:
//   { repo, exists, size:{files,tsFiles,loc}, testInfra:{framework,specFiles,
//     e2eFiles,coverageConfig}, lint:{eslintConfig,eslintDisableFiles,
//     anyLeakFiles}, sonar:{configured}, starciwork:{present,nodeCount,
//     uatCount,evidenceCount,mediaCount}, deps:{count,devCount,lockfileAge,
//     hasPackageLock,pnpmLock}, signals:[...] }
import fs from 'node:fs';
import path from 'node:path';
import { readJsonFile as readJson } from '../lib/json.mjs';
import { isWorktreesPath } from '../lib/worktree-exclude.mjs';
import { slash as relPath } from '../lib/path-key.mjs';

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
/** Push subdirectories onto the stack and files onto the list; true once the file cap is hit. */
function collectEntries(entries, rel, stack, files) {
  for (const ent of entries) {
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name) && !isWorktreesPath(relPath)) stack.push(relPath);
    } else if (ent.isFile()) {
      files.push(relPath);
      if (files.length >= FILE_CAP) return true;
    }
  }
  return false;
}

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
    if (collectEntries(entries, rel, stack, files)) { truncated = true; break; }
  }
  return { files, truncated, notes };
}


const exists = (f) => { try { fs.statSync(f); return true; } catch { return false; } };
const daysOld = (f) => {
  try { return Math.max(0, Math.floor((Date.now() - fs.statSync(f).mtimeMs) / 86400000)); }
  catch { return null; }
};

// ------------------------------------------------------------ assessment --
const inStarciwork = (f) => relPath(f).split('/')[0] === '.starciwork';
const base = (f) => path.basename(f).toLowerCase();

/** File counts and the test/lint config markers discovered anywhere in the tree (monorepo-safe). */
function assessTree(out, repo, pkg, files) {
  out.size.files = files.length;
  const srcFiles = files.filter(f => !inStarciwork(f));
  const locFiles = srcFiles.filter(f => LOC_RE.test(f));
  out.size.tsFiles = srcFiles.filter(f => TS_RE.test(f)).length;
  out.testInfra.specFiles = srcFiles.filter(f => SPEC_RE.test(f)).length;
  out.testInfra.e2eFiles = srcFiles.filter(f =>
    relPath(f).split('/').slice(0, -1).some(seg => /e2e/i.test(seg)) || /\.e2e[-.]/i.test(f)).length;
  detectTooling(out, repo, pkg, files);
  scanLoc(out, repo, locFiles);
}

/** Framework, eslint, sonar and coverage-config detection from file markers and package.json. */
const detectFramework = (out, pkgDeps, jestCfg, vitestCfg, pwCfg) => {
  const hasDep = (name) => name in pkgDeps;
  if (hasDep('vitest') || vitestCfg) out.testInfra.framework = 'vitest';
  else if (hasDep('jest') || hasDep('@nestjs/testing') || jestCfg) out.testInfra.framework = 'jest';
  else if (hasDep('@playwright/test') || pwCfg) out.testInfra.framework = 'playwright';
};

const detectCoverageConfig = (out, repo, pkg, files, pkgScripts, hasFile) => {
  let covCfg = hasFile(/^\.nycrc|^\.c8rc/) || /\bcoverage\b/.test(pkgScripts)
    || !!(pkg.jest && (pkg.jest.collectCoverage || pkg.jest.coverageThreshold))
    || !!(pkg.nyc || pkg.c8);
  if (!covCfg) {
    for (const file of files) {
      if (/^(jest|vitest)\.config\./.test(base(file))) {
        try { if (/\bcoverage|collectCoverage/.test(fs.readFileSync(path.join(repo, file), 'utf8'))) { covCfg = true; break; } }
        catch { /* unreadable config — treat as absent */ }
      }
    }
  }
  out.testInfra.coverageConfig = covCfg;
};

function detectTooling(out, repo, pkg, files) {
  const pkgDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const pkgScripts = Object.values(pkg.scripts || {}).join(' ');
  const hasFile = (re) => files.some(f => re.test(base(f)));
  out.lint.eslintConfig = hasFile(/^eslint\.config\.|^\.eslintrc/) || !!pkg.eslintConfig;
  out.sonar.configured = hasFile(/^sonar-project\.properties$|^\.sonarcloud\.properties$/)
    || /\bsonar/.test(pkgScripts);

  const jestCfg = hasFile(/^jest\.config\./) || !!pkg.jest;
  const vitestCfg = hasFile(/^vitest\.config\.|^vitest\.workspace\./);
  const pwCfg = hasFile(/^playwright\.config\./);
  detectFramework(out, pkgDeps, jestCfg, vitestCfg, pwCfg);

  // coverage config: rc files or coverage key in root test configs/scripts
  detectCoverageConfig(out, repo, pkg, files, pkgScripts, hasFile);
}

/** Content greps + LOC over the bounded set of .ts/.tsx/.js files. */
const readLocFile = (repo, file) => { try { return fs.readFileSync(path.join(repo, file), 'utf8'); } catch { return null; } };
const countContentSignals = (out, text) => {
  if (text.includes('eslint-disable')) out.lint.eslintDisableFiles++;
  if (/:\s*any\b/.test(text) || /\bas any\b/.test(text)) out.lint.anyLeakFiles++;
};
function scanLoc(out, repo, locFiles) {
  let loc = 0, read = 0;
  for (const f of locFiles) {
    if (read >= LOC_READ_CAP) break;
    const txt = readLocFile(repo, f);
    if (txt === null) continue;
    read++;
    loc += txt.split('\n').length - (txt.endsWith('\n') ? 1 : 0);
    if (read <= CONTENT_CAP) countContentSignals(out, txt);
  }
  // extrapolate LOC for files past the read cap — it is an estimate by contract
  if (read > 0 && locFiles.length > read) loc += Math.round((loc / read) * (locFiles.length - read));
  out.size.loc = loc;
  if (locFiles.length > read) out.notes.push(`loc extrapolated for ${locFiles.length - read} files past read cap`);
}

/** The .starciwork subtree: presence, index/UAT/evidence/media counts. */
function assessStarciwork(out, repo) {
  const swRoot = path.join(repo, '.starciwork');
  if (!exists(swRoot)) return;
  out.starciwork.present = true;
  const sw = walk(swRoot);
  out.notes.push(...sw.notes.slice(0, 5).map(n => `.starciwork: ${n}`));
  for (const f of sw.files) {
    const b = base(f), r = relPath(f);
    if (b === 'index.yaml') out.starciwork.nodeCount++;
    if (/uat|acceptance/i.test(b)) out.starciwork.uatCount++;
    if (/evidence/i.test(r)) out.starciwork.evidenceCount++;
    if (IMG_RE.test(b)) out.starciwork.mediaCount++;
  }
}

/** Dependency and lockfile facts. */
function assessDeps(out, repo, pkg) {
  out.deps.count = Object.keys(pkg.dependencies || {}).length;
  out.deps.devCount = Object.keys(pkg.devDependencies || {}).length;
  out.deps.hasPackageLock = exists(path.join(repo, 'package-lock.json'));
  out.deps.pnpmLock = exists(path.join(repo, 'pnpm-lock.yaml'));
  const lockAges = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']
    .map(f => daysOld(path.join(repo, f))).filter(d => d !== null);
  out.deps.lockfileAge = lockAges.length ? Math.min(...lockAges) : null;
}

/** One `<area>: <finding>` line per finding. */
const pushTestSignals = (out, signals) => {
  if (out.testInfra.framework === 'none') signals.push('tests: no test framework detected');
  if (out.testInfra.specFiles === 0) signals.push('tests: zero spec files');
  if (out.testInfra.e2eFiles === 0) signals.push('tests: no e2e files');
  else if (out.testInfra.e2eFiles <= 5) signals.push(`tests: e2e is smoke-only (${out.testInfra.e2eFiles} files)`);
  if (!out.testInfra.coverageConfig) signals.push('tests: no coverage config');
};

const pushStaticSignals = (out, signals) => {
  if (!out.lint.eslintConfig) signals.push('static-correctness: no eslint config');
  if (out.lint.eslintDisableFiles > 50) signals.push(`static-correctness: lint relaxed — ${out.lint.eslintDisableFiles} files with eslint-disable`);
  else if (out.lint.eslintDisableFiles > 0) signals.push(`static-correctness: ${out.lint.eslintDisableFiles} files with eslint-disable`);
  if (out.lint.anyLeakFiles > 0) signals.push(`static-correctness: ${out.lint.anyLeakFiles} files contain ': any'/'as any'`);
};

const pushStarciworkSignals = (out, signals) => {
  const work = out.starciwork;
  if (!work.present) signals.push('starciwork-artifacts: starciwork missing');
  else {
    if (work.nodeCount === 0) signals.push('starciwork-artifacts: no index nodes');
    if (work.uatCount === 0) signals.push('starciwork-artifacts: no UAT');
    if (work.evidenceCount === 0) signals.push('starciwork-artifacts: no evidence');
    if (work.mediaCount === 0) signals.push('starciwork-artifacts: no media assets');
  }
};

const pushDependencySignals = (out, signals) => {
  if (out.deps.lockfileAge === null) signals.push('dependencies: no lockfile');
  else if (out.deps.lockfileAge > 90) signals.push(`dependencies: lockfile stale (~${out.deps.lockfileAge}d)`);
};

function pushSignals(out, truncated, notes) {
  const s = out.signals;
  pushTestSignals(out, s);
  pushStaticSignals(out, s);
  if (!out.sonar.configured) s.push('sonar: not configured');
  pushStarciworkSignals(out, s);
  pushDependencySignals(out, s);
  if (truncated) s.push(`scan: truncated at ${FILE_CAP} files`);
  if (notes.length) s.push(`scan: partial — ${notes.length} unreadable dirs`);
}

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

  // -- full-tree walk (bounded) -------------------------------------------
  const { files, truncated, notes } = walk(repo);
  out.notes.push(...notes.slice(0, 10));
  if (notes.length > 10) out.notes.push(`(+${notes.length - 10} more unreadable dirs)`);
  if (truncated) out.notes.push(`file scan truncated at ${FILE_CAP}`);

  assessTree(out, repo, pkg, files);
  assessStarciwork(out, repo);
  assessDeps(out, repo, pkg);
  pushSignals(out, truncated, notes);
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
  console.log('usage: starci workflow assess --repo <path> [--repo <path2>...] [--json]');
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
    const workText = w.present ? `nodes ${w.nodeCount} | uat ${w.uatCount} | evidence ${w.evidenceCount} | media ${w.mediaCount}` : 'absent';
    console.log(`  work     ${workText}`);
    const lockText = r.deps.lockfileAge === null ? 'none' : `~${r.deps.lockfileAge}d`;
    console.log(`  deps     ${r.deps.count}+${r.deps.devCount} dev | lock: ${lockText} | npm:${yn(r.deps.hasPackageLock)} pnpm:${yn(r.deps.pnpmLock)}`);
    if (r.signals.length) console.log(`  signals  ${r.signals.join(' ; ')}`);
    if (r.notes.length) console.log(`  notes    ${r.notes.join(' ; ')}`);
  }
}
