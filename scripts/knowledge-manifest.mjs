import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { validateAgainst } from './json-schema.mjs';

const BINDING_DIRS = {
  '@knowledge/ui/composition': 'knowledge/ui/composition',
  '@knowledge/ui/presentation': 'knowledge/ui/presentation',
  '@knowledge/ui/proof': 'knowledge/ui/proof',
};

const posix = (value) => value.split(path.sep).join('/');
const sha = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const stable = (value) => JSON.stringify(value, Object.keys(value).sort());
const authorityOf = (relative) => relative.endsWith('.vi.md') ? 'mirror' : /\/INDEX\.md$/.test(relative) ? 'catalog' : relative.endsWith('.md') ? 'canonical' : 'asset';

function filesUnder(directory) {
  const out = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(absolute));
    else if (/\.md$/i.test(entry.name) || /calibration\.(?:json)$/i.test(entry.name) || /anchor-[^.]+\.html$/i.test(entry.name)) out.push(absolute);
  }
  return out;
}

function markdownInventory(text) {
  const lines = text.split(/\r?\n/);
  const rules = [];
  let current = null;
  for (const line of lines) {
    const heading = /^##\s+([A-Z][A-Z0-9-]*-(?:[0-9]+|[A-Z][A-Z0-9-]*))\b(?:\s+[—-]\s+(.+))?/.exec(line);
    if (heading) {
      current = { id: heading[1], heading: (heading[2] ?? heading[1]).trim(), cases: [] };
      rules.push(current);
      continue;
    }
    const caseRow = /^\|\s*Case\s+([0-9]+)\s*\|/i.exec(line);
    if (caseRow && current) current.cases.push(`Case ${caseRow[1]}`);
  }
  return rules;
}

function calibrationInventory(text) {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed.anchors) ? parsed.anchors.map((anchor) => String(anchor.id)).sort() : [];
  } catch { return []; }
}

export function resolveKnowledgeBindings(bindings, family) {
  return [...new Set(bindings)].sort().map((binding) => {
    if (binding === '@knowledge/grammars/<family>' || binding === '@knowledge/grammars') {
      if (!/^[a-z][a-z0-9-]*$/.test(String(family ?? ''))) throw new Error('the route family must be resolved before binding family knowledge');
      return { binding: `@knowledge/grammars/${family}`, directory: `knowledge/grammars/${family}` };
    }
    if (binding.startsWith('@knowledge/grammars/')) {
      const name = binding.slice('@knowledge/grammars/'.length);
      if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`invalid grammar family binding ${binding}`);
      return { binding, directory: `knowledge/grammars/${name}` };
    }
    const directory = BINDING_DIRS[binding];
    if (!directory) throw new Error(`unknown knowledge binding ${binding}`);
    return { binding, directory };
  });
}

export function buildKnowledgeManifest(root, bindings, { family } = {}) {
  const resolved = resolveKnowledgeBindings(bindings, family);
  const files = [];
  for (const { binding, directory } of resolved) {
    const absoluteDirectory = path.join(root, directory);
    if (!existsSync(absoluteDirectory)) throw new Error(`${binding}: directory ${directory} does not exist`);
    for (const absolute of filesUnder(absoluteDirectory).sort()) {
      const bytes = readFileSync(absolute);
      const relative = posix(path.relative(root, absolute));
      const text = bytes.toString('utf8');
      files.push({
        binding,
        path: relative,
        sha256: sha(bytes),
        authority: authorityOf(relative),
        rules: relative.endsWith('.md') && !relative.endsWith('.vi.md') ? markdownInventory(text) : [],
        cases: relative.endsWith('calibration.json') ? calibrationInventory(text) : [],
      });
    }
  }
  if (resolved.some(({ binding }) => binding.startsWith('@knowledge/ui/'))) {
    for (const relative of ['knowledge/ui/INDEX.md', 'knowledge/ui/INDEX.vi.md']) {
      const index = path.join(root, ...relative.split('/'));
      if (!existsSync(index)) throw new Error(`@knowledge/ui: ${relative} does not exist`);
      const bytes = readFileSync(index);
      files.push({ binding: '@knowledge/ui', path: relative, sha256: sha(bytes), authority: relative.endsWith('.vi.md') ? 'mirror' : 'catalog', rules: relative.endsWith('.vi.md') ? [] : markdownInventory(bytes.toString('utf8')), cases: [] });
    }
  }
  if (resolved.some(({ binding }) => binding.startsWith('@knowledge/grammars/'))) {
    for (const relative of ['knowledge/grammars/INDEX.md', 'knowledge/grammars/INDEX.vi.md']) {
      const index = path.join(root, ...relative.split('/'));
      if (!existsSync(index)) throw new Error(`@knowledge/grammars: ${relative} does not exist`);
      const bytes = readFileSync(index);
      files.push({ binding: '@knowledge/grammars', path: relative, sha256: sha(bytes), authority: relative.endsWith('.vi.md') ? 'mirror' : 'catalog', rules: [], cases: [] });
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const body = { schemaVersion: 10, bindings: resolved.map(({ binding }) => binding), files };
  return { ...body, fingerprint: sha(Buffer.from(JSON.stringify(body))) };
}

export function manifestEntities(manifest) {
  const entities = [];
  for (const file of manifest.files ?? []) {
    entities.push({ key: `file:${file.path}`, kind: 'file', source: file.path });
    for (const rule of file.rules ?? []) {
      entities.push({ key: `rule:${rule.id}`, kind: 'rule', source: file.path });
      for (const caseName of rule.cases ?? []) entities.push({ key: `case:${rule.id}/${caseName}`, kind: 'case', source: file.path });
    }
    for (const caseName of file.cases ?? []) entities.push({ key: `case:calibration/${caseName}`, kind: 'case', source: file.path });
  }
  return entities.sort((a, b) => a.key.localeCompare(b.key));
}

const evidencePath = (value) => String(value).split('#')[0];

export function knowledgeManifestErrors({ root, branchDir, bindings, family }) {
  const errors = frozenKnowledgeManifestErrors({ root, branchDir, bindings, family });
  const manifestFile = path.join(branchDir, 'request', 'knowledge-manifest.json');
  if (errors.length) return errors;
  const frozen = JSON.parse(readFileSync(manifestFile, 'utf8'));
  let actual;
  try { actual = buildKnowledgeManifest(root, bindings, { family }); } catch (error) { return [error.message]; }
  if (JSON.stringify(frozen) !== JSON.stringify(actual)) errors.push('request/knowledge-manifest.json: stale or incomplete against the authored knowledge filesystem');
  return errors;
}

export function frozenKnowledgeManifestErrors({ root, branchDir, bindings, family }) {
  const manifestFile = path.join(branchDir, 'request', 'knowledge-manifest.json');
  if (!existsSync(manifestFile)) return ['request/knowledge-manifest.json: missing the frozen exact knowledge manifest'];
  let frozen;
  try { frozen = JSON.parse(readFileSync(manifestFile, 'utf8')); } catch { return ['request/knowledge-manifest.json: invalid JSON']; }
  const errors = [];
  try {
    const contract = JSON.parse(readFileSync(path.join(root, 'templates/kinds/knowledge-manifest.schema.json'), 'utf8'));
    errors.push(...validateAgainst(contract, frozen, 'request/knowledge-manifest.json'));
  } catch (error) { errors.push(`request/knowledge-manifest.json: schema cannot be loaded (${error.message})`); }
  let resolved = [];
  try { resolved = resolveKnowledgeBindings(bindings, family); } catch (error) { errors.push(error.message); }
  const expectedBindings = resolved.map(({ binding }) => binding);
  if (JSON.stringify(frozen.bindings ?? []) !== JSON.stringify(expectedBindings)) errors.push('request/knowledge-manifest.json: bindings differ from the routed operation knowledge contract');
  const body = { schemaVersion: frozen.schemaVersion, bindings: frozen.bindings, files: frozen.files };
  if (frozen.fingerprint !== sha(Buffer.from(JSON.stringify(body)))) errors.push('request/knowledge-manifest.json: fingerprint does not bind its exact semantic inventory');
  const seenPaths = new Set();
  const seenEntities = new Set();
  for (const file of frozen.files ?? []) {
    const relative = String(file?.path ?? '');
    if (path.isAbsolute(relative) || path.win32.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some((part) => !part || part === '.' || part === '..')) errors.push(`request/knowledge-manifest.json: unsafe path ${relative || '(missing)'}`);
    if (seenPaths.has(relative)) errors.push(`request/knowledge-manifest.json: duplicate file ${relative}`);
    seenPaths.add(relative);
    const expectedAuthority = relative.endsWith('.vi.md') ? 'mirror' : /\/INDEX\.md$/.test(relative) ? 'catalog' : relative.endsWith('.md') ? 'canonical' : 'asset';
    if (file.authority !== expectedAuthority) errors.push(`${relative}: authority must be ${expectedAuthority}`);
    if (file.authority !== 'canonical' && (file.rules?.length ?? 0) > 0) errors.push(`${relative}: only canonical English knowledge publishes rule authority`);
    if (['mirror', 'catalog'].includes(file.authority) && (file.cases?.length ?? 0) > 0) errors.push(`${relative}: mirrors and catalogs publish no Case authority`);
    const owner = resolved.find(({ binding }) => binding === file.binding);
    if (owner && relative !== owner.directory && !relative.startsWith(`${owner.directory}/`)) errors.push(`${relative}: leaves binding ${file.binding}`);
    if (!owner && !['@knowledge/ui', '@knowledge/grammars'].includes(file.binding)) errors.push(`${relative}: unknown file binding ${file.binding}`);
  }
  for (const entity of manifestEntities(frozen)) {
    if (seenEntities.has(entity.key)) errors.push(`request/knowledge-manifest.json: duplicate semantic address ${entity.key}`);
    seenEntities.add(entity.key);
  }
  for (const { binding } of resolved) if (!(frozen.files ?? []).some((file) => file.binding === binding)) errors.push(`request/knowledge-manifest.json: ${binding} has no inventoried file`);
  if (expectedBindings.some((binding) => binding.startsWith('@knowledge/ui/'))) for (const required of ['knowledge/ui/INDEX.md', 'knowledge/ui/INDEX.vi.md']) if (!seenPaths.has(required)) errors.push(`request/knowledge-manifest.json: missing ${required}`);
  if (expectedBindings.some((binding) => binding.startsWith('@knowledge/grammars/'))) for (const required of ['knowledge/grammars/INDEX.md', 'knowledge/grammars/INDEX.vi.md']) if (!seenPaths.has(required)) errors.push(`request/knowledge-manifest.json: missing ${required}`);
  return errors;
}

export function knowledgeCoverageErrors({ root, branchDir, bindings, family, status = 'done' }) {
  if (status !== 'done') return [];
  const errors = knowledgeManifestErrors({ root, branchDir, bindings, family });
  const manifestFile = path.join(branchDir, 'request', 'knowledge-manifest.json');
  const coverageFile = path.join(branchDir, 'response', 'data', 'knowledge-coverage.json');
  if (!existsSync(coverageFile)) errors.push('response/data/knowledge-coverage.json: missing exact file/rule/case coverage');
  if (errors.length || !existsSync(manifestFile) || !existsSync(coverageFile)) return errors;
  let frozen, coverage;
  try { frozen = JSON.parse(readFileSync(manifestFile, 'utf8')); } catch { return errors; }
  try { coverage = JSON.parse(readFileSync(coverageFile, 'utf8')); } catch { return [...errors, 'response/data/knowledge-coverage.json: invalid JSON']; }
  if (coverage.manifestFingerprint !== frozen.fingerprint) errors.push('response/data/knowledge-coverage.json: manifestFingerprint differs from the frozen request');
  const expected = manifestEntities(frozen);
  const expectedKeys = expected.map(({ key }) => key);
  const rows = Array.isArray(coverage.items) ? coverage.items : [];
  const keys = rows.map((row) => row?.key);
  if (new Set(keys).size !== keys.length) errors.push('response/data/knowledge-coverage.json: duplicate coverage key');
  if (JSON.stringify([...keys].sort((a, b) => String(a).localeCompare(String(b)))) !== JSON.stringify(expectedKeys)) errors.push('response/data/knowledge-coverage.json: file/rule/case keys are not the exact frozen set');
  let applicable = 0;
  for (const row of rows) {
    if (row?.applicability === 'applicable') {
      applicable += 1;
      if (!String(row.actual ?? '').trim()) errors.push(`${row.key}: applicable coverage requires actual`);
      if (!Array.isArray(row.evidence) || !row.evidence.some((item) => String(item).trim())) errors.push(`${row.key}: applicable coverage requires evidence`);
    } else if (row?.applicability === 'n/a') {
      const reason = String(row.reason ?? '').trim();
      if (reason.length < 12 || /^(?:n\/?a|not applicable|none)$/i.test(reason)) errors.push(`${row.key}: n/a requires a specific reason`);
      if (!Array.isArray(row.evidence) || !row.evidence.some((item) => String(item).trim())) errors.push(`${row.key}: n/a requires evidence for applicability`);
    } else errors.push(`${row?.key ?? '(missing key)'}: applicability must be applicable or n/a`);
    for (const evidence of Array.isArray(row?.evidence) ? row.evidence : []) {
      const ref = evidencePath(evidence);
      const absolute = ref.startsWith('response/') || ref.startsWith('request/') ? path.join(branchDir, ref) : ref.startsWith('knowledge/') ? path.join(root, ref) : null;
      if (!absolute || !existsSync(absolute)) errors.push(`${row.key}: evidence ${evidence} is not a resolvable request, response, or knowledge ref`);
    }
    if ((row?.kind === 'rule' || String(row?.key).startsWith('rule:') || String(row?.key).startsWith('case:')) && row?.applicability === 'applicable') {
      if (!(row.evidence ?? []).some((item) => /^response\/(?:artifacts|data)\//.test(String(item)))) errors.push(`${row.key}: an applicable rule/case needs operation evidence under response/artifacts or response/data`);
    }
  }
  if (rows.length && applicable === 0) errors.push('response/data/knowledge-coverage.json: blanket n/a coverage is not a review');
  return errors;
}

export const fingerprintJson = (value) => sha(Buffer.from(stable(value)));
