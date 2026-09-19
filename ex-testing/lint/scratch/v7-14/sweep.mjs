/**
 * v7-14 mechanical residual sweep (read-only inventory).
 *
 * The gate (scripts/check-example-work.mjs) checks owners[].path/module for existence but never looks at
 * composes[].module, never resolves inputRefs as paths, never compares a repository field against the
 * workspace entry / impl directory segment, and never executes the schemas' required lists. This script
 * walks both example .starciwork trees and reports exactly those mechanical mismatches, with the base it
 * resolved against and, where a unique existing directory matches by name, a candidate retarget.
 *
 * It writes nothing into the trees; output goes to stdout (TSV-ish) and findings.json in this directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../core/yaml.mjs';
import {readWorkspace, repoRootFor, moduleRootOf} from '../../../../scripts/example-ownership.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const HOST = path.resolve(here, '../../../..'); // .claude
const ID_RE = /^(br|ac|fr|nfr|data|journey|decision|sds|ui|impl|uat|contract|integration|gap|event)\.[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const SCHEMA_DIR = path.join(HOST, 'schemas');

const TREES = [
  {name: 'todo', workRoot: path.join(HOST, 'examples/todo-app-backend/.starciwork')},
  {name: 'ecom', workRoot: path.join(HOST, 'examples/ecommerce-app-be/.starciwork')},
];

/** Keys whose scalar value is meant to be a path of some kind. */
const PATH_KEYS = new Set(['path', 'promptPath', 'directionAsset', 'run', 'accounts', 'module', 'evidence', 'captures', 'spec', 'master']);
/** Keys whose value(s) are references that are either a record id or a path. */
const REF_KEYS = new Set(['inputRefs', 'sources', 'inputs']);

/** A Windows/UNC machine path — the only thing that is a filesystem path written for one box. */
const isMachineAbsolute = (s) => /^[A-Za-z]:[\\/]/.test(s) || /^([\\/]{2})/.test(s);
/** A URL route or a scheme-qualified address (`/tasks`, `postgres://…`): a wire path, never a file path. */
const isWirePath = (s) => s.startsWith('/') || /^[a-z][a-z0-9+.-]*:\/\//i.test(s);
const looksLikePath = (s) => /(^|\/)[\w.[-]+/.test(s) && (s.includes('/') || /\.\w{2,5}$/.test(s));

function walkFiles(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, {withFileTypes: true}); } catch { return out; }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(abs, out);
    else out.push(abs);
  }
  return out;
}

/** All repo roots that exist beside a tree: the be repo (parent of .starciwork) and every sibling dir. */
function candidateBases(workRoot, repository, workspaceDoc) {
  const backendRoot = path.dirname(workRoot);
  const bases = [
    ['recordDir', null], // filled per-record by the caller
    ['workRoot', workRoot],
    ['beRepo', backendRoot],
    ['host', HOST],
  ];
  if (repository) bases.push(['repository:' + repository, repoRootFor(workRoot, repository, workspaceDoc)]);
  const examplesDir = path.dirname(backendRoot);
  for (const entry of fs.readdirSync(examplesDir, {withFileTypes: true})) {
    if (entry.isDirectory()) bases.push(['sibling:' + entry.name, path.join(examplesDir, entry.name)]);
  }
  return bases;
}

/** Try to resolve `value` against the candidate bases; return the first hit {base, abs} or null. */
function resolvePath(value, bases, recordDir) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const v = value.trim();
  if (isMachineAbsolute(v)) return null;
  const cleaned = v.replace(/\/\*\*?$/, '');
  for (const [name, base] of bases) {
    const root = name === 'recordDir' ? recordDir : base;
    if (!root) continue;
    const abs = path.join(root, cleaned);
    if (fs.existsSync(abs)) return {base: name, abs};
  }
  return null;
}

/** Unique existing directory under the record's repo whose basename matches the broken value's basename. */
function uniqueNameMatch(value, repoRoot) {
  const base = path.basename(moduleRootOf(value));
  if (!base || base === '.' || base === '/' || base.includes('.')) return null;
  const hits = [];
  const stack = [repoRoot];
  let guard = 0;
  while (stack.length && guard++ < 20000) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, {withFileTypes: true}); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (['node_modules', 'dist', '.next', '.git'].includes(e.name)) continue;
      const abs = path.join(dir, e.name);
      if (e.name === base) hits.push(path.relative(repoRoot, abs).replaceAll('\\', '/'));
      stack.push(abs);
    }
  }
  return hits.length === 1 ? hits[0] : null;
}

/** Load schemas/work-*.schema.yaml once, keyed by the `schema:` value their properties.schema.const names. */
function loadSchemas() {
  const byName = new Map();
  for (const file of fs.readdirSync(SCHEMA_DIR).filter(f => /^work-.*\.schema\.yaml$/.test(f))) {
    let doc;
    try { doc = parseYaml(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8')); } catch { continue; }
    const constName = doc?.properties?.schema?.const;
    if (!constName) continue;
    byName.set(constName, {file: `schemas/${file}`, required: Array.isArray(doc.required) ? doc.required : [], properties: doc.properties || {}});
  }
  return byName;
}

/** Walk a trail produced by visit() (`ui.assets[0].path`) back to its containing node's sibling value. */
function nodeAt(root, trail) {
  let current = root;
  for (const part of trail.split('.')) {
    const m = part.match(/^([\w$-]+)(?:\[(\d+)\])?$/);
    if (!m || current == null || typeof current !== 'object') return undefined;
    current = current[m[1]];
    if (m[2] != null && Array.isArray(current)) current = current[Number(m[2])];
  }
  return current;
}

/** Whether a required field is present anywhere in the record, including one nested family namespace
 * (`ui.states`, `sds.states`) — the example layout namespaces family fields, the schemas list them flat. */
function fieldValue(data, field) {
  if (field in data) return data[field];
  for (const value of Object.values(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && field in value) return value[field];
  }
  return undefined;
}
const hasField = (data, field) => fieldValue(data, field) !== undefined;

const SCHEMAS = loadSchemas();

/** Walk an object tree, calling visit(value, trail, node) for every scalar/array entry. */
function visit(node, trail, fn) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => visit(item, `${trail}[${i}]`, fn));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) visit(value, trail ? `${trail}.${key}` : key, fn);
    return;
  }
  fn(node, trail);
}

const findings = [];
const push = (f) => findings.push(f);

for (const tree of TREES) {
  const {workRoot, name: treeName} = tree;
  const workspaceDoc = readWorkspace(workRoot);
  const repoNames = (Array.isArray(workspaceDoc?.repositories) ? workspaceDoc.repositories : []).map(r => r?.name).filter(Boolean);
  const yamlFiles = walkFiles(workRoot).filter(f => f.endsWith('.yaml'));
  const recordsById = new Map();
  const docs = [];

  for (const file of yamlFiles) {
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    if (rel.startsWith('_derived/') || rel.startsWith('_local/') || rel === 'ledger-anchor.json') continue;
    let data;
    try { data = parseYaml(fs.readFileSync(file, 'utf8')); } catch (e) {
      push({tree: treeName, file: rel, check: 'YAML_PARSE', value: e.message});
      continue;
    }
    if (!data || typeof data !== 'object') continue;
    docs.push({file, rel, data, isEvidence: rel.endsWith('/evidence.yaml')});
    if (data.id && !rel.endsWith('/evidence.yaml')) {
      if (recordsById.has(data.id)) {
        push({tree: treeName, file: rel, check: 'DUPLICATE_ID', value: data.id, suggestion: recordsById.get(data.id).rel});
      }
      recordsById.set(data.id, {rel, data});
    }
  }

  const byDir = new Map(docs.map(d => [path.dirname(d.rel), d]));

  for (const doc of docs) {
    const {file, rel, data, isEvidence} = doc;
    const recordDir = path.dirname(file);
    // A run manifest / evidence file describes the record beside it; its paths resolve against that
    // record's repository, and its digests are regenerated by the evidence lanes, never hand-edited.
    const owner = isEvidence ? byDir.get(path.dirname(rel))?.data : data;
    const repository = owner?.repository ?? data.repository;
    const isPayload = isEvidence || /(^|\/)(runs|assets)\//.test(rel) || rel.endsWith('/manifest.yaml');
    const bases = candidateBases(workRoot, repository, workspaceDoc).map(([b, abs]) => [b, abs]);
    // A record that names an inspection root (`brand.grammar.resolvedPath`, `sources[].inspectionRoot`)
    // hangs its `inspectedFiles[].path` values off that directory, so it is a legitimate base too. The
    // machine-absolute ones are normalized onto the host by their first recognizable anchor.
    const roots = [];
    visit(data, '', (value, trail) => {
      if (typeof value !== 'string') return;
      if (!/(resolvedPath|inspectionRoot|(^|\.)root)$/.test(trail)) return;
      for (const candidate of [value, value.replace(/^.*?workspaces[^/]*\/(?:[^/]+\/)?/, '')]) {
        const m = candidate.match(/((?:examples|knowledge|scripts|src|packages)\/.*)$/);
        if (!m) continue;
        const abs = path.join(HOST, m[1]);
        if (fs.existsSync(abs) && !roots.includes(abs)) roots.push(abs);
      }
    });
    const basesWithDir = [['recordDir', recordDir], ...bases, ...roots.map((r, i) => [`namedRoot[${i}]`, r])];
    const beRepo = path.dirname(workRoot);
    const codeBases = [['repository:' + (repository ?? ''), repoRootFor(workRoot, repository, workspaceDoc)], ['beRepo', beRepo]];

    // ---- 1. owners[].path / module: (gate-checks these; reported for cross-check only) ----
    const ownerPaths = [];
    if (typeof data.module === 'string') ownerPaths.push(['module', data.module]);
    if (Array.isArray(data.module)) data.module.forEach((m, i) => typeof m === 'string' && ownerPaths.push([`module[${i}]`, m]));
    if (Array.isArray(data.owners)) data.owners.forEach((o, i) => o?.path && ownerPaths.push([`owners[${i}].path`, o.path]));
    for (const [trail, value] of ownerPaths) {
      const hit = resolvePath(value, codeBases, recordDir);
      if (!hit) {
        push({tree: treeName, file: rel, check: 'OWNER_PATH_MISSING', trail, value,
          suggestion: uniqueNameMatch(value, repoRootFor(workRoot, repository, workspaceDoc))});
      }
    }

    // ---- 2. composes[].module: unchecked by the gate ----
    if (Array.isArray(data.composes)) {
      data.composes.forEach((c, i) => {
        if (!c || typeof c !== 'object') return;
        const value = c.module;
        if (typeof value !== 'string' || !value.trim()) return;
        const hit = resolvePath(value, codeBases, recordDir);
        if (!hit) {
          const target = recordsById.get(c.rule || c.id || c.record);
          const targetModule = typeof target?.data?.module === 'string' ? target.data.module : Array.isArray(target?.data?.module) ? target.data.module[0] : null;
          const targetOk = targetModule ? resolvePath(targetModule, codeBases, recordDir) : null;
          push({tree: treeName, file: rel, check: 'COMPOSES_MODULE_MISSING', trail: `composes[${i}].module`, value,
            ruleId: c.rule || c.id || c.record || null, ruleModule: targetModule, ruleModuleExists: !!targetOk,
            suggestion: targetOk ? targetModule : uniqueNameMatch(value, repoRootFor(workRoot, repository, workspaceDoc))});
        }
      });
    }

    // ---- 3/4. every other path-keyed scalar ----
    visit(data, '', (value, trail) => {
      if (typeof value !== 'string' || !value.trim()) return;
      const key = trail.replace(/\[\d+\]$/, '').split('.').pop();

      if (isMachineAbsolute(value)) {
        push({tree: treeName, file: rel, check: 'ABSOLUTE_MACHINE_PATH', trail, value, payload: isPayload});
        return;
      }
      if (isWirePath(value) || !looksLikePath(value)) return;

      if (PATH_KEYS.has(key) || REF_KEYS.has(key)) {
        const id = value.trim();
        if (/\s/.test(id)) return; // prose, a cron expression, or a sentence — not a path
        if (ID_RE.test(id) && recordsById.has(id)) return; // a record id, not a path
        if (id === 'brand' && recordsById.has('brand')) return;
        // artworkSlots[].master.path is relative to the record the master names, not to this record.
        const masterId = key === 'path' && trail.endsWith('.master.path') ? nodeAt(data, trail.replace(/\.path$/, '.record')) : null;
        const masterOf = typeof masterId === 'string' ? recordsById.get(masterId) : null;
        const masterBase = masterOf ? [['masterRecord:' + masterId, path.join(workRoot, path.dirname(masterOf.rel))], ...basesWithDir] : basesWithDir;
        const hit = resolvePath(value, masterBase, recordDir);
        if (!hit) {
          push({tree: treeName, file: rel, check: isPayload ? 'PAYLOAD_PATH_UNRESOLVED' : 'PATH_UNRESOLVED', trail, value,
            suggestion: uniqueNameMatch(value, beRepo)});
        }
      }
      if (key !== 'command' && !trail.includes('command')) {
        // Prose fields carry commands too (`nfr.*.measurement.how: k6 run scripts/load/list.js …`), and a
        // harness named only in prose is invisible to every structured check in the tree.
        const prose = value.match(/(?:k6 run|node|npx|vitest|jest|bash|sh|python)\s+((?:\.\/)?[\w][\w./-]*\.(?:m?js|ts|sh|py))\b/g) ?? [];
        for (const hit of prose) {
          const p = hit.replace(/^(?:k6 run|node|npx|vitest|jest|bash|sh|python)\s+/, '').replace(/^\.\//, '');
          if (!p.includes('/')) continue;
          const roots = [repoRootFor(workRoot, repository, workspaceDoc), beRepo, HOST];
          if (!roots.some(root => fs.existsSync(path.join(root, p.replace(/\/\*\*?$/, ''))))) {
            push({tree: treeName, file: rel, check: isPayload ? 'PAYLOAD_PROSE_PATH_MISSING' : 'PROSE_PATH_MISSING', trail, value: p});
          }
        }
      }
      if (key === 'command' || trail.includes('command')) {
        // A command may run in another repository of the same example (`cd ../todo-app-frontend && npx vitest
        // run src/hooks/auth/useSignIn.spec.ts`), so the cd target is a base for the paths it names.
        const cdMatch = value.match(/cd\s+["']?([^\s"&|]+)/);
        const cdBases = cdMatch
          ? [path.resolve(path.dirname(repoRootFor(workRoot, repository, workspaceDoc)), cdMatch[1]),
             path.resolve(beRepo, cdMatch[1])]
          : [];
        const tokens = value.match(/(?:^|\s)(?:\.\/)?((?:src|packages|apps|scripts|test|tests)\/[\w./[\]*-]+)/g) || [];
        for (const token of tokens) {
          const p = token.trim().replace(/^\.\//, '');
          const clean = p.replace(/\/\*\*?$/, '');
          const repoRoots = [...cdBases, repoRootFor(workRoot, repository, workspaceDoc), beRepo, HOST];
          const ok = repoRoots.some(root => fs.existsSync(path.join(root, clean)));
          if (!ok) push({tree: treeName, file: rel, check: isPayload ? 'PAYLOAD_COMMAND_PATH_MISSING' : 'COMMAND_PATH_MISSING', trail, value: p,
            cwd: cdMatch ? cdMatch[1] : null});
        }
      }
    });

    // ---- 5. repository field vs workspace + impl directory segment ----
    if (data.repository && !isPayload) {
      if (!repoNames.includes(data.repository)) {
        push({tree: treeName, file: rel, check: 'REPOSITORY_NOT_IN_WORKSPACE', trail: 'repository', value: data.repository,
          workspace: repoNames.join(', ')});
      }
      const segments = rel.split('/');
      const at = segments.lastIndexOf('impl');
      if (at >= 0 && segments[at + 1] && segments[at + 1] !== data.repository) {
        push({tree: treeName, file: rel, check: 'REPOSITORY_DIR_MISMATCH', trail: 'repository', value: data.repository,
          dir: segments[at + 1]});
      }
    }

    // ---- 6. schema: declared vs required fields / patterns ----
    if (!isEvidence && data.schema && !['work/catalog', 'work/workspace', 'work/brand', 'work/feature', 'work/disposable-accounts', 'starci/application-stacks', 'work/resource', 'work/evidence'].includes(data.schema)) {
      const schema = SCHEMAS.get(data.schema);
      if (!schema) {
        push({tree: treeName, file: rel, check: 'SCHEMA_UNKNOWN', trail: 'schema', value: data.schema});
      } else {
        const legacy = data.schema === 'work/implementation' ? ['directory', 'files'] : [];
        const missing = schema.required.filter(k => !hasField(data, k) && !legacy.includes(k));
        if (missing.length) push({tree: treeName, file: rel, check: 'SCHEMA_REQUIRED_MISSING', trail: 'schema', value: data.schema, missing: missing.join(', ')});
        for (const [k, spec] of Object.entries(schema.properties)) {
          if (!hasField(data, k) || typeof data[k] !== 'string' || !spec?.pattern) continue;
          if (!new RegExp(spec.pattern).test(data[k])) {
            push({tree: treeName, file: rel, check: 'SCHEMA_PATTERN', trail: k, value: data[k], pattern: spec.pattern, schema: data.schema, schemaFile: schema.file});
          }
        }
      }
    }
  }

  // ---- 7. catalog index.yaml <-> features directories (report only, v7-5 owns the file) ----
  const catalogFile = path.join(workRoot, 'index.yaml');
  if (fs.existsSync(catalogFile)) {
    const catalog = parseYaml(fs.readFileSync(catalogFile, 'utf8'));
    const entries = Array.isArray(catalog?.features) ? catalog.features : [];
    const listed = new Map(entries.map(f => [f?.id ?? path.basename(f?.directory ?? ''), f?.directory]));
    const dirs = fs.readdirSync(path.join(workRoot, 'features'), {withFileTypes: true}).filter(e => e.isDirectory()).map(e => e.name);
    for (const d of dirs) if (!listed.has(d)) push({tree: treeName, file: 'index.yaml', check: 'CATALOG_MISSING_DIR', value: d});
    for (const [id, directory] of listed) {
      if (!dirs.includes(id)) push({tree: treeName, file: 'index.yaml', check: 'CATALOG_DIR_ABSENT', value: id});
      if (directory && !fs.existsSync(path.join(workRoot, directory))) {
        push({tree: treeName, file: 'index.yaml', check: 'CATALOG_DIRECTORY_PATH_MISSING', value: `${id} -> ${directory}`});
      }
    }
  }
}

const counts = {};
for (const f of findings) counts[f.check] = (counts[f.check] ?? 0) + 1;
fs.writeFileSync(path.join(here, 'findings.json'), JSON.stringify(findings, null, 2));
for (const [check, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`${String(n).padStart(5)}  ${check}`);
}
console.log(`\n${findings.length} finding(s); findings.json written to ${here}`);
for (const f of findings) {
  const extra = [f.suggestion && `-> ${f.suggestion}`, f.missing && `missing[${f.missing}]`, f.dir && `dir=${f.dir}`, f.workspace && `workspace[${f.workspace}]`, f.ruleModule && `ruleModule=${f.ruleModule}${f.ruleModuleExists ? ' (exists)' : ''}`].filter(Boolean).join(' ');
  console.log(`${f.tree}\t${f.check}\t${f.file}\t${f.trail ?? ''}\t${f.value ?? ''}${extra ? `	${extra}` : ''}`);
}
