// work-graph-context.mjs — what the Work tree already decides for a work graph's domains: the FR ids once business
// exists (minus the scope's exclusions) and the XBase#state shapes once drawings exist. The validator
// (work-graph-model.mjs validateGraph) checks coverage against it.
import fs from 'node:fs';
import path from 'node:path';
import { indexFilesUnder, list, readYamlOrNull } from './work-io.mjs';
import { byCodeUnit } from '../lib/list.mjs';

const recordsUnder = (dir) => (fs.existsSync(dir) ? indexFilesUnder(dir).filter((f) => path.dirname(f) !== dir).map(readYamlOrNull).filter(Boolean) : []);

/** The shapes a ui record declares (`ui.shapes[]`, modules/schemas/work-ui-screen.schema.yaml), each as XBase#state. */
const shapesOfUiRecord = (record) => list(record?.ui?.shapes).filter((s) => s?.base && s?.state).map((s) => `${s.base}#${s.state}`);

function collectFeatureContext(features, domain, frs, shapes, excluded) {
  const feature = readYamlOrNull(path.join(features, domain, 'index.yaml'));
  for (const x of list(feature?.extensions?.work3?.scope?.exclusions)) if (x?.subject) excluded.add(String(x.subject));
  for (const r of recordsUnder(path.join(features, domain, 'fr'))) if (r.id && r.schema?.startsWith('work/functional-requirement')) frs.add(String(r.id));
  for (const r of recordsUnder(path.join(features, domain, 'ui'))) for (const s of shapesOfUiRecord(r)) shapes.add(s);
}

/** {frs, shapes} over the domains (feature ids) under `<repo>/.starciwork/features`. */
export function workGraphContext(repo, domains) {
  const features = path.join(repo, '.starciwork', 'features');
  const frs = new Set(), shapes = new Set(), excluded = new Set();
  for (const domain of domains) collectFeatureContext(features, domain, frs, shapes, excluded);
  return { frs: [...frs].filter((id) => !excluded.has(id)).sort(byCodeUnit), shapes: [...shapes].sort(byCodeUnit) };
}
