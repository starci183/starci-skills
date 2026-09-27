// ui-archetype.mjs — which brand.direction archetype a ui record's surface is (owner ruling 2026-09-27: interface.draw
// draws a surface only under an ACCEPTED direction for its archetype).
//
// A record states it as `ui.archetype` (work/ui-screen@1). Absent, it is derived from the record itself:
//   layout      a `surface: layout` record draws the layout's own chrome (brand.decide's, never a page archetype)
//   form        a modal or drawer, or an intent/route that edits, creates, configures or signs in
//   wizard      a route or intent of steps: onboarding, setup, wizard, step, checkout
//   detail      the route's last segment is dynamic ([id], [slug] ...) - one entity
//   dashboard   an overview, dashboard or home route or title
//   list        everything else - a collection of peers
// (`empty` is the empty/first-run archetype a record states itself.) The derivation is a default; an explicit
// ui.archetype always wins.
//
// Whether an archetype is ready is brand.mjs checkDirection's answer (lane ui-discipline-brand, e380e4c27): its
// evidence.ready lists the archetypes whose `accepted` status is backed by the owner's own receipt for the current
// direction rev and golden renders - `status: accepted` alone is never trusted.
import { DIRECTION_ARCHETYPES, checkDirection, defaultGrammarRoot, readBrandRecord } from '../checks/brand.mjs';

/** The page archetypes brand.direction settles, plus `layout` (a surface-layout record, which owes none). */
export const ARCHETYPES = Object.freeze([...DIRECTION_ARCHETYPES, 'layout']);
/** Archetypes that owe no brand.direction archetype: a layout record draws brand.decide's chrome. */
export const DIRECTION_EXEMPT = Object.freeze(['layout']);

const text = (v) => (typeof v === 'string' ? v : v && typeof v === 'object' ? Object.values(v).map(text).join(' ') : '');
const surfaces = (s) => (typeof s === 'string' ? [s] : s && typeof s === 'object' ? Object.values(s).map(String) : []);

/** {archetype, derived:boolean, why} for a work/ui-screen@1 record. */
export function archetypeOf(record) {
  const explicit = record?.ui?.archetype;
  if (typeof explicit === 'string' && explicit.trim()) return { archetype: explicit.trim(), derived: false, why: 'ui.archetype' };
  const surf = surfaces(record?.surface);
  const route = String(record?.route ?? record?.routeParent ?? '');
  const words = `${record?.title ?? ''} ${text(record?.ui?.intent)} ${route}`.toLowerCase();
  if (surf.includes('layout')) return { archetype: 'layout', derived: true, why: 'surface layout' };
  if (/\b(wizard|onboarding|setup|step|steps|checkout)\b|thiết lập|các bước/.test(words)) return { archetype: 'wizard', derived: true, why: 'a stepped task' };
  if (surf.some((s) => s === 'modal' || s === 'drawer') || /\b(edit|create|new|settings|configure|sign[- ]?in|login|register|form)\b|chỉnh sửa|tạo mới|cài đặt|đăng nhập/.test(words)) {
    return { archetype: 'form', derived: true, why: surf.some((s) => s === 'modal' || s === 'drawer') ? `surface ${surf.join('/')}` : 'an editing task' };
  }
  const last = route.split('/').filter(Boolean).pop() ?? '';
  if (/^\[[^\]]+\]$/.test(last) && !/^\[\[?\.\.\./.test(last) && !/locale|lang/i.test(last)) return { archetype: 'detail', derived: true, why: `dynamic route segment ${last}` };
  if (/\b(overview|dashboard|home)\b|tổng quan|trang chủ/.test(words)) return { archetype: 'dashboard', derived: true, why: 'an overview' };
  return { archetype: 'list', derived: true, why: 'the default: a collection of peers' };
}

/**
 * Whether the product's brand.direction accepts `archetype` (checkDirection evidence.ready - the owner's receipt for the
 * current rev and golden, never `status` alone): {ready, status, rev, why}. `workRoot` is the .starciwork directory.
 */
export function directionReadiness(workRoot, archetype, { grammarRoot = defaultGrammarRoot() } = {}) {
  let record;
  try { record = readBrandRecord(workRoot); } catch (error) { return { ready: false, status: null, rev: null, why: `no brand record (${error.message})` }; }
  const result = checkDirection({ brand: record.brand, family: record.family, grammarRoot, brandDir: record.dir });
  const ev = result.evidence ?? {};
  const status = ev.archetypes?.[archetype] ?? null;
  const ready = Array.isArray(ev.ready) && ev.ready.includes(archetype);
  const why = ready ? 'accepted by the owner'
    : !record.brand?.direction ? 'the brand record carries no brand.direction'
      : status == null ? `brand.direction declares no ${archetype} archetype`
        : status !== 'accepted' ? `the ${archetype} archetype is ${status}`
          : `the ${archetype} archetype says accepted but the owner's receipt does not back it (${(ev.problems ?? []).filter((p) => p.includes(archetype)).join('; ') || 'checkDirection'})`;
  return { ready, status, rev: ev.rev ?? null, why };
}
