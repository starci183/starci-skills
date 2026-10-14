// feature-files.mjs - R292: a feature stays within ruleParams.featureFiles tracked files, in lite and full.
import { posixPath } from '../../lib/path-key.mjs';
import { found } from './read.mjs';

export const HFS_FEATURE_FILE_BUDGET = 'HFS_FEATURE_FILE_BUDGET';

/** Feature owners come from the slot manifest: BE trigger roots (including cli) and FE feature owners. */
const isFeature = (slot) => slot?.owner === true && slot.tier === 'feature' && (slot.trigger !== undefined || slot.id === 'fe.feature');

/** Count the complete tracked tree, even when a per-file check is scoped to only part of a feature. */
export function featureFileFindings({ files, all = files, repo, resolver, isRoot = repo.profile === 'app' }) {
  // The app check invokes this again for each side, with that side's paths and edition-aware parameters.
  if (isRoot || !['be', 'fe'].includes(repo.profile)) return [];
  const max = resolver.ruleParams().featureFiles ?? 250;
  const counts = new Map();
  for (const file of new Set(all.map(posixPath))) {
    if (!file || file.endsWith('/')) continue;
    const owner = resolver.ownerOf(file);
    if (!owner || !isFeature(resolver.slot(owner.slot))) continue;
    counts.set(owner.root, (counts.get(owner.root) ?? 0) + 1);
  }
  return [...counts].filter(([, count]) => count > max).map(([root, count]) => found(
    HFS_FEATURE_FILE_BUDGET,
    root,
    `${root} has ${count} tracked files, over the feature budget of ${max}; split it by product capability`,
    { files: count, max },
  ));
}
