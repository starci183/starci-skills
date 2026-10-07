// The reference rules of the example Work standard (check-example-work.mjs): inline acceptance criteria keep the
// ids their place implies, and every collected reference resolves to a record or an inline criterion.
import { inlineCriteriaOf } from '../record-ownership.mjs';
import { ID_RE, placeOfUiId } from './example-work-ids.mjs';

function checkInlineCriterion({ problems, resolveMap }, { id, rec, wantPrefix, criterion }) {
  for (const field of ['state', 'change', 'evidence', 'provenBy']) {
    if (field in criterion.entry) {
      problems.push(`${rec.shown}: inline criterion ${criterion.id ?? criterion.name ?? '(unnamed)'} carries its own ${field} - a criterion with its own lifecycle or evidence stays its own ac/ record, the compact form is for criteria that share the parent's [AC_LIFECYCLE_INLINE]`);
    }
  }
  if (!criterion.id || !ID_RE.test(criterion.id)) return;
  if (!criterion.id.startsWith(wantPrefix)) {
    problems.push(`${rec.shown}: inline criterion carries id ${criterion.id}, but its place inside ${id} says ${wantPrefix}* - the compact form keeps the former record's own id [AC_ID_MISMATCH]`);
  }
  if (resolveMap.has(criterion.id)) {
    problems.push(`${rec.shown}: inline criterion id ${criterion.id} is also a live record's id - a collapsed criterion and a record cannot both own it [AC_ID_COLLISION]`);
  }
}

// ---- inline acceptance criteria (v11 compact format) ----
// A criterion may be carried inline on the
// parent's `acceptance:`/`statements:` list as an entry with `id: <ac-id>`. Two rules keep the
// collapse honest: an entry's declared id must be the id its place implies (`ac.` + the parent's id
// minus its family segment + `.` + name), the same place-law a file under ac/ lived under; and one id
// may not be claimed by two parents.
export function checkInlineCriteria(ctx) {
  const { records, inline, problems } = ctx;
  for (const [id, rec] of records) {
    const wantPrefix = `ac.${id.split('.').slice(1).join('.')}.`;
    for (const criterion of inlineCriteriaOf(rec.data)) checkInlineCriterion(ctx, { id, rec, wantPrefix, criterion });
  }
  for (const collision of inline.collisions) {
    problems.push(`inline criterion ${collision.id} is declared under both ${collision.parents.join(' and ')} [AC_ID_COLLISION]`);
  }
}

// The ref's own declaration trail (acceptance.id / statements.id inside the entry itself) is the declaration, not a ref.
const DECL_TRAIL = /^(?:acceptance|statements)\.(?:.+\.)?id$/;

/** A `parent#frag` ref: the parent must be a record and the fragment must name a criterion it carries. */
function checkFragmentRef({ problems, resolveMap, resolveInline }, ref) {
  if (!resolveMap.has(ref.id)) {
    problems.push(`${ref.file}: ${ref.trail} points at ${ref.id}#${ref.frag}, but no record owns ${ref.id}`);
    return;
  }
  const resolved = resolveInline.byParent.get(ref.id)?.has(ref.frag)
    || resolveMap.has(ref.frag)
    || resolveInline.byAcId.get(ref.frag) === ref.id;
  if (!resolved) problems.push(`${ref.file}: ${ref.trail} points at ${ref.id}#${ref.frag}, which names no criterion ${ref.id} carries`);
}

function checkRef(ctx, ref) {
  const { problems, warnings, resolveMap, resolveInline, plannedDesigns } = ctx;
  if (ref.malformedRef) {
    problems.push(`${ref.file}: ${ref.trail} holds "${ref.id}", which looks like a parent#criterion ref but resolves to neither: use the record id, or \`parent.id#criterion-short-name\` for an inlined criterion [REF_MALFORMED]`);
    return;
  }
  if (ref.frag != null) {
    checkFragmentRef(ctx, ref);
    return;
  }
  if (resolveMap.has(ref.id)) return;
  if (resolveInline.byAcId.has(ref.id) && DECL_TRAIL.test(ref.trail)) return;
  if (ref.trail === 'apps.nodes.layout.design' && plannedDesigns.has(`${ref.file}|${ref.id}`)) {
    warnings.push(`${ref.file}: ${ref.trail} names ${ref.id}, the surface-layout ui record interface.draw has not drawn yet - a planned pointer, resolved when interface.draw creates ${placeOfUiId(ref.id)} with surface: layout and route set to the layout node [DESIGN_PLANNED]`);
    return;
  }
  problems.push(`${ref.file}: ${ref.trail} points at ${ref.id}, which no record owns`);
}

// ---- refs resolve (existing structural check, now also covers blockedBy/conflictsWith/appliesTo/subscribes/extends record ids) ----
// Compact-format resolution: `P#frag` resolves when P is a record and frag names an inline criterion
// P carries (full id, short name, or last id segment - or a live record id / kept-separate ac id under
// P). A bare `ac.*` id that no record owns is dangling: `parent#ac-id` is the form.
export function checkRefsResolve(ctx) {
  for (const ref of ctx.refs) checkRef(ctx, ref);
}
