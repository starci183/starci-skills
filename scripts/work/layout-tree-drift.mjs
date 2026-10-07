// layout-tree-drift.mjs — the message keys a layout tree uses and what moved since it was scanned
// (scripts/work/layout-tree.mjs sourceDrift). A message catalog is shared by every workflow, so a whole-file digest
// stales the tree on every unrelated string. The tree records the keys it USES - nav labels (i18nKey), layout titles
// (titleKey) and any key a node, layout, destination or capture names - and one digest of their values per locale. A
// catalog change stales the tree only when a used key's value changed or a used key disappeared.
import { byCodeUnit } from '../lib/list.mjs';
import { scanTools } from './layout-tree-scan.mjs';
import { list, sha256Of } from './work-io.mjs';

const getPath = scanTools.getPath;
const KEY_FIELDS = new Set(['i18nKey', 'titleKey', 'labelKey', 'messageKey']);
const KEY_LISTS = new Set(['i18nKeys', 'messageKeys']);

const addUsedKey = (item, keys) => { if (typeof item === 'string' && item.trim()) keys.add(item.trim()); };

/** Every message key the tree references, sorted and unique. */
function addUsedKeys(value, keys) {
  if (Array.isArray(value)) { for (const item of value) { addUsedKeys(item, keys); } return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (KEY_FIELDS.has(key)) addUsedKey(item, keys);
    else if (KEY_LISTS.has(key)) { for (const entry of list(item)) addUsedKey(entry, keys); }
    else addUsedKeys(item, keys);
  }
}

export function usedI18nKeys(record) {
  const keys = new Set();
  addUsedKeys(record?.nodes, keys);
  addUsedKeys(record?.brand, keys);
  return [...keys].sort(byCodeUnit);
}

/** One digest of the used keys' values in a catalog: key and value per line, an absent key marked absent. */
function digestValueOf(value) {
  if (value === undefined) { return '\u0001absent'; }
  if (typeof value === 'string') { return value; }
  return JSON.stringify(value);
}

function keyedDigest(messages, keys) {
  return sha256Of(list(keys).map((k) => {
    const v = getPath(messages ?? {}, k);
    return `${k}\0${digestValueOf(v)}`;
  }).join('\n'));
}

/** i18n.used: {keys, locales: [{locale, sha256}]} for parsed catalogs ({locale, messages}). */
export function keyedI18n(catalogs, keys) {
  return { keys: [...keys], locales: list(catalogs).map((c) => ({ locale: c.locale, sha256: keyedDigest(c.messages, keys) })) };
}

const catalogSet = (catalogs) => list(catalogs).map((c) => `${c.locale} ${c.path}`).sort(byCodeUnit);

function sourceDigestChanges(record, scan, nodes, freshNodes, changed) {
  if (!record?.source?.digest || scan.source?.digest === record.source.digest) return;
  const before = changed.length;
  for (const node of nodes.filter((item) => item.origin !== 'planned')) {
    const fresh = freshNodes.get(node.id);
    if (!fresh) { changed.push(`${node.id} removed`); continue; }
    for (const [kind, file] of Object.entries(node.files ?? {})) {
      if (file?.sha256 && fresh.files?.[kind]?.sha256 !== file.sha256) changed.push(`${node.id} ${kind}`);
    }
  }
  const ids = new Set(nodes.map((node) => node.id));
  for (const id of freshNodes.keys()) { if (!ids.has(id)) changed.push(`${id} added`); }
  if (changed.length === before) changed.push('a navigation source');
}

function navItemChanges(node, key, item, next, changed) {
  if (!next) { changed.push(`${node.id} nav ${key} removed`); return; }
  if ((item?.i18nKey ?? null) !== (next.i18nKey ?? null)) { changed.push(`${node.id} nav ${key} now reads ${next.i18nKey ?? 'no message key'}`); return; }
  for (const locale of new Set([...Object.keys(item?.labels ?? {}), ...Object.keys(next.labels ?? {})])) {
    if (item?.labels?.[locale] !== next.labels?.[locale]) changed.push(node.id + ' nav ' + key + ' ' + locale + ' label' + (item?.i18nKey ? ' (' + item.i18nKey + ')' : ''));
  }
}

function navigationChanges(nodes, freshNodes, changed) {
  for (const node of nodes.filter((item) => item.origin !== 'planned' && item.layout?.nav)) {
    const fresh = freshNodes.get(node.id);
    if (!fresh) continue;
    const before = new Map(list(node.layout.nav.items).map((item) => [item?.key, item]));
    const after = new Map(list(fresh.layout?.nav?.items).map((item) => [item?.key, item]));
    for (const [key, item] of before) navItemChanges(node, key, item, after.get(key), changed);
    for (const key of after.keys()) { if (!before.has(key)) changed.push(`${node.id} nav ${key} added`); }
  }
}

function usedI18nChanges(used, scan, changed, unkeyed) {
  if (unkeyed) { changed.push('the tree records no keyed i18n digest (i18n.used.keys) - re-scan it'); return; }
  if (!Array.isArray(used?.keys)) return;
  for (const catalog of list(scan.catalogs)) {
    const was = list(used.locales).find((locale) => locale?.locale === catalog.locale)?.sha256;
    if (!was || keyedDigest(catalog.messages, used.keys) === was) continue;
    const gone = used.keys.filter((key) => getPath(catalog.messages, key) === undefined);
    changed.push(catalog.locale + ' used key values' + (gone.length ? ' (absent now: ' + gone.slice(0, 4).join(', ') + ')' : ''));
  }
}

/** What moved in app/ against a fresh scan, as the (possibly repeating) change lines; `nodes` are the recorded tree's nodes. */
export function driftChanges(record, scan, nodes) {
  const changed = [];
  const recorded = list(record?.i18n?.catalogs);
  const used = record?.i18n?.used;
  const unkeyed = recorded.length > 0 && !Array.isArray(used?.keys);
  const freshNodes = new Map(list(scan.nodes).map((node) => [node.id, node]));
  sourceDigestChanges(record, scan, nodes, freshNodes, changed);
  const freshCatalogs = list(scan.i18n?.catalogs);
  if (catalogSet(recorded).join('\n') !== catalogSet(freshCatalogs).join('\n')) changed.push(`the message catalogs (${freshCatalogs.map((c) => c.path).join(', ') || 'none'} now)`);
  navigationChanges(nodes, freshNodes, changed);
  // Every used key (titles, capture keys, labels): the keyed digest per locale. A record without the keyed
  // digest is stale: re-scan writes it.
  usedI18nChanges(used, scan, changed, unkeyed);
  return changed;
}
