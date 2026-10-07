#!/usr/bin/env node
// grammar-geometry.mjs — the control geometry a product actually renders, read from its CSS, and the check
// that a drawn render keeps it.
//
//   starci work grammar-geometry --prompt --repo <product repo> [--family <name>] [--json]
//   starci work grammar-geometry --check <html file | capture dir> --repo <product repo>
//        [--family <name>] [--viewport 390x844] [--json]
//
// Every value comes from the cascade of the product's installed CSS: HeroUI v3 (`@heroui/styles`
// dist/heroui.min.css plus its `@theme inline` tokens), `@starci/grammar` common (+ core for the runtime's
// own family) and the family sheet (the repo css that scopes `[data-grammar-family="<id>"]`). The
// cascade honours layers, importance, specificity, custom-property inheritance and media conditions at
// the viewport asked for. A brand token the family declares but no `var()` and no source file reads is
// reported as unbound: the CSS wins (owner ruling 2026-09-27), never the declared token.
//
// --check renders each html with the product's own Playwright and reports GEOMETRY_OFF_GRAMMAR for every
// button, input, card, badge and text run whose computed geometry leaves the resolved grammar.
// Exit 0 clean, 1 findings, 2 bad argument or an unavailable source (a missing HeroUI, Grammar, family
// sheet or Playwright fails closed).
import { flag as argOf } from '../work-io.mjs';
import { isMain } from '../../lib/is-main.mjs';
import { GRAMMAR_FAMILIES } from '../../lib/example-refs.mjs';
import { alphaOf, geometryFindings, geometryProbes, readSnapshot, sameColor } from './grammar-geometry-check.mjs';
import { htmlTargets, snapshotFiles } from './grammar-geometry-page.mjs';
import { geometryPrompt, shortFile } from './grammar-geometry-prompt.mjs';
import { DEFAULT_VIEWPORT, firstFamily, normalizeShadowText, resolveGeometry } from './grammar-geometry-resolve.mjs';

// The modules beside this one split the work: grammar-geometry-css.mjs (parsing and loading sheets),
// grammar-geometry-cascade.mjs (media, selectors, the cascade), grammar-geometry-values.mjs (lengths and var()),
// grammar-geometry-sources.mjs (discovery), grammar-geometry-resolve.mjs (the resolver), grammar-geometry-prompt.mjs
// (the brief block), grammar-geometry-page.mjs (rendering) and grammar-geometry-check.mjs (the findings).
export { expandShorthand, loadSheet, parseCss } from './grammar-geometry-css.mjs';
export { mediaMatches, selectorMatch } from './grammar-geometry-cascade.mjs';
export { evalLength } from './grammar-geometry-values.mjs';
export { discoverSources } from './grammar-geometry-sources.mjs';
export { loadChromium } from './grammar-geometry-page.mjs';
export { DEFAULT_VIEWPORT, alphaOf, firstFamily, geometryFindings, geometryPrompt, geometryProbes, normalizeShadowText, readSnapshot, resolveGeometry, sameColor, snapshotFiles };
export const FAMILIES = GRAMMAR_FAMILIES;

export async function checkGeometry(target, { repo, family = null, viewport = DEFAULT_VIEWPORT, grammarDist = null, extraCss = [] } = {}) {
  const files = htmlTargets(target);
  if (!files.length) return { ok: false, exitCode: 2, error: `${target}: no .html file to check` };
  const g = resolveGeometry({ repo, family, widths: [viewport.width], grammarDist, extraCss });
  if (!g.ok) return { ok: false, exitCode: 2, error: g.errors.join('; ') };
  const shot = await snapshotFiles(files, { repo, viewport, probes: geometryProbes(g) });
  if (!shot.ok) return { ok: false, exitCode: 2, error: shot.error };
  const findings = [];
  const measured = [];
  for (const snap of shot.snapshots) { const r = geometryFindings(snap, g, { file: snap.file }); findings.push(...r.findings); measured.push({ file: snap.file, ...r.counts }); }
  return { schema: 'starci/grammar-geometry-check@1', ok: findings.length === 0, exitCode: findings.length ? 1 : 0, family: g.family, viewport, files, measured, findings };
}

const USAGE = `Usage:
  starci work grammar-geometry --prompt --repo <product repo> [--family <name>] [--json]
  starci work grammar-geometry --check <html file | capture dir> --repo <product repo> [--family <name>] [--viewport 390x844] [--json]
`;

export function parseViewport(text) {
  const m = /^(\d+)x(\d+)$/.exec(String(text ?? ''));
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

function plain(g) {
  const strip = (v) => (v && typeof v === 'object' && 'declared' in v ? { value: v.value, px: v.px, declared: v.declared, trace: v.trace, file: v.file } : v);
  const walk = (o) => {
    if (Array.isArray(o)) return o.map(walk);
    if (!o || typeof o !== 'object') return o;
    if ('declared' in o) return strip(o);
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, walk(v)]));
  };
  return { schema: 'starci/grammar-geometry@1', ok: g.ok, family: g.family, sources: g.sources, widths: g.widths, at: walk(g.at), font: walk(g.font), unbound: g.unbound, touchFloor: walk(g.touchFloor) };
}

/** `--prompt`: the geometry block of the product, or its JSON. */
function promptMode({ repo, family, json }) {
  const g = resolveGeometry({ repo, family });
  if (!g.ok) return { exitCode: 2, text: `grammar-geometry: ${g.errors.join('; ')}\n` };
  return { exitCode: 0, text: json ? `${JSON.stringify(plain(g), null, 2)}\n` : geometryPrompt(g) };
}

/** `--check <html | dir>`: the findings of the renders, as text or JSON. */
async function checkMode({ argv, repo, family, json, target }) {
  const viewport = argOf(argv, '--viewport') ? parseViewport(argOf(argv, '--viewport')) : DEFAULT_VIEWPORT;
  if (!viewport) return { exitCode: 2, text: '--viewport is <width>x<height>\n' };
  const r = await checkGeometry(target, { repo, family, viewport });
  if (r.error) return { exitCode: r.exitCode, text: json ? `${JSON.stringify({ schema: 'starci/grammar-geometry-check@1', ok: false, error: r.error }, null, 2)}\n` : `grammar-geometry: ${r.error}\n` };
  if (json) return { exitCode: r.exitCode, text: `${JSON.stringify(r, null, 2)}\n` };
  const lines = r.findings.map((f) => `  REFUSED ${shortFile(f.file, null)}: ${f.element} ${f.at} ${f.property} is ${f.got}, the grammar renders ${f.expected} [${f.code}]`);
  return { exitCode: r.exitCode, text: `${lines.join('\n')}${lines.length ? '\n' : ''}${r.ok ? 'OK' : 'FAIL'}: grammar geometry (${r.family}, ${r.viewport.width}x${r.viewport.height}) - ${r.files.length} file(s), ${r.findings.length} finding(s).\n` };
}

export async function grammarGeometryMain(argv = []) {
  const json = argv.includes('--json');
  const repo = argOf(argv, '--repo');
  const family = argOf(argv, '--family');
  if (argv.includes('--help') || argv.includes('-h')) return { exitCode: 0, text: USAGE };
  if (family && !FAMILIES[family]) return { exitCode: 2, text: `--family is one of ${Object.keys(FAMILIES).join(', ')}\n${USAGE}` };
  if (!repo) return { exitCode: 2, text: `--repo <product repo> is required\n${USAGE}` };
  if (argv.includes('--prompt')) return promptMode({ repo, family, json });
  const target = argOf(argv, '--check');
  if (target) return checkMode({ argv, repo, family, json, target });
  return { exitCode: 2, text: USAGE };
}

if (isMain(import.meta.url)) {
  const result = await grammarGeometryMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
