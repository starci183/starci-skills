// The projection contract is Source-owned; generated documents are Workflow-owned.
import { existsSync, lstatSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { workflowRootOf, sameRoot } from './workflow-root.mjs';
import { selfFingerprint } from './business-registry.mjs';
import { isRouteIdentifier } from './workspace-portable.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = file => JSON.parse(readFileSync(file, 'utf8'));
export const projectionContract = (root = ROOT) => load(path.join(root, 'templates/business-head/projection.json'));
const json = value => `${JSON.stringify(value, null, 2)}\n`;

function businessesLocation(root = ROOT) {
  const alias = load(path.join(root, 'alias/alias.json'));
  // Read the registered alias rather than deriving a product-specific storage path.
  const tree = alias.registry ?? alias;
  const find = value => value && typeof value === 'object' ? value['@worktrees']?.businesses ?? Object.values(value).map(find).find(Boolean) : null;
  const location = find(tree)?.resolvesTo?.split(/\s+/)[0];
  if (!location?.startsWith('<Workflow>/')) throw Error('businesses alias must resolve beneath <Workflow>');
  const relative = location.slice('<Workflow>/'.length);
  if (relative.replaceAll('\\', '/').split('/').includes('..') || path.isAbsolute(relative) || relative.includes('\\')) throw Error('businesses alias escapes Workflow');
  if (relative.split('<project>').length !== 2) throw Error('businesses alias must partition authority by <project>');
  return relative.replace(/\/$/, '');
}
export const businessesRootFor = (root = ROOT, state) => {
  if (!isRouteIdentifier(state?.project)) throw Error('businesses authority requires a safe project id from its owning session');
  return path.resolve(workflowRootOf(root, state), businessesLocation(root).replace('<project>', state.project));
};
export function businessRootProject(storeRoot, root = ROOT) {
  const [prefix, suffix] = businessesLocation(root).split('<project>');
  const value = String(storeRoot).replaceAll('\\', '/').replace(/\/$/, '');
  if (!value.endsWith(suffix)) return null;
  const before = value.slice(0, -suffix.length), cut = before.lastIndexOf(prefix);
  if (cut < 0 || cut > 0 && before[cut - 1] !== '/') return null;
  const project = before.slice(cut + prefix.length);
  return isRouteIdentifier(project) ? project : null;
}

export function businessHeadContractErrors(root = ROOT) {
  const contract = projectionContract(root), schema = load(path.join(root, 'templates/kinds/model.schema.json'));
  const errors = [];
  const sections = schema.$defs.documentation.properties.sections.required;
  const mapped = [];
  const roles = [];
  if (contract.version !== schema.$defs.documentation.properties.version.const) errors.push('business-head projection version differs from model documentation');
  for (const [name, rule] of Object.entries(contract.files)) {
    if (path.basename(name) !== name || !/^[A-Za-z][A-Za-z.-]+$/.test(name)) errors.push(`business-head projection: unsafe file ${name}`);
    if (!['context', 'section', 'spec', 'json'].includes(rule.render)) errors.push(`business-head projection: unknown renderer ${rule.render}`);
    if (rule.render === 'section') mapped.push(rule.section);
    if (rule.render === 'section' && name !== `${rule.section}.md`) errors.push(`business-head projection: section filename differs from ${rule.section}`);
    const expectedName = rule.render === 'json' ? `${rule.source}.json` : rule.render === 'context' ? `${rule.render.toUpperCase()}.md` : rule.render === 'spec' ? `${rule.render}.md` : null;
    if (expectedName && name !== expectedName) errors.push(`business-head projection: filename must be ${expectedName}`);
    if (rule.render !== 'section') roles.push(rule.render === 'json' ? rule.source : rule.render);
    if (rule.render === 'json' && !['model', 'evidence'].includes(rule.source)) errors.push(`business-head projection: unknown source ${rule.source}`);
  }
  if (JSON.stringify([...mapped].sort()) !== JSON.stringify([...sections].sort())) errors.push('business-head projection must map every model documentation section exactly once');
  if (JSON.stringify(roles.sort()) !== JSON.stringify(['context', 'evidence', 'model', 'spec'])) errors.push('business-head projection requires exactly one context, specification, model and evidence view');
  return errors;
}

export function businessDocumentErrors({ model, claims, coverage }, root = ROOT) {
  const errors = businessHeadContractErrors(root);
  for (const [kind, value] of Object.entries({ model, claims, 'coverage-matrix': coverage })) {
    errors.push(...validateAgainst(load(path.join(root, `templates/kinds/${kind}.schema.json`)), value, kind));
  }
  if (!model?.documentation) errors.push('model.documentation: a decided head requires the complete business documentation');
  if (errors.length) return errors;
  for (const [name, value, field] of [['model', model, 'headFingerprint'], ['claims', claims, 'fingerprint'], ['coverage', coverage, 'fingerprint']]) {
    if (value[field] !== selfFingerprint(value, field)) errors.push(`${name}: invalid self-fingerprint`);
    if (value.featureId !== model.featureId) errors.push(`${name}: featureId differs from model`);
  }
  if (model.claimsFingerprint !== claims.fingerprint) errors.push('model: claims fingerprint differs from evidence');
  if (model.coverageFingerprint !== coverage.fingerprint) errors.push('model: coverage fingerprint differs from evidence');
  const claimIds = new Set(claims.claims.map(c => c.claimId)), dimensions = new Set(coverage.dimensions);
  for (const [name, section] of Object.entries(model.documentation.sections)) {
    if ((Array.isArray(section.markdown) ? section.markdown : [section.markdown]).some(block => !block.trim())) errors.push(`documentation.${name}: empty content`);
    for (const id of section.claimIds) if (!claimIds.has(id)) errors.push(`documentation.${name}: unknown claim ${id}`);
    for (const id of section.dimensions) if (!dimensions.has(id)) errors.push(`documentation.${name}: unknown dimension ${id}`);
  }
  return errors;
}

export function projectBusinessHead(input, root = ROOT) {
  const errors = businessDocumentErrors(input, root);
  if (errors.length) throw Error(errors.join('\n'));
  const { model, claims, coverage } = input, contract = projectionContract(root);
  const evidence = { claims, coverage };
  const stamp = `Generated from [model.json](model.json) (${model.headFingerprint}) and [evidence.json](evidence.json).`;
  const sectionText = name => {
    const section = model.documentation.sections[name];
    const body = Array.isArray(section.markdown) ? section.markdown.join('\n\n') : section.markdown;
    return `${body}\n\nClaims: ${section.claimIds.map(id => `\`${id}\``).join(', ')}.\nCoverage: ${section.dimensions.map(id => `\`${id}\``).join(', ') || 'No enforcement dimension claimed'}.`;
  };
  const sectionFiles = Object.entries(contract.files).filter(([, rule]) => rule.render === 'section');
  const result = {};
  for (const [name, rule] of Object.entries(contract.files)) {
    if (rule.render === 'json') { result[name] = json({ model, evidence }[rule.source]); continue; }
    const body = rule.render === 'section' ? sectionText(rule.section)
      : rule.render === 'spec' ? sectionFiles.map(([, s]) => `## ${s.title}\n\n${sectionText(s.section)}`).join('\n\n')
        : `Feature: ${model.featureId}\n\nState: ${model.state}\n\n${model.promise.statement}\n\n${Object.entries(contract.files).filter(([file]) => file !== name).map(([file, s]) => `- [${s.title ?? file}](${file})`).join('\n')}`;
    result[name] = `# ${rule.title} — ${model.featureId}\n\n${stamp}\n\n${body}\n`;
  }
  return result;
}

export function headDirectory(storeRoot, model, root = ROOT) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(model.featureId ?? '')) throw Error('unsafe business featureId');
  const directory = path.join(storeRoot, 'features', model.featureId);
  const project = businessRootProject(storeRoot, root);
  if (!project) throw Error('business head root is not the project-partitioned businesses alias');
  const relative = path.join(businessesLocation(root).replace('<project>', project), 'features', model.featureId);
  const expected = path.isAbsolute(model.headRef) ? model.headRef : path.normalize(model.headRef ?? '') === relative ? directory : '';
  if (!sameRoot(expected, directory)) throw Error('model.headRef differs from the Workflow businesses feature directory');
  // Never write through an alias planted inside the authority worktree.
  assertNoLinkedAncestors(directory);
  return directory;
}

export function assertNoLinkedAncestors(directory) {
  for (let item = path.resolve(directory); path.dirname(item) !== item; item = path.dirname(item)) if (existsSync(item) && lstatSync(item).isSymbolicLink()) throw Error(`business head path is a symlink: ${item}`);
}

export function writeBusinessFile(file, bytes) {
  assertNoLinkedAncestors(file);
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try { writeFileSync(temp, bytes, { encoding: 'utf8', flag: 'wx' }); renameSync(temp, file); }
  finally { if (existsSync(temp)) unlinkSync(temp); }
}

export function writeBusinessHead(directory, files) {
  assertNoLinkedAncestors(directory);
  for (const name of Object.keys(files)) {
    if (path.basename(name) !== name || /[\\/:]/.test(name) || name === '.' || name === '..') throw Error(`unsafe business projection filename: ${name}`);
    if (existsSync(path.join(directory, name)) && lstatSync(path.join(directory, name)).isSymbolicLink()) throw Error(`business projection is a symlink: ${name}`);
  }
  mkdirSync(directory, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) writeBusinessFile(path.join(directory, name), bytes);
}

export function verifyBusinessHead(storeRoot, input, root = ROOT) {
  try {
    const directory = headDirectory(storeRoot, input.model, root), files = projectBusinessHead(input, root);
    return Object.entries(files).flatMap(([name, bytes]) => {
      const file = path.join(directory, name);
      if (!existsSync(file)) return [`business head: missing ${name}`];
      if (lstatSync(file).isSymbolicLink()) return [`business head: symlink ${name}`];
      return readFileSync(file, 'utf8') === bytes ? [] : [`business head: ${name} drifted from model/evidence projection`];
    });
  } catch (error) { return [error.message]; }
}
