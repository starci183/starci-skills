// Concept 6 of check-work-consistency.mjs: the catalog and the feature node under it.
//
// The catalog is the tree's table of contents and the work/feature@1 node is the same feature described a
// second time. Two copies of one fact is where drift lives: check-work-deep.mjs's CATALOG_DRIFT compares
// directory names to entries, so it stays silent about an entry whose feature directory exists but holds
// no feature record, and about a record whose title no longer says what the catalog says it says.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../engine/yaml.mjs';
import { fromRoot } from './work-consistency-shared.mjs';

const normaliseSentence = value => {
  let text = String(value ?? '').trim();
  while (text.endsWith('.') || text.endsWith('!') || text.endsWith('?')) text = text.slice(0, -1);
  return text.replace(/\s+/g, ' ');
};

/** The work/feature@1 record a catalog entry's directory holds, or null when absent or unreadable. */
function featureOf(featureFile) {
  try { return fs.existsSync(featureFile) ? parseYaml(fs.readFileSync(featureFile, 'utf8')) : null; } catch { return null; }
}

function checkCatalogEntry({ workRoot, refuse, suspect }, catalogShown, entry) {
  const entryId = String(entry?.id ?? '');
  const entryShown = `${catalogShown} (feature entry ${entryId || '(unnamed)'})`;
  const featureFile = path.join(workRoot, String(entry?.directory ?? ''), 'index.yaml');
  const featureShown = fromRoot(featureFile);
  const feature = featureOf(featureFile);
  if (feature?.schema !== 'work/feature@1') {
    refuse(entryShown, 'CATALOG_DIRTY', `entry points at ${featureShown}, which is ${feature ? 'a ' + feature.schema : 'absent'} - every catalog entry needs a work/feature@1 node beside it`);
    return;
  }
  if (feature.id !== entryId) refuse(entryShown, 'CATALOG_DIRTY', `entry id is ${entryId} but the feature record beside it is ${feature.id}`);
  if (path.basename(String(entry?.directory ?? '')) !== entryId) {
    refuse(entryShown, 'CATALOG_DIRTY', `entry id is ${entryId} while its directory is named ${path.basename(String(entry?.directory ?? ''))} - the id is the second segment of every record under it`);
  }
  const catalogSentence = normaliseSentence(entry.description);
  const titleSentence = normaliseSentence(feature.title);
  if (catalogSentence === titleSentence) return;
  const truncated = catalogSentence.startsWith(titleSentence) || titleSentence.startsWith(catalogSentence);
  suspect(entryShown, 'CATALOG_TITLE_DRIFT',
    `the catalog describes the feature as "${entry.description}" while the feature node titles it "${feature.title}" - ${truncated ? 'one is the other truncated' : 'two different sentences about one feature'}`);
}

export function checkCatalog(ctx) {
  const catalogFile = path.join(ctx.workRoot, 'index.yaml');
  let catalog = null;
  try { catalog = parseYaml(fs.readFileSync(catalogFile, 'utf8')); } catch { catalog = null; }
  const catalogShown = fromRoot(catalogFile);
  if (!catalog?.features) {
    ctx.refuse(catalogShown, 'CATALOG_DIRTY', 'no readable work/catalog@1 features list at the tree root, so nothing here can be reconciled with it');
    return;
  }
  for (const entry of catalog.features) checkCatalogEntry(ctx, catalogShown, entry);
}
