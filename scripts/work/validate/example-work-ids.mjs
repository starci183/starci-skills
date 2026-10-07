// The record-id vocabulary of the example Work standard (check-example-work.mjs): the family folders, the
// reference-shaped id, the id a record's place derives and the depth each family's schema admits.
export const FAMILIES = new Set(['br', 'ac', 'fr', 'nfr', 'data', 'journey', 'decision', 'sds', 'ui', 'impl', 'uat', 'contract', 'integration', 'gap', 'event']);
export const EXEMPT = new Set(['work/catalog@1', 'work/workspace@1', 'work/brand@1', 'work/feature@1', 'work/disposable-accounts@1']);
export const KERNEL_CUSTODY_ROOTS = new Set(['kernel-evidence', 'kernel-strays', 'kernel-approvals']);
/** A reference-shaped id: a record family prefix and at least two dot segments. */
export const ID_RE = /^(br|ac|fr|nfr|data|journey|decision|sds|ui|impl|uat|contract|integration|gap|event)\.[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** The id a record in this directory must carry: the innermost family, the feature, then the rest in order. */
export const expectedId = segments => {
  const feature = segments[1];
  const rest = segments.slice(2, -1);
  const family = [...rest].reverse().find(segment => FAMILIES.has(segment));
  if (!family) return null;
  return [family, feature, ...rest.filter(segment => !FAMILIES.has(segment))].join('.');
};

/**
 * The fewest dot-segments after the family prefix each family's JSON schema id pattern admits
 * (modules/schemas/work-*.schema.yaml `id.pattern` `{N,}`; tests/checks/work-place-depth.spec.mjs holds the two
 * in step). The place rule derives an id from any depth, so without this a record can sit where its id
 * matches its place yet its own schema refuses the id: impl/index.yaml derives impl.<feature> and
 * impl/<repository>/index.yaml derives impl.<feature>.<repository>, both below
 * impl.<feature>.<repository>.<name>.
 */
export const MIN_ID_SEGMENTS = Object.freeze({ impl: 3, ac: 3 });
export const DEFAULT_MIN_ID_SEGMENTS = 2;
const FAMILY_PLACE = Object.freeze({
  impl: 'features/<feature>/impl/<repository>/<name>/index.yaml',
  ac: 'features/<feature>/br/<rule>/ac/<name>/index.yaml',
});
/** The PLACE_TOO_SHALLOW finding for a place-derived id shallower than its family admits, or null. */
export const placeDepthFinding = (shown, want) => {
  const [family, ...rest] = String(want ?? '').split('.');
  const min = MIN_ID_SEGMENTS[family] ?? DEFAULT_MIN_ID_SEGMENTS;
  if (!family || rest.length >= min) return null;
  const place = FAMILY_PLACE[family] ?? `features/<feature>/${family}/<name>/index.yaml`;
  const article = /^[aeiou]/.test(family) ? 'an' : 'a';
  return `${shown}: its place derives ${want}, but ${article} ${family} id carries at least ${min} segment(s) after the family, so its schema refuses that id under --strict; ${article} ${family} record lives at ${place} - move it there (and re-point refs to its new id) rather than keep a scope record above the family's depth [PLACE_TOO_SHALLOW]`;
};

/**
 * The layout tree names, on each planned visible layout, the surface-layout ui record that will draw it
 * (`layout.design`, written by brand.decide through `layout-tree.mjs plan --design` before any frontend
 * exists). interface.draw creates that record afterwards under exactly that id, so until then the pointer is
 * a plan, not a dangling edge (inc-fc946155a081). Only a node that is still origin planned and whose
 * layout is not done may point ahead; a settled layout or a scanned (repository) node must resolve.
 */
export const plannedDesignPointers = (record) => {
  if (record?.schema !== 'work/layout-tree@1' || !Array.isArray(record.apps)) return [];
  return record.apps.flatMap((app) => (Array.isArray(app?.nodes) ? app.nodes : []))
    .filter((node) => node?.origin === 'planned' && node.layout && node.layout.state !== 'done' && typeof node.layout.design === 'string')
    .map((node) => node.layout.design.trim());
};
/** features/<feature>/ui/<name...>/index.yaml for ui.<feature>.<name...>. */
export const placeOfUiId = (id) => { const [, feature, ...rest] = String(id).split('.'); return `features/${feature}/ui/${rest.join('/')}/index.yaml`; };
