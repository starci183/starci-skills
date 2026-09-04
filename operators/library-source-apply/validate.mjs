import { existsSync, readFileSync, lstatSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from '../../scripts/json-schema.mjs';
import { validateRequest, sessionRootOf } from '../../scripts/validate-request.mjs';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const hash = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
export const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
export const schema = (root, kind) => json(path.join(root, 'templates/kinds', `${kind}.schema.json`));
export const slash = (value) => value.replaceAll('\\', '/');
export const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
const inside = (root, target) => { const rel = path.relative(root, target); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };
export function safeRelative(value) { return typeof value === 'string' && value.length > 0 && !/[\\:\x00-\x1f]/.test(value) && !path.posix.isAbsolute(value) && value.split('/').every((part) => part && part !== '..' && part !== '.'); }
export function safePath(checkout, relative, allowMissing = true) {
  if (!safeRelative(relative)) throw new Error(`unsafe relative path: ${relative}`);
  let cur = checkout;
  for (const part of relative.split('/')) {
    cur = path.join(cur, part);
    let stat;
    try { stat = lstatSync(cur); } catch (error) { if (error.code === 'ENOENT' && allowMissing) continue; throw new Error(`missing path: ${relative}`); }
    if (stat.isSymbolicLink() || !inside(realpathSync(checkout), realpathSync(cur))) throw new Error(`symlink or escaped path: ${relative}`);
  }
  return cur;
}
export const fileHash = (file) => existsSync(file) ? hash(readFileSync(file)) : null;
export function baseBytes(checkout, base, file) {
  try { return execFileSync('git', ['-C', checkout, 'show', `${base}:${file}`], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return null; }
}
export function baseWorkingBytes(checkout, base, file) {
  try { return execFileSync('git', ['-C', checkout, 'cat-file', '--filters', `${base}:${file}`], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return null; }
}
export function snapshots(ctx) { return Object.fromEntries(ctx.plan.files.map(({ path: file }) => [file, fileHash(safePath(ctx.checkout, file))])); }
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const regressionFailed = (output, assertion) => output.split(/\r?\n/).some((line) => line.includes(assertion) && /FAIL|×|✕|✗|not ok/.test(line));
export function nextPatch(version) { const [a, b, c] = version.split('.').map(Number); return `${a}.${b}.${c + 1}`; }

export function planErrors(plan, manifest) {
  const errors = [];
  if (manifest.name !== plan.packageName || manifest.version !== plan.baseVersion) errors.push('package name/version differs from the frozen manifest');
  if (manifest.private === true || !(manifest.exports || manifest.main || manifest.module)) errors.push('the bound manifest does not identify a distributable owner library');
  if (plan.targetVersion !== nextPatch(plan.baseVersion)) errors.push('targetVersion must be exactly the next patch');
  const seen = new Set();
  for (const file of plan.files) {
    if (seen.has(file.path)) errors.push(`duplicate file: ${file.path}`); seen.add(file.path);
    if (!safeRelative(file.path)) errors.push(`unsafe file: ${file.path}`);
    if (file.kind === 'behavior' && (!/\.(?:[cm]?[jt]sx?)$/.test(file.path) || /\.(spec|test)\./.test(file.path))) errors.push(`invalid behavior file: ${file.path}`);
    if (file.kind === 'test' && !/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file.path)) errors.push(`invalid test file: ${file.path}`);
    if (file.kind === 'docs' && path.posix.basename(file.path) !== 'CHANGELOG.md') errors.push('only the package changelog is a docs write');
    if (file.kind === 'lockfile' && path.posix.basename(file.path) !== 'package-lock.json') errors.push('only package-lock.json metadata may be synchronized');
  }
  const behaviors = plan.files.filter((f) => f.kind === 'behavior').map((f) => f.path);
  const tests = plan.files.filter((f) => f.kind === 'test').map((f) => f.path);
  if (!behaviors.length || !tests.length) errors.push('a behavior repair needs source and regression test files');
  for (const pair of plan.pairs) if (!behaviors.includes(pair.source) || !tests.includes(pair.test)) errors.push('every pair must identify declared behavior and test files');
  for (const file of behaviors) if (!plan.pairs.some((p) => p.source === file)) errors.push(`unpaired source: ${file}`);
  for (const file of tests) if (!plan.pairs.some((p) => p.test === file)) errors.push(`unpaired test: ${file}`);
  const root = plan.packageRoot === '.' ? '' : `${plan.packageRoot}/`;
  if (!plan.files.some((f) => f.kind === 'manifest' && f.path === `${root}package.json`) || plan.files.filter((f) => f.kind === 'manifest').length !== 1) errors.push('exactly the owner package manifest must be declared');
  const gateIds = plan.gates.map((g) => g.id);
  if (new Set(gateIds).size !== gateIds.length || gateIds.some((id) => ['before', 'after'].includes(id))) errors.push('gate ids must be unique and not regression phases');
  const required = ['test', 'typecheck', 'build'].filter((name) => manifest.scripts?.[name]);
  if (!required.includes('test')) errors.push('the package must declare a complete test script');
  for (const name of required) if (!plan.gates.some((g) => g.command.kind === 'npm-script' && g.command.name === name && g.command.args.length === 0)) errors.push(`missing unfiltered package gate: ${name}`);
  for (const gate of plan.gates) if (gate.command.kind !== 'npm-script' || !manifest.scripts?.[gate.command.name] || gate.command.args.length) errors.push(`gate ${gate.id} must run a complete existing package script`);
  return errors;
}

export async function loadContext(branch, root = ROOT) {
  const req = await validateRequest(root, branch);
  if (req.errors.length) throw new Error(req.errors.join('\n'));
  const request = req.request;
  const plan = request.requirements.plan;
  const errors = validateAgainst(schema(root, 'library-behavior-plan'), plan, 'plan');
  if (errors.length) throw new Error(errors.join('\n'));
  const session = sessionRootOf(branch);
  const routeRef = request.inputs.route;
  if (!session || !safeRelative(routeRef)) throw new Error('route must be a session-relative typed input');
  const route = json(safePath(session, routeRef, false));
  const routeErrors = validateAgainst(schema(root, 'route'), route, 'route');
  if (routeErrors.length) throw new Error(routeErrors.join('\n'));
  const routeCheckout = route.checkout.diskPath;
  const wantedBranch = `refs/heads/session/${request.sessionId}`;
  const worktrees = git(routeCheckout, ['worktree', 'list', '--porcelain']).split(/\r?\n\r?\n/).map((record) => Object.fromEntries(record.split(/\r?\n/).filter(Boolean).map((line) => { const split = line.indexOf(' '); return split < 0 ? [line, true] : [line.slice(0, split), line.slice(split + 1)]; })));
  const matches = worktrees.filter((record) => record.branch === wantedBranch && !record.bare);
  if (matches.length !== 1) throw new Error('exactly one worktree of the routed repository must own this session branch');
  const checkout = matches[0].worktree;
  const base = route.sourceHead;
  if (route.role !== 'fe' || route.mutationReadiness !== 'ready' || route.gitPolicy.worktreeBranches !== 'session-only') throw new Error('route is not a writable owner session binding');
  if (!request.contexts.some((c) => c.alias === '@workspaces/fe' && c.head === base)) throw new Error('frozen context must match the route base');
  if (git(checkout, ['branch', '--show-current']) !== `session/${request.sessionId}`) throw new Error('checkout is not this session branch');
  if (path.resolve(git(checkout, ['rev-parse', '--show-toplevel'])) !== path.resolve(checkout)) throw new Error('checkout must be the routed Git root');
  const packageDir = plan.packageRoot === '.' ? checkout : safePath(checkout, plan.packageRoot, false);
  const manifestPath = slash(path.relative(checkout, path.join(packageDir, 'package.json')));
  const original = baseBytes(checkout, base, manifestPath);
  if (!original) throw new Error('owner manifest must exist at the frozen base');
  const manifest = JSON.parse(original);
  errors.push(...planErrors(plan, manifest));
  for (const file of plan.files) {
    const full = safePath(checkout, file.path);
    const specialLock = file.kind === 'lockfile' && file.path === plan.workspaceLockfile;
    if (!inside(packageDir, full) && !specialLock) errors.push(`file outside package: ${file.path}`);
    if (!(route.writeRoots ?? []).some((r) => (r === '.' || safeRelative(r)) && inside(path.resolve(checkout, r), full))) errors.push(`file outside bound write roots: ${file.path}`);
    if (file.kind !== 'test' && !baseBytes(checkout, base, file.path)) errors.push(`only a new paired test may be created: ${file.path}`);
    if (!specialLock) {
      let parent = path.dirname(full);
      while (inside(packageDir, parent) && parent !== packageDir) {
        if (existsSync(path.join(parent, 'package.json'))) errors.push(`nested package boundary: ${file.path}`);
        parent = path.dirname(parent);
      }
    }
  }
  if (plan.workspaceLockfile && !plan.files.some((f) => f.path === plan.workspaceLockfile && f.kind === 'lockfile')) errors.push('workspaceLockfile must be in the exact file set');
  if (errors.length) throw new Error(errors.join('\n'));
  return { root, branch, request, plan, route, checkout, base, packageDir, manifestPath, manifest, planHash: hash(JSON.stringify(plan)) };
}

export function worktreeErrors(ctx, { pristine = false } = {}) {
  const errors = [];
  const dirty = git(ctx.checkout, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames']).split('\0').filter(Boolean).map((row) => row.slice(3));
  const declared = new Set(ctx.plan.files.map((f) => f.path));
  for (const file of dirty) if (pristine || !declared.has(file)) errors.push(`dirty file outside the allowed phase: ${file}`);
  if (git(ctx.checkout, ['rev-parse', 'HEAD']) !== ctx.base && pristine) errors.push('preflight head differs from base');
  return errors;
}

export function presentationProjection(ts, text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (source.parseDiagnostics.length) throw new Error(`cannot parse behavior source: ${file}`);
  const result = [];
  const valueNames = new Set();
  const collectNames = (node) => { if (ts.isIdentifier(node)) valueNames.add(node.text); ts.forEachChild(node, collectNames); };
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxClosingElement(node)) result.push(`${node.kind}:${node.tagName.getText(source)}`);
    if (ts.isJsxText(node)) result.push(`text:${node.getText(source).trim()}`);
    if (ts.isJsxAttribute(node) && ['className', 'style', 'data-contract'].includes(node.name.getText(source))) { result.push(node.getText(source)); collectNames(node); }
    if ((ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node)) && /^(?:className|style|styles|css|sx)$/.test(node.name?.getText(source) ?? '')) result.push(node.getText(source));
    if (ts.isImportDeclaration(node) && /\.(?:css|scss|sass|less)["']$/.test(node.moduleSpecifier.getText(source))) result.push(node.getText(source));
    if (ts.isBinaryExpression(node) && /\.(?:className|style|classList)(?:\.|\[|$)/.test(node.left.getText(source))) result.push(node.getText(source));
    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(source);
      if (/\.(?:createElement|appendChild|prepend|append|replaceChildren|insertBefore|removeChild)$/.test(call) || /\.classList\./.test(call)) result.push(node.getText(source));
      if (/\.(?:setAttribute|removeAttribute)$/.test(call) && node.arguments[0] && /^['"](?:class|style)['"]$/.test(node.arguments[0].getText(source))) result.push(node.getText(source));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const recorded = new Set();
  const visitValues = (node) => {
    if (ts.isVariableDeclaration(node) && valueNames.has(node.name.getText(source)) && node.initializer && !recorded.has(node.name.getText(source))) { recorded.add(node.name.getText(source)); result.push(node.getText(source)); collectNames(node.initializer); }
    ts.forEachChild(node, visitValues);
  };
  let previous;
  do { previous = recorded.size; visitValues(source); } while (previous !== recorded.size);
  return result;
}

export function changeErrors(ctx) {
  const errors = [];
  const current = json(safePath(ctx.checkout, ctx.manifestPath, false));
  const expected = { ...ctx.manifest, version: ctx.plan.targetVersion };
  if (!same(current, expected)) errors.push('manifest may change only to the next patch version');
  const require = createRequire(path.join(ctx.packageDir, 'package.json'));
  const ts = require('typescript');
  for (const file of ctx.plan.files) {
    const full = safePath(ctx.checkout, file.path, false);
    const old = baseBytes(ctx.checkout, ctx.base, file.path);
    if (file.kind === 'behavior' && !same(presentationProjection(ts, old.toString(), file.path), presentationProjection(ts, readFileSync(full, 'utf8'), file.path))) errors.push(`presentation changed in behavior repair: ${file.path}`);
    if (file.kind === 'lockfile') {
      const original = JSON.parse(old);
      const expectedLock = structuredClone(original);
      const key = file.path === ctx.plan.workspaceLockfile ? (ctx.plan.packageRoot === '.' ? '' : ctx.plan.packageRoot) : '';
      if (!expectedLock.packages?.[key]) { errors.push('lockfile must already declare the owner package'); continue; }
      expectedLock.packages[key].version = ctx.plan.targetVersion;
      if (key === '' && Object.hasOwn(expectedLock, 'version')) expectedLock.version = ctx.plan.targetVersion;
      if (!same(json(full), expectedLock)) errors.push('lockfile may change only the owner package version metadata');
    }
  }
  return errors;
}

export function resolveCommand(ctx, command) {
  if (command.kind === 'npm-script') {
    const body = ctx.manifest.scripts?.[command.name];
    if (!body) throw new Error('command is not an existing package script');
    const require = createRequire(path.join(process.execPath, '..', 'node_modules', 'npm', 'package.json'));
    let npmCli;
    for (const candidate of [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')]) if (candidate && existsSync(candidate) && path.basename(candidate) === 'npm-cli.js') { npmCli = candidate; break; }
    if (!npmCli) { try { npmCli = require.resolve('npm/bin/npm-cli.js'); } catch { throw new Error('npm CLI JS path unavailable; do not substitute a shell command'); } }
    return { exe: process.execPath, args: [npmCli, 'run', command.name, '--', ...command.args], commandHash: hash(body) };
  }
  if (!ctx.manifest.devDependencies?.[command.name] && !ctx.manifest.dependencies?.[command.name]) throw new Error('regression binary must be a declared package dependency');
  const require = createRequire(path.join(ctx.packageDir, 'package.json'));
  const metadataFile = require.resolve(`${command.name}/package.json`);
  const metadata = json(metadataFile);
  const bin = typeof metadata.bin === 'string' ? metadata.bin : metadata.bin?.[command.name];
  if (!bin || !safeRelative(bin.replace(/^\.\//, ''))) throw new Error('package binary is not declared');
  const binary = path.resolve(path.dirname(metadataFile), bin);
  return { exe: process.execPath, args: [binary, ...command.args], commandHash: hash(readFileSync(binary)) };
}

export function proofErrors(ctx, proofs, finalHashes) {
  const errors = [];
  const phases = ['before', 'after', ...ctx.plan.gates.map((g) => g.id)];
  for (const phase of phases) {
    const proof = proofs[phase];
    if (!proof) { errors.push(`missing proof: ${phase}`); continue; }
    errors.push(...validateAgainst(schema(ctx.root, 'library-proof'), proof, `proof.${phase}`));
    const command = ['before', 'after'].includes(phase) ? ctx.plan.regression.command : ctx.plan.gates.find((g) => g.id === phase).command;
    if (proof.phase !== phase || !same(proof.command, command) || proof.commandHash !== resolveCommand(ctx, command).commandHash || proof.planHash !== ctx.planHash || proof.base !== ctx.base) errors.push(`proof binding mismatch: ${phase}`);
    if (proof.head !== ctx.base) errors.push(`proof must run before the single delivery commit: ${phase}`);
    let output = '';
    try {
      if (proof.outputRef !== `response/artifacts/proofs/${phase}.log`) throw new Error('unexpected log reference');
      output = readFileSync(safePath(ctx.branch, proof.outputRef, false), 'utf8');
    } catch { errors.push(`missing or unsafe proof log: ${phase}`); }
    if (proof.outputHash !== hash(output) || !output.trim()) errors.push(`missing or changed proof output: ${phase}`);
    const start = Date.parse(proof.startedAt), end = Date.parse(proof.finishedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) errors.push(`invalid proof timestamps: ${phase}`);
    if (phase === 'before') {
      if (proof.exitCode <= 0 || !regressionFailed(output, ctx.plan.regression.assertion)) errors.push('before proof must fail on the declared regression assertion');
      for (const file of ctx.plan.files) {
        const expected = file.kind === 'test' ? finalHashes[file.path] : hash(baseWorkingBytes(ctx.checkout, ctx.base, file.path));
        if (proof.files[file.path] !== expected) errors.push(`before proof tested different source/test bytes: ${file.path}`);
      }
    } else {
      if (proof.exitCode !== 0) errors.push(`gate did not pass: ${phase}`);
      if (!same(proof.files, finalHashes)) errors.push(`proof is stale: ${phase}`);
    }
  }
  if (proofs.before && proofs.after && Date.parse(proofs.before.finishedAt) > Date.parse(proofs.after.startedAt)) errors.push('before proof must precede after proof');
  return errors;
}

export async function validateLibraryStep(branch, root = ROOT, preflight = false) {
  const errors = [];
  try {
    const ctx = await loadContext(branch, root);
    if (preflight) return { errors: worktreeErrors(ctx, { pristine: true }) };
    const base = await validateStep(root, branch);
    errors.push(...base.errors);
    if (base.response?.status !== 'done') return { errors };
    errors.push(...worktreeErrors(ctx), ...changeErrors(ctx));
    const delivery = json(path.join(branch, 'response/data/library.json'));
    const commit = git(ctx.checkout, ['rev-parse', 'HEAD']);
    if (delivery.commit !== commit || delivery.base !== ctx.base || delivery.planHash !== ctx.planHash || delivery.packageName !== ctx.plan.packageName || !same(base.response.commits, [commit])) errors.push('delivery does not match the committed plan');
    if (git(ctx.checkout, ['rev-list', '--parents', '-n', '1', commit]) !== `${commit} ${ctx.base}`) errors.push('delivery must be exactly one single-parent commit after the base');
    if (git(ctx.checkout, ['status', '--porcelain=v1', '--untracked-files=all'])) errors.push('delivery working tree must be clean');
    const changed = git(ctx.checkout, ['diff', '--name-only', '--no-renames', ctx.base, commit]).split('\n').filter(Boolean).sort();
    const declared = ctx.plan.files.map((f) => f.path).sort();
    if (!same(changed, declared)) errors.push('Git changes must equal the exact declared file set');
    const finalHashes = snapshots(ctx);
    if (!same(delivery.files.map((f) => f.path).sort(), declared)) errors.push('delivery file set differs from plan');
    for (const file of delivery.files) {
      const old = baseBytes(ctx.checkout, ctx.base, file.path);
      if (file.before !== (old ? hash(old) : null) || file.after !== finalHashes[file.path]) errors.push(`delivery hash mismatch: ${file.path}`);
    }
    const proofs = {};
    const expectedRefs = ['before', 'after', ...ctx.plan.gates.map((g) => g.id)].map((phase) => `response/data/proofs/${phase}.json`);
    if (!same([...delivery.proofs].sort(), [...expectedRefs].sort()) || !same([...(base.response.fields['library-proof'] ?? [])].sort(), [...expectedRefs].sort())) errors.push('delivery and response must list the complete proof set');
    for (const ref of expectedRefs) if (existsSync(path.join(branch, ref))) proofs[path.basename(ref, '.json')] = json(path.join(branch, ref));
    errors.push(...proofErrors(ctx, proofs, finalHashes));
    const changes = readFileSync(path.join(branch, 'response/changes.md'), 'utf8');
    if (!same((tableUnder(changes, '## Files') ?? []).map(([file]) => file).sort(), declared)) errors.push('changes receipt differs from actual file set');
  } catch (error) { errors.push(error.message); }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const branch = process.argv[2];
  if (!branch) { process.stderr.write('usage: node validate.mjs <branch> [--preflight]\n'); process.exitCode = 2; }
  else { const { errors } = await validateLibraryStep(path.resolve(branch), ROOT, process.argv.includes('--preflight')); if (errors.length) { process.stderr.write(errors.join('\n') + '\n'); process.exitCode = 1; } else process.stdout.write('valid library.source.apply branch\n'); }
}
