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
//
// Under autopilot (owner ruling 2026-09-28 autopilot-run-to-finish: run to the finish without asking the owner, machine-
// gated results accepted provisionally, the owner reviews once at handover) an archetype that brand.decide's direction
// mode wrote and that passes every machine check - the whole `direction` check green, every archetype field present,
// its golden renders on disk at the sha256 recorded - is PROVISIONALLY ready: drawing proceeds under it without the
// owner's receipt ({ready: true, provisional: true}). It never becomes `accepted`, never golden, and the owner's
// brand-direction-review ask still stands for the handover. Measured 2026-09-27: every product-repo draw of a
// list/detail surface waited on a proposed archetype the owner had not answered (prerequisite-unmet, awaiting-owner).
import { DIRECTION_ARCHETYPES, checkDirection, defaultGrammarRoot, readBrandRecord } from './brand/brand.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { altOf } from '../lib/source-phrases.mjs';

/**
 * Whether autopilot runs `workflowId` (modules/models/runtimes.yaml allocation.autopilot: enabled, with
 * workflows.<id>.enabled overriding it per workflow). Absent config is off. `settings` is injectable (tests).
 */
export function autopilotOn({ workflowId = null, settings = null } = {}) {
  let a;
  try { a = (settings ?? allocationSettings()).autopilot; } catch { a = null; }
  if (!a || typeof a !== 'object') return false;
  const own = workflowId ? a.workflows?.[workflowId]?.enabled : undefined;
  return typeof own === 'boolean' ? own : a.enabled === true;
}

/** The page archetypes brand.direction settles, plus `layout` (a surface-layout record, which owes none). */
export const ARCHETYPES = Object.freeze([...DIRECTION_ARCHETYPES, 'layout']);
/** Archetypes that owe no brand.direction archetype: a layout record draws brand.decide's chrome. */
export const DIRECTION_EXEMPT = Object.freeze(['layout']);

const text = (v) => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') return Object.values(v).map(text).join(' ');
  return '';
};
const surfaces = (s) => {
  if (typeof s === 'string') return [s];
  if (s && typeof s === 'object') return Object.values(s).map(String);
  return [];
};

// The title/intent/route words that derive an archetype (the record's words are lower-cased first); the Vietnamese
// lists are lexicon data (modules/goal/source-phrases.yaml uiArchetype).
const WIZARD_WORDS = new RegExp(String.raw`\b(?:wizard|onboarding|setup|step|steps|checkout)\b|${altOf('uiArchetype.wizard')}`);
const FORM_WORDS = new RegExp(String.raw`\b(?:edit|create|new|settings|configure|sign[- ]?in|login|register|form)\b|${altOf('uiArchetype.form')}`);
const DASHBOARD_WORDS = new RegExp(String.raw`\b(?:overview|dashboard|home)\b|${altOf('uiArchetype.dashboard')}`);

/** {archetype, derived:boolean, why} for a work/ui-screen@1 record. */
export function archetypeOf(record) {
  const explicit = record?.ui?.archetype;
  if (typeof explicit === 'string' && explicit.trim()) return { archetype: explicit.trim(), derived: false, why: 'ui.archetype' };
  const surf = surfaces(record?.surface);
  const route = String(record?.route ?? record?.routeParent ?? '');
  const words = `${record?.title ?? ''} ${text(record?.ui?.intent)} ${route}`.toLowerCase();
  if (surf.includes('layout')) return { archetype: 'layout', derived: true, why: 'surface layout' };
  if (WIZARD_WORDS.test(words)) return { archetype: 'wizard', derived: true, why: 'a stepped task' };
  if (surf.some((s) => s === 'modal' || s === 'drawer') || FORM_WORDS.test(words)) {
    const why = surf.some((s) => s === 'modal' || s === 'drawer') ? `surface ${surf.join('/')}` : 'an editing task';
    return { archetype: 'form', derived: true, why };
  }
  const last = route.split('/').findLast(Boolean) ?? '';
  if (/^\[[^\]]+\]$/.test(last) && !/^\[\[?\.\.\./.test(last) && !/locale|lang/i.test(last)) return { archetype: 'detail', derived: true, why: `dynamic route segment ${last}` };
  if (DASHBOARD_WORDS.test(words)) return { archetype: 'dashboard', derived: true, why: 'an overview' };
  return { archetype: 'list', derived: true, why: 'the default: a collection of peers' };
}

/**
 * Whether the product's brand.direction accepts `archetype` (checkDirection evidence.ready - the owner's receipt for the
 * current rev and golden, never `status` alone): {ready, status, rev, why}. `workRoot` is the .starciwork directory.
 */
export function directionReadiness(workRoot, archetype, { grammarRoot = defaultGrammarRoot(), provisional = null, workflowId = null } = {}) {
  let record;
  try { record = readBrandRecord(workRoot); } catch (error) { return { ready: false, status: null, rev: null, why: `no brand record (${error.message})` }; }
  const result = checkDirection({ brand: record.brand, family: record.family, grammarRoot, brandDir: record.dir });
  const ev = result.evidence ?? {};
  const status = ev.archetypes?.[archetype] ?? null;
  const ready = Array.isArray(ev.ready) && ev.ready.includes(archetype);
  // Provisional readiness under autopilot: the machine-checked proposal stands in for the owner's receipt.
  const autopilot = provisional ?? autopilotOn({ workflowId });
  if (!ready && autopilot && result.outcome === 'pass' && (status === 'proposed' || status === 'accepted')
    && (ev.golden ?? []).some((g) => g.archetype === archetype && g.pngSha256)) {
    return { ready: true, provisional: true, status, rev: ev.rev ?? null, why: `provisionally ready under autopilot: the ${archetype} archetype is ${status}, the direction check passes and its golden is on disk; the owner reviews it at handover` };
  }
  let why;
  if (ready) why = 'accepted by the owner';
  else if (!record.brand?.direction) why = 'the brand record carries no brand.direction';
  else if (status == null) why = `brand.direction declares no ${archetype} archetype`;
  else if (status !== 'accepted') why = `the ${archetype} archetype is ${status}`;
  else why = `the ${archetype} archetype says accepted but the owner's receipt does not back it (${(ev.problems ?? []).filter((p) => p.includes(archetype)).join('; ') || 'checkDirection'})`;
  return { ready, status, rev: ev.rev ?? null, why };
}
