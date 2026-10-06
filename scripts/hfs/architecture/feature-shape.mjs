import path from 'node:path';
import { treeOf } from './required-files.mjs';
import { allowsFile } from '../allows.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

/**
 * R29 `feature-shape` (BE_FEATURE_SHAPE). A feature root holds `index.ts`, `<feature>.module.ts`, `application/`,
 * `transport/<protocol>/` and `messages/` only, and each of those folders holds only what its slot `allows` (knowledge/hfs/
 * slots.yaml: be.feature, be.feature.application, be.feature.application.support, be.transport.*,
 * be.feature.messages). Every tracked file below a feature root is classified by the slot resolver and matched against
 * the `requires` and `allows` entries of the slot that owns it; a directory that no slot owns (an unknown protocol under
 * `transport/`, a `graphql/` folder under `application/`) is refused because its files fall back to the feature root slot.
 */
export const FEATURE_SHAPE_RULE_IDS = ['BE_FEATURE_SHAPE'];

const RULE = 'BE_FEATURE_SHAPE';

export function checkFeatureShape({ config, graph }) {
  const resolver = graph.resolver;
  const tree = treeOf(config.root);
  const violations = [];
  const features = new Set();
  let files = 0;
  const report = (file, message, extra = {}) => violations.push({ ruleId: RULE, path: file, line: 1, column: 1, message, ...extra });
  for (const file of [...tree.files].sort(byCodeUnit)) {
    const owner = resolver.ownerOf(file);
    if (!owner || resolver.slot(owner.slot)?.tier !== 'feature') continue;
    features.add(owner.root);
    files += 1;
    const verdict = allowsFile(resolver, file);
    if (!verdict) continue;
    const feature = path.posix.basename(owner.root);
    const where = `${verdict.slot} (${verdict.root})`;
    if (verdict.slot === owner.slot) {
      // A file the feature root slot itself allows is in place (the cli feature root allows its <group>/ folders); any other file
      // deeper than the root sits in a directory no slot claims.
      // A directory entry (`transport/`, `application/`) is held by its own slots: below it, only those slots admit a file.
      if (verdict.allowed && !String(verdict.entry ?? '').endsWith('/')) continue;
      if (verdict.relative.includes('/')) {
        const folder = verdict.relative.split('/')[0];
        report(file, `${file} sits in ${owner.root}/${folder}/, which no slot owns; a feature root holds only ${verdict.allows.join(', ')}, and transport/ holds one folder per protocol a slot names. Move it to application/ or a transport/<protocol>/ folder, or delete it.`,
          { feature, folder });
      } else if (!verdict.allowed) {
        report(file, `${file} is not allowed at the root of feature ${feature}; the root holds only ${verdict.allows.join(', ')}. Move it under application/ or transport/<protocol>/.`, { feature });
      }
      continue;
    }
    if (verdict.allowed) continue;
    const forbidden = verdict.forbiddenBy ? ` ${verdict.forbiddenBy} is forbidden there;` : '';
    report(file, `${file} is not allowed in ${where};${forbidden} that folder holds only ${verdict.allows.join(', ')}. Rename it to an allowed role or move it to the folder its role belongs to.`, { feature, slot: verdict.slot });
  }
  return { violations, coverage: { status: 'checked', features: features.size, files } };
}
