#!/usr/bin/env node
// shell-conformance.mjs — every drawn and built screen sits inside the ONE app
// shell the product really has, not one each worker invented.
//
//   node scripts/checks/shell-conformance.mjs <work-root | ui-record-dir | impl-record-dir | shell-dir> [--json]
//
// The shell record (.starciwork/shell/index.yaml, work/app-shell@1) is what the
// real frontend chrome IS: its layout component, top-bar slots and brand
// lockup, the nav registry with its labels per locale, the product locale, the
// demo persona, and rendered captures of the real shell and the lockup. Three
// parallel interface.draw workers of one cut each invented their own logo,
// sidebar, UI language and tenant (wf-nivo-modules-agentos) because none of
// that existed as a record. This check holds each consumer to it:
//
//   shell record   settled, captures present with their digests, the lockup
//                  captured, the default locale labelled on every nav item, and
//                  (origin: repository) its source files still hash as recorded.
//   ui record      binds the shell by {ref, rev} at its current rev (or says
//                  chromeless with a because); every generated direction's
//                  exact prompt carries each nav label, the product-locale
//                  marker and the persona verbatim, and handed ImageGen the
//                  lockup and a real-shell capture as reference images.
//   implementation the real layout component the shell record names wraps the
//                  owned screens (an owned file or an ancestor layout uses it).
//
// A work tree runs the shell record and every ui record. Exit 0 clean, 1 lists
// the refusals, 2 is a bad argument. `starci validate` reports only the
// binding findings, as suspects, through shellBindingFindings(): ui records
// drawn before this record existed stay valid and are listed for a redraw.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { readWorkspace, repoRootFor, resolveOwnedDirs } from '../example/example-ownership.mjs';

export const SHELL_SCHEMA = 'work/app-shell@1';
const UI_SCHEMA = 'work/ui-screen@1';
const IMPL_SCHEMA = 'work/implementation@1';
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.git', 'coverage', 'storybook-static']);
const SOURCE_FILE = /\.(?:tsx|jsx|ts|js|mjs|mdx)$/;
const LAYOUT_FILE = /^layout\.(?:tsx|jsx|ts|js)$/;

const slash = (p) => String(p).split(path.sep).join('/');
const sha256Of = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readRecord = (file) => { try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const escapeRe = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const list = (v) => (Array.isArray(v) ? v : []);

/** The Work root enclosing `dir`: the nearest `.starciwork`, or the nearest directory with a workspace.yaml. */
export function workRootOf(dir) {
  let at = path.resolve(dir);
  while (true) {
    if (path.basename(at) === '.starciwork' || fs.existsSync(path.join(at, 'workspace.yaml'))) return at;
    const parent = path.dirname(at);
    if (parent === at) return path.resolve(dir);
    at = parent;
  }
}

/** The tree's shell record: {file, dir, record} when it exists, {error} when it does not parse, null when absent. */
export function readShellRecord(workRoot) {
  const file = path.join(workRoot, 'shell', 'index.yaml');
  if (!fs.existsSync(file)) return null;
  const record = readRecord(file);
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { file, dir: path.dirname(file), error: 'does not parse as a YAML object' };
  return { file, dir: path.dirname(file), record };
}

/** The product locale a packet or a prompt uses: the shell's productLocale.default, else the brand voice default. */
export function productLocaleOf(workRoot) {
  const shell = readShellRecord(workRoot);
  const fromShell = shell?.record?.productLocale?.default;
  if (typeof fromShell === 'string' && fromShell.trim()) return { locale: fromShell.trim(), source: 'shell/index.yaml productLocale.default' };
  const brand = readRecord(path.join(workRoot, 'brand', 'index.yaml'));
  const locales = list(brand?.brand?.voice?.locales ?? brand?.voice?.locales);
  const tagOf = (entry) => (typeof entry === 'string' ? entry : entry?.locale ?? entry?.tag ?? null);
  const flagged = locales.find((entry) => entry && typeof entry === 'object' && entry.default === true);
  const chosen = tagOf(flagged ?? locales[0]);
  if (typeof chosen === 'string' && chosen.trim()) return { locale: chosen.trim(), source: `brand/index.yaml voice.locales ${flagged ? 'default' : 'first entry'}` };
  return null;
}

const finding = (level, code, file, message) => ({ level, code, file, message });
const shown = (workRoot, file) => slash(path.relative(path.dirname(workRoot), file)) || slash(file);

/** Findings about the shell record itself. `verifySource` compares recorded source digests with the repository. */
export function checkShellRecord(workRoot, shell, { verifySource = true, driftLevel = 'refuse' } = {}) {
  const out = [];
  const at = shown(workRoot, shell.file);
  if (shell.error) return [finding('refuse', 'SHELL_RECORD_INVALID', at, `the shell record ${shell.error}`)];
  const r = shell.record;
  if (r.schema !== SHELL_SCHEMA) out.push(finding('refuse', 'SHELL_RECORD_INVALID', at, `names schema ${r.schema ?? '(none)'}, not ${SHELL_SCHEMA}`));
  if (r.state !== 'done') out.push(finding('refuse', 'SHELL_UNSETTLED', at, `the shell record is ${r.state ?? 'stateless'}, not done - nothing may draw or build against an unsettled shell`));
  const assets = list(r.assets);
  for (const asset of assets) {
    if (!asset?.path) continue;
    const file = path.join(shell.dir, asset.path);
    if (!fs.existsSync(file)) { out.push(finding('refuse', 'SHELL_CAPTURE_MISSING', at, `assets names ${asset.path}, which is not on disk`)); continue; }
    if (asset.sha256 && sha256Of(file) !== asset.sha256) out.push(finding('refuse', 'SHELL_CAPTURE_DIGEST', at, `${asset.path} no longer hashes to its recorded sha256`));
  }
  if (!assets.some((a) => a?.role === 'brand-lockup')) out.push(finding('refuse', 'SHELL_LOCKUP_MISSING', at, 'no brand-lockup capture: the rendered brand lockup is what every direction is handed instead of an invented logo'));
  if (r.origin === 'repository' && !assets.some((a) => a?.role === 'shell-capture')) out.push(finding('refuse', 'SHELL_CAPTURE_MISSING', at, 'origin repository with no shell-capture: the real chrome was never rendered'));
  const locale = r.productLocale ?? {};
  const locales = list(locale.locales);
  if (locale.default && locales.length && !locales.includes(locale.default)) out.push(finding('refuse', 'SHELL_LOCALE_INVALID', at, `productLocale.default ${locale.default} is not one of productLocale.locales`));
  if (locale.fallback && locales.length && !locales.includes(locale.fallback)) out.push(finding('refuse', 'SHELL_LOCALE_INVALID', at, `productLocale.fallback ${locale.fallback} is not one of productLocale.locales`));
  for (const item of list(r.nav?.items)) {
    const label = item?.labels?.[locale.default];
    if (!(typeof label === 'string' && label.trim())) out.push(finding('refuse', 'SHELL_NAV_LABEL_MISSING', at, `nav item ${item?.key ?? '(unnamed)'} has no ${locale.default ?? '(unset)'} label - a direction cannot copy a label nobody recorded`));
  }
  if (verifySource && r.origin === 'repository' && r.source) {
    const repoRoot = repoRootFor(workRoot, r.app?.repository, readWorkspace(workRoot));
    const seen = new Set();
    for (const entry of [r.source.layout, ...list(r.source.files)]) {
      if (!entry?.path || !entry.sha256 || seen.has(entry.path)) continue;
      seen.add(entry.path);
      const file = path.join(repoRoot, entry.path);
      if (!fs.existsSync(file)) { out.push(finding('info', 'SHELL_SOURCE_UNAVAILABLE', at, `${entry.path} is not readable at ${slash(repoRoot)}; its digest could not be compared`)); continue; }
      if (sha256Of(file) !== entry.sha256) out.push(finding(driftLevel, 'SHELL_SOURCE_DRIFT', at, `${entry.path} changed since the shell record captured it - the owning op re-captures the shell and bumps rev before anything draws against it`));
    }
  }
  return out;
}

/** The labels, locale and persona strings a direction's prompt must carry verbatim. */
export function requiredPromptTerms(shellRecord, { chromeless = false } = {}) {
  const locale = shellRecord?.productLocale?.default ?? null;
  const labels = chromeless ? [] : list(shellRecord?.nav?.items).map((item) => item?.labels?.[locale]).filter((l) => typeof l === 'string' && l.trim());
  const p = shellRecord?.persona ?? {};
  const persona = chromeless ? [] : ['workspace', 'user', 'currency', 'dateFormat'].map((k) => p[k]).filter((v) => typeof v === 'string' && v.trim());
  return { locale, labels, persona };
}

const refersTo = (refs, shellAsset) => refs.some((ref) => slash(String(ref)).replace(/^\.?\//, '').endsWith(`shell/${slash(shellAsset.path).replace(/^\.?\//, '')}`));

/** Every generation-bearing asset of a ui record, from both asset lists, deduplicated by path. */
const generatedAssetsOf = (record) => {
  const byPath = new Map();
  for (const asset of [...list(record?.assets), ...list(record?.ui?.assets)]) if (asset?.generation && asset.path && !byPath.has(asset.path)) byPath.set(asset.path, asset);
  return [...byPath.values()];
};

/** Findings about one ui record's shell binding alone (no prompt read) - what `starci validate` reports. */
export function checkUiBinding(workRoot, uiFile, record, shell, { missingLevel = 'refuse', staleLevel = 'refuse' } = {}) {
  const at = shown(workRoot, uiFile);
  const binding = record?.shell;
  if (!binding || typeof binding !== 'object') return [finding(missingLevel, 'SHELL_BINDING_MISSING', at, `${record?.id ?? 'this ui record'} binds no shell - write shell: {ref: shell, rev: <n>} (or {chromeless: true, because}) and redraw inside the recorded chrome`)];
  if (binding.chromeless === true) return typeof binding.because === 'string' && binding.because.trim() ? [] : [finding('refuse', 'SHELL_BINDING_INVALID', at, 'chromeless without a because')];
  if (!shell) return [finding('refuse', 'SHELL_REF_UNRESOLVED', at, `binds shell ${binding.ref ?? '(no ref)'} but the tree has no shell/index.yaml`)];
  if (shell.error) return [];
  if (binding.ref !== 'shell') return [finding('refuse', 'SHELL_BINDING_INVALID', at, `shell.ref is ${binding.ref ?? '(none)'}, not shell`)];
  if (binding.rev !== shell.record.rev) return [finding(staleLevel, 'SHELL_REV_STALE', at, `bound to shell rev ${binding.rev ?? '(none)'}, the shell record is at rev ${shell.record.rev ?? '(none)'} - the direction is redrawn against the current chrome`)];
  if (binding.activeNav && !list(shell.record.nav?.items).some((item) => item?.key === binding.activeNav)) return [finding('refuse', 'SHELL_BINDING_INVALID', at, `activeNav ${binding.activeNav} is not a key of the shell nav registry`)];
  return [];
}

/** Findings about one ui record: its binding, then every generated direction's prompt and reference images. */
export function checkUiRecord(workRoot, uiFile, record, shell) {
  const out = checkUiBinding(workRoot, uiFile, record, shell);
  if (out.some((f) => f.level === 'refuse') || !shell || shell.error) return out;
  const chromeless = record.shell.chromeless === true;
  const at = shown(workRoot, uiFile);
  const assets = list(shell.record.assets);
  const lockups = assets.filter((a) => a?.role === 'brand-lockup');
  const captures = assets.filter((a) => a?.role === 'shell-capture');
  const terms = requiredPromptTerms(shell.record, { chromeless });
  const generated = generatedAssetsOf(record);
  if (!generated.length) out.push(finding('info', 'SHELL_NO_DIRECTION', at, 'no generated direction yet; only the binding was checked'));
  for (const asset of generated) {
    const promptPath = asset.generation.promptPath;
    const promptFile = promptPath ? path.join(path.dirname(uiFile), promptPath) : null;
    if (!promptFile || !fs.existsSync(promptFile)) { out.push(finding('refuse', 'SHELL_PROMPT_UNREADABLE', at, `${asset.path}: its prompt ${promptPath ?? '(none)'} is not on disk, so nothing shows what the direction was told about the chrome`)); continue; }
    const prompt = fs.readFileSync(promptFile, 'utf8');
    const missingLabels = terms.labels.filter((label) => !prompt.includes(label));
    if (missingLabels.length) out.push(finding('refuse', 'SHELL_NAV_LABEL_DRIFT', at, `${promptPath} omits the shell nav label(s) ${missingLabels.map((l) => JSON.stringify(l)).join(', ')} - copy the registry labels verbatim`));
    if (terms.locale && !new RegExp(`product[\\s_-]?locale\\s*[:=]\\s*${escapeRe(terms.locale)}(?![A-Za-z0-9-])`, 'i').test(prompt)) out.push(finding('refuse', 'SHELL_LOCALE_DRIFT', at, `${promptPath} does not state "Product locale: ${terms.locale}" - UI copy follows the shell productLocale, not owner_language`));
    const missingPersona = terms.persona.filter((value) => !prompt.includes(value));
    if (missingPersona.length) out.push(finding('refuse', 'SHELL_PERSONA_DRIFT', at, `${promptPath} omits the demo persona value(s) ${missingPersona.map((v) => JSON.stringify(v)).join(', ')} - use the shell persona, never an invented tenant`));
    const refs = [...list(asset.generation.referencedImages), ...list(asset.generation.inputRefs)];
    if (!lockups.some((a) => refersTo(refs, a))) out.push(finding('refuse', 'SHELL_LOCKUP_NOT_REFERENCED', at, `${asset.path} was not handed the shell brand-lockup capture as a reference image - a direction may not draw its own logo`));
    if (!chromeless && captures.length && !captures.some((a) => refersTo(refs, a))) out.push(finding('refuse', 'SHELL_CAPTURE_NOT_REFERENCED', at, `${asset.path} was not handed a real shell capture as a reference image`));
  }
  return out;
}

const sourceFilesUnder = (dir) => {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : sourceFilesUnder(full);
    return entry.isFile() && SOURCE_FILE.test(entry.name) ? [full] : [];
  });
};

/** Findings about one implementation record: the real layout component the shell names wraps its screens. */
export function checkImplementationRecord(workRoot, implFile, record, shell) {
  const at = shown(workRoot, implFile);
  if (!shell) return [finding('refuse', 'SHELL_RECORD_MISSING', at, 'the tree has no shell/index.yaml, so no layout component is named to build inside')];
  if (shell.error) return [];
  const out = checkShellRecord(workRoot, shell, { driftLevel: 'suspect' }).filter((f) => f.code !== 'SHELL_NAV_LABEL_MISSING');
  const layout = shell.record.source?.layout?.component;
  if (shell.record.origin !== 'repository' || !layout) {
    out.push(finding('refuse', 'SHELL_NOT_CAPTURED', at, 'the shell record is planned, not captured from source - the owning op captures the real layout before an implementation is held to it'));
    return out;
  }
  const workspaceDoc = readWorkspace(workRoot);
  const dirs = resolveOwnedDirs(record.id, { data: record }, new Map([[record.id, { schema: record.schema, data: record }]]), workspaceDoc, workRoot);
  const existing = dirs.filter((d) => fs.existsSync(d.abs));
  if (!existing.length) { out.push(finding('refuse', 'SHELL_LAYOUT_UNPROVEN', at, 'no owned directory exists on disk, so nothing shows the screens use the shell layout')); return out; }
  const uses = new RegExp(`(?<![A-Za-z0-9_$])${escapeRe(layout)}(?![A-Za-z0-9_$])`);
  const usesLayout = (file) => { try { return uses.test(fs.readFileSync(file, 'utf8')); } catch { return false; } };
  const repoRoot = repoRootFor(workRoot, record.repository, workspaceDoc);
  const ancestorsUse = (dir) => {
    for (let at2 = path.dirname(dir); at2.startsWith(repoRoot) && at2 !== path.dirname(at2); at2 = path.dirname(at2)) {
      let entries = [];
      try { entries = fs.readdirSync(at2); } catch { break; }
      if (entries.some((name) => LAYOUT_FILE.test(name) && usesLayout(path.join(at2, name)))) return true;
      if (path.resolve(at2) === path.resolve(repoRoot)) break;
    }
    return false;
  };
  const wrapped = existing.some((d) => {
    const stat = fs.statSync(d.abs);
    const files = stat.isDirectory() ? sourceFilesUnder(d.abs) : [d.abs];
    return files.some(usesLayout) || ancestorsUse(stat.isDirectory() ? path.join(d.abs, '_') : d.abs);
  });
  if (!wrapped) out.push(finding('refuse', 'SHELL_LAYOUT_UNUSED', at, `no owned file and no ancestor layout uses ${layout} (${shell.record.source.layout.path}) - the screen must sit in the real shell, not a chrome of its own`));
  return out;
}

const listYaml = (dir) => {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return ['node_modules', 'assets', 'evidence', 'runs', '_derived', 'kernel-evidence', 'kernel-strays', 'kernel-approvals'].includes(entry.name) ? [] : listYaml(full);
    return entry.name === 'index.yaml' ? [full] : [];
  });
};

/** Every ui record under `root`: [{file, record}]. */
const uiRecordsUnder = (root) => listYaml(root).map((file) => ({ file, record: readRecord(file) }))
  .filter(({ record }) => record?.schema === UI_SCHEMA);

/**
 * The binding findings `starci validate` reports for every ui record under `root`: a historical record
 * without a binding, or one bound to an older shell rev, is a suspect (it stays valid and is listed for a
 * redraw); a binding that resolves to nothing or names a foreign ref is refused.
 */
export function shellBindingFindings(root, workRoot = workRootOf(root)) {
  const shell = readShellRecord(workRoot);
  return uiRecordsUnder(root).flatMap(({ file, record }) => checkUiBinding(workRoot, file, record, shell, { missingLevel: 'suspect', staleLevel: 'suspect' }));
}

/** The whole check for one target: a work tree, a ui record dir, an implementation record dir or the shell dir. */
export function checkShellConformance(target) {
  const resolved = path.resolve(target);
  // A record's index.yaml names its directory: `.starciwork/shell/index.yaml` is the shell dir.
  const dir = fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? path.dirname(resolved) : resolved;
  const workRoot = workRootOf(dir);
  const shell = readShellRecord(workRoot);
  const indexFile = path.join(dir, 'index.yaml');
  const own = fs.existsSync(indexFile) ? readRecord(indexFile) : null;
  const findings = [];
  let mode;
  if (own?.schema === UI_SCHEMA) {
    mode = 'ui';
    if (shell && own.shell?.chromeless !== true) findings.push(...checkShellRecord(workRoot, shell));
    findings.push(...checkUiRecord(workRoot, indexFile, own, shell));
  } else if (own?.schema === IMPL_SCHEMA) {
    mode = 'implementation';
    findings.push(...checkImplementationRecord(workRoot, indexFile, own, shell));
  } else if (own?.schema === SHELL_SCHEMA) {
    mode = 'shell';
    findings.push(...checkShellRecord(workRoot, shell));
  } else {
    mode = 'tree';
    if (shell) findings.push(...checkShellRecord(workRoot, shell));
    else findings.push(finding('refuse', 'SHELL_RECORD_MISSING', shown(workRoot, path.join(workRoot, 'shell', 'index.yaml')), 'the tree has no shell record'));
    for (const { file, record } of uiRecordsUnder(dir)) findings.push(...checkUiRecord(workRoot, file, record, shell));
  }
  const pick = (level) => findings.filter((f) => f.level === level).map((f) => `${f.file}: ${f.message} [${f.code}]`);
  const refused = pick('refuse');
  return { schema: 'starci/shell-conformance@1', ok: refused.length === 0, mode, target: slash(dir), workRoot: slash(workRoot), refused, suspect: pick('suspect'), info: pick('info'), findings };
}

export function shellConformanceMain(argv = []) {
  const args = argv.filter((a) => a !== '--json');
  if (args.includes('--help') || args.includes('-h') || args.length !== 1) {
    return { exitCode: args.length === 1 ? 0 : 2, text: 'Usage: node scripts/checks/shell-conformance.mjs <work-root | ui-record-dir | impl-record-dir | shell-dir> [--json]\n\nHolds the shell record, every ui record\'s shell binding and direction prompts, and an implementation\'s layout to .starciwork/shell/index.yaml (work/app-shell@1). Exit 0 is clean, 1 lists refusals, 2 is a bad argument.\n' };
  }
  if (!fs.existsSync(args[0])) return { exitCode: 2, text: `${args[0]}: target does not exist\n` };
  const result = checkShellConformance(args[0]);
  if (argv.includes('--json')) return { exitCode: result.ok ? 0 : 1, text: `${JSON.stringify(result, null, 2)}\n` };
  const lines = [...result.refused.map((l) => `  REFUSED ${l}`), ...result.suspect.map((l) => `  SUSPECT ${l}`), ...result.info.map((l) => `  info    ${l}`)];
  return { exitCode: result.ok ? 0 : 1, text: `${lines.join('\n')}${lines.length ? '\n' : ''}${result.ok ? 'OK' : 'FAIL'}: shell conformance (${result.mode}) - ${result.refused.length} refused, ${result.suspect.length} suspect.\n` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = shellConformanceMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
