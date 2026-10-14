// The ledger part of R247. Inventories come from the existing slot/rule catalogs and
// example files; ledger rows describe their coverage, never a second inventory.
import { parseYaml } from '../../../engine/yaml.mjs';
import { isPlainObject } from '../../../engine/plain-object.mjs';
import { judgedInEdition, slotInEdition, effectiveSlot } from '../../hfs/edition-slots.mjs';

const SURFACES_PATH = 'knowledge/hfs/surfaces.yaml';
const REQUIREMENT_DOCS = ['docs/application-stacks.md', 'docs/lite-edition.md', 'docs/microservices.md', 'docs/host-secrets.md'];
const HARD_REQUIREMENT = /\b(?:must|never|only|required|forbidden)\b|\bis\s+refused\b/i;
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
function list(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}
const strings = (value) => list(value).filter(nonempty);
const finding = (code, path, message, extra = {}) => ({ code, level: 'error', path, message, ...extra });

function rowsOf(document, key) {
  const rows = isPlainObject(document) && document[key] !== undefined ? document[key] : document;
  if (Array.isArray(rows)) return rows.filter(isPlainObject);
  if (!isPlainObject(rows)) return [];
  return Object.entries(rows).filter(([, row]) => isPlainObject(row)).map(([id, row]) => ({ id, ...row }));
}

function rulesByReference(catalog) {
  const rules = new Map();
  for (const rule of catalog?.rules ?? []) {
    for (const key of [rule.id, rule.code, ...list(rule.failureCodes)]) if (nonempty(key)) rules.set(key, rule);
  }
  return rules;
}

/** A common schema is a vocabulary, not a record family. Record families declare a discriminator. */
function discriminatorsOf(document) {
  if (!isPlainObject(document)) return [];
  const discriminator = document.properties?.schema;
  const own = isPlainObject(discriminator) ? [discriminator.const, ...list(discriminator.enum)].filter(nonempty) : [];
  return [...new Set([...own, ...['allOf', 'oneOf', 'anyOf'].flatMap((key) => list(document[key]).flatMap(discriminatorsOf))])];
}

function schemaRecordFindings({ schemas = [], examples = [], files = new Map() }) {
  const records = new Set();
  for (const example of examples) {
    if (example.edition !== 'full') continue;
    for (const file of example.files ?? []) {
      if (!/\.(?:ya?ml|json)$/i.test(file) || !files.has(file)) continue;
      try {
        const record = parseYaml(files.get(file));
        if (isPlainObject(record) && nonempty(record.schema)) records.add(record.schema);
      } catch {
        // Invalid or non-record documents cannot stand in for an example record.
      }
    }
  }
  return schemas.flatMap(({ path, document }) => {
    if (document?.generated === true) return [];
    const families = discriminatorsOf(document);
    if (!families.length || families.some((family) => records.has(family))) return [];
    return [finding('RT_COVERAGE_SCHEMA_NO_RECORD', path, `Work schema ${families.join(' or ')} has no record in a full-edition example.`, { edition: 'full' })];
  });
}

function gapReason(value) {
  return nonempty(value) || (isPlainObject(value) && nonempty(value.reason));
}

function editionsOf(row, editions) {
  if (Array.isArray(row.editions)) return row.editions.filter((edition) => editions.includes(edition));
  if (isPlainObject(row.editions)) return editions.filter((edition) => Object.hasOwn(row.editions, edition));
  return editions;
}

function cellOf(row, edition) {
  const specific = row[edition] ?? row.coverage?.[edition] ?? (isPlainObject(row.editions) ? row.editions[edition] : undefined);
  return isPlainObject(specific) ? { ...row, ...specific } : row;
}

function slotRuleReferences(slot, manifest, edition) {
  const profiles = slot.profiles?.length ? slot.profiles : manifest.profiles ?? ['app'];
  return profiles.flatMap((profile) => strings(effectiveSlot(slot, profile, edition).rules));
}

function surfaceCellFindings(row, edition, { manifest, slots, rules, covered }) {
  const id = row.id ?? row.surface ?? '(unnamed surface)';
  const cell = cellOf(row, edition);
  const slotIds = strings(cell.slots ?? cell.slot);
  const applicableSlots = slotIds.map((slot) => slots.get(slot)).filter((slot) => slot && slotInEdition(manifest, slot, edition));
  const declaredRules = strings(cell.rules ?? cell.rule);
  const references = declaredRules.length ? declaredRules : applicableSlots.flatMap((slot) => slotRuleReferences(slot, manifest, edition));
  const applicableRules = references.map((rule) => rules.get(rule)).filter((rule) => rule && judgedInEdition(rule, edition));
  const mapped = applicableSlots.length > 0 && applicableRules.length > 0;
  if (!mapped && !gapReason(cell.gap)) return [finding('RT_COVERAGE_SURFACE_UNMAPPED', SURFACES_PATH, `Surface ${id} has no applicable rule and slot for edition ${edition}; declare their mapping or gap: reason.`, { edition, rules: references })];
  for (const slot of applicableSlots) covered.add(`${slot.id}@${edition}`);
  return [];
}

function missingSurfaceCells({ slots, manifest, editions, covered, surfaces }) {
  // A ledger cannot silently omit a newly added slot. This is the derived surface
  // inventory, including slots whose lite view forbids a construct.
  const missingLedger = surfaces === null || surfaces === undefined ? '; the surfaces ledger is missing' : '';
  return [...slots.values()].flatMap((slot) => editions.filter((edition) => slotInEdition(manifest, slot, edition) && !covered.has(`${slot.id}@${edition}`))
    .map((edition) => finding('RT_COVERAGE_SURFACE_UNMAPPED', SURFACES_PATH, `Slot ${slot.id} has no surface mapping for edition ${edition}${missingLedger}.`, { edition, slot: slot.id })));
}

function surfaceFindings({ catalog, manifest = {}, surfaces }) {
  const editions = manifest.editions ?? ['lite', 'full'];
  const slots = new Map((manifest.slots ?? []).map((slot) => [slot.id, slot]));
  const covered = new Set();
  const rows = rowsOf(surfaces, 'surfaces');
  const inventory = { manifest, slots, rules: rulesByReference(catalog), covered };
  const findings = rows.flatMap((row) => editionsOf(row, editions).flatMap((edition) => surfaceCellFindings(row, edition, inventory)));
  findings.push(...missingSurfaceCells({ slots, manifest, editions, covered, surfaces }));
  if (!rows.length && !slots.size && (surfaces === null || surfaces === undefined)) findings.push(finding('RT_COVERAGE_SURFACE_UNMAPPED', SURFACES_PATH, 'The surfaces ledger is missing; surface coverage cannot be established.'));
  return findings;
}

function proseText(text, preserveUnderscores = false) {
  const formatting = preserveUnderscores ? /[`*~]/g : /[`*_~]/g;
  return text.replace(/!?\[([^\][\n]*)\]\([^()\n]*\)/g, '$1')
    .replace(/<[^<>\n]*>/g, '').replace(formatting, '').replace(/\s+/g, ' ').trim();
}

function headingSlug(text) {
  return proseText(text, true).toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
}

function flushRequirements(state) {
  const prose = proseText(state.block.join(' '));
  for (const sentence of prose.split(/(?<=[.!?])\s+(?=\S)/u)) {
    if (HARD_REQUIREMENT.test(sentence)) state.requirements.push({ anchor: state.anchor, text: sentence, line: state.blockLine });
  }
  state.block = [];
}

function applyHeading(state, title) {
  flushRequirements(state);
  const explicit = title.trimEnd().match(/\{#([A-Za-z0-9_.:-]+)\}$/);
  const plainTitle = explicit ? title.slice(0, explicit.index).trimEnd() : title;
  const slug = headingSlug(plainTitle);
  const count = state.slugs.get(slug) ?? 0;
  state.slugs.set(slug, count + 1);
  state.anchor = explicit?.[1] ?? slug + (count ? '-' + count : '');
  state.anchors.add(state.anchor);
}

function skipFence(state, line) {
  const mark = line.match(/^\s{0,3}(`{3,}|~{3,})/);
  if (!mark) return state.fence !== null;
  if (!state.fence) { flushRequirements(state); state.fence = mark[1]; }
  else if (mark[1][0] === state.fence[0] && mark[1].length >= state.fence.length) state.fence = null;
  return true;
}

function markdownHeading(lines, index) {
  const atx = lines[index].match(/^ {0,3}#{1,6}[\t ]+/);
  if (atx) return { title: lines[index].slice(atx[0].length).trimEnd(), advance: 0 };
  if (nonempty(lines[index]) && /^ {0,3}(?:={3,}|-{3,})\s*$/.test(lines[index + 1] ?? '')) return { title: lines[index], advance: 1 };
  return null;
}

function applyHtmlAnchor(state, line) {
  const tag = line.match(/<a\b[^<>\n]*>/i);
  const anchor = tag?.[0].match(/\b(?:id|name)=["']([^"']+)["']/i);
  if (!anchor) return;
  flushRequirements(state);
  state.anchor = anchor[1];
  state.anchors.add(state.anchor);
}

function appendRequirementLine(state, line, index) {
  const trimmed = line.trim();
  if (!trimmed || (trimmed.includes('|') && /^[| :\t-]+$/.test(trimmed))) { flushRequirements(state); return; }
  const table = trimmed.startsWith('|');
  if (/^\s*(?:[-+*]|\d+[.)])\s+/.test(line) || table) flushRequirements(state);
  if (!state.block.length) state.blockLine = index + 1;
  state.block.push(line.replace(/^\s*(?:[-+*]|\d+[.)])\s+/, '').replace(/^\s*>\s?/, ''));
  if (table) flushRequirements(state);
}

/** Resolve Markdown anchors and collect hard prose, omitting fenced examples and comments. */
function documentRequirements(text) {
  const lines = text.replace(/<!--([\s\S]*?)-->/g, (comment) => comment.replace(/[^\n]/g, '')).split(/\r?\n/);
  const state = { anchors: new Set(), slugs: new Map(), requirements: [], anchor: '', block: [], blockLine: 1, fence: null };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (skipFence(state, line)) continue;
    applyHtmlAnchor(state, line);
    const heading = markdownHeading(lines, index);
    if (heading) { applyHeading(state, heading.title); index += heading.advance; }
    else appendRequirementLine(state, line, index);
  }
  flushRequirements(state);
  return { anchors: state.anchors, requirements: state.requirements };
}

function docReference(value) {
  const reference = typeof value === 'string' ? value : value?.path ?? value?.doc ?? value?.source;
  if (!nonempty(reference)) return null;
  const [path, anchor, extra] = reference.split('#');
  if (extra !== undefined || !nonempty(path) || !nonempty(anchor) || path.startsWith('/') || path.includes('\\') || path.split('/').some((part) => ['', '.', '..'].includes(part))) return null;
  return { path, anchor };
}

const validDocReference = (docs, reference) => reference && docs.get(reference.path)?.anchors.has(reference.anchor);

function requirementLinks(catalog, requirements, docs) {
  const rules = rulesByReference(catalog);
  const links = [];
  for (const rule of catalog?.rules ?? []) {
    for (const doc of list(rule.docs)) {
      const reference = docReference(doc);
      if (validDocReference(docs, reference)) links.push(reference);
    }
  }
  const rows = rowsOf(requirements, 'requirements');
  const idCounts = new Map();
  for (const row of rows) idCounts.set(row.id, (idCounts.get(row.id) ?? 0) + 1);
  for (const row of rows) {
    const reference = docReference(row.doc ?? row.source ?? row.path);
    if (!nonempty(row.id) || idCounts.get(row.id) !== 1 || !validDocReference(docs, reference) || !['enforced', 'owed', 'advisory'].includes(row.status)) continue;
    const refs = strings(row.rules ?? row.rule);
    if (row.status === 'enforced' && (!refs.length || refs.some((ref) => !rules.has(ref)))) continue;
    links.push({ ...reference, text: nonempty(row.text) ? proseText(row.text) : undefined });
  }
  return links;
}

function requirementFindings({ catalog, requirements, files = new Map() }) {
  const docs = new Map(REQUIREMENT_DOCS.filter((path) => files.has(path)).map((path) => [path, documentRequirements(files.get(path))]));
  const links = requirementLinks(catalog, requirements, docs);
  return [...docs].flatMap(([path, doc]) => doc.requirements.filter((requirement) => !links.some((link) => link.path === path && link.anchor === requirement.anchor && (link.text === undefined || link.text === requirement.text)))
    .map((requirement) => {
      const reference = path + (requirement.anchor ? '#' + requirement.anchor : '');
      return finding('RT_COVERAGE_REQUIREMENT_UNLEDGERED', path, `Hard requirement at ${reference}:${requirement.line} has no valid requirements ledger entry or rule.docs anchor: ${requirement.text.slice(0, 220)}`);
    }));
}

/** Static ledger findings over the caller's safe source-text snapshot; this helper never reads files. */
export function coverageLedgerFindings(context) {
  return [...schemaRecordFindings(context), ...surfaceFindings(context), ...requirementFindings(context)];
}
