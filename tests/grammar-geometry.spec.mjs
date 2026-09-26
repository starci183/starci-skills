import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  discoverSources, evalLength, expandShorthand, geometryFindings, geometryPrompt, grammarGeometryMain, loadChromium, loadSheet,
  mediaMatches, normalizeShadowText, parseCss, resolveGeometry, selectorMatch,
} from '../scripts/checks/grammar-geometry.mjs';
import { buildGeometryRepo, snapshotOf } from './fixtures/grammar-geometry.mjs';

// Owner, 2026-09-27: a draw brief carries the geometry the product's CSS binds (HeroUI v3 + @starci/grammar +
// the family sheet) - a pill Button, a borderless 12px field that turns `secondary` inside a surface, a card
// radius the CSS actually binds (nivo draws 1rem: --nivo-surface-radius 1.5rem is declared, never bound) -
// and `--check` refuses a render that leaves it. Every number here comes out of the fixture CSS, never code.

test('the parser keeps layers, media, nesting, imports and expands the shorthands the geometry reads', () => {
  const sheet = parseCss(`@layer a, b; @import "./x.css" layer(y);
    @layer a { .k { padding: 1px 2px; border: 1px solid var(--c); } @media (min-width: 40rem) { .k { gap: 4px 8px; } } }
    .p { .q & { color: red !important; } }`);
  assert.deepEqual(sheet.layers.slice(0, 2), ['a', 'b']);
  assert.deepEqual(sheet.imports.map((i) => [i.target, i.layer]), [['./x.css', 'y']]);
  const k = sheet.rules.find((r) => r.selectors[0] === '.k' && !r.media.length);
  assert.equal(k.layer, 'a');
  assert.deepEqual(k.decls.filter((d) => d.prop.startsWith('padding')).map((d) => [d.prop, d.value]), [['padding-top', '1px'], ['padding-right', '2px'], ['padding-bottom', '1px'], ['padding-left', '2px']]);
  assert.equal(k.decls.find((d) => d.prop === 'border-top-color').value, 'var(--c)');
  assert.deepEqual(sheet.rules.find((r) => r.media.length).decls.map((d) => d.prop), ['gap', 'row-gap', 'column-gap']);
  const nested = sheet.rules.find((r) => r.selectors[0] === '.q .p');
  assert.ok(nested?.decls[0].important);
  assert.deepEqual(expandShorthand('border', '0'), [['border-top-width', '0'], ['border-top-style', 'none'], ['border-top-color', 'currentcolor'], ['border-right-width', '0'], ['border-right-style', 'none'], ['border-right-color', 'currentcolor'], ['border-bottom-width', '0'], ['border-bottom-style', 'none'], ['border-bottom-color', 'currentcolor'], ['border-left-width', '0'], ['border-left-style', 'none'], ['border-left-color', 'currentcolor']]);
});

test('lengths, media and selectors evaluate the way the browser would at a given width', () => {
  assert.equal(evalLength('calc(.5rem * 3)'), 24);
  assert.equal(evalLength('min(32px, calc(0.5rem * 3))'), 24);
  assert.equal(evalLength('clamp(1rem, 3vw, 2rem)', { vw: 390 }), 16);
  assert.equal(evalLength('clamp(1rem, 3vw, 2rem)', { vw: 1280 }), 32);
  assert.equal(evalLength('oklch(57% 0.24 25)'), null);
  assert.equal(evalLength('calc(1.5 / 1)', { unitless: true }), 1.5);
  assert.equal(mediaMatches('(min-width:48rem)', { width: 390 }), false);
  assert.equal(mediaMatches('(min-width:48rem)', { width: 1280 }), true);
  assert.equal(mediaMatches('(prefers-color-scheme: dark)', { width: 390, scheme: 'light' }), false);
  const chain = [new Set(['*', ':root']), new Set(['*', '.grammar-common-root', '[data-grammar-family=nivo]']), new Set(['*', '.button', '.button--primary'])];
  assert.equal(selectorMatch('.button.button--primary', chain), 20);
  assert.equal(selectorMatch('.grammar-common-root[data-grammar-family=nivo] .button', chain), 30);
  assert.equal(selectorMatch('.button:hover', chain), -1, 'a state pseudo-class never paints the resting geometry');
  assert.equal(selectorMatch('.dark .button', chain), -1);
});

test('the cascade honours layer order and importance the way the product loads its sheets', (t) => {
  const fx = buildGeometryRepo();
  t.after(fx.cleanup);
  const file = path.join(fx.repo, 'layers.css');
  fs.writeFileSync(file, '@layer early, late; @layer late { .x { --v: late; --w: late !important; } } @layer early { .x { --v: early; --w: early !important; } }');
  const sheet = loadSheet([{ file, source: 'app' }]);
  assert.deepEqual(sheet.layerOrder, ['early', 'late']);
});

test('the nivo fixture resolves: pill button, borderless 12px field, secondary inside a surface, the CSS-bound card radius', (t) => {
  const fx = buildGeometryRepo();
  t.after(fx.cleanup);
  const sources = discoverSources(fx.repo);
  assert.deepEqual(sources.errors, []);
  assert.equal(sources.family, 'nivo');
  assert.equal(path.relative(fx.repo, sources.entry).split(path.sep).join('/'), 'apps/app/src/app/globals.css');
  const g = resolveGeometry({ repo: fx.repo, widths: [390, 1280] });
  assert.equal(g.ok, true, g.errors?.join('; '));
  const [mobile, desktop] = g.at;
  assert.equal(mobile.button['border-radius'].px, 24);
  assert.equal(mobile.button.heightPx, 40);
  assert.equal(desktop.button.heightPx, 36);
  assert.equal(mobile.button.fill['min-height'].px, 44);
  assert.equal(mobile.button.variants.primary['background-color'].value, 'oklch(57% 0.24 25)');
  assert.equal(mobile.button.variants.outline['border-top-width'].px, 1);
  assert.equal(mobile.input.primary['border-radius'].px, 12);
  assert.equal(mobile.input.primary['border-top-width'].px, 0);
  assert.equal(mobile.input.primary.heightPx, 40);
  assert.equal(desktop.input.primary['font-size'].px, 14);
  assert.equal(mobile.input.secondary['background-color'].value, 'oklch(94% 0.0015 354.13)');
  assert.equal(normalizeShadowText(mobile.input.secondary['box-shadow'].value), 'none');
  assert.equal(mobile.card.top['border-radius'].px, 16, 'the card draws the bound 1rem, not the declared --nivo-surface-radius');
  assert.equal(mobile.card.top['border-top-width'].value, '0');
  assert.match(mobile.card.top['box-shadow'].value, /rgba\(0, 0, 0, 0\.04\)/);
  assert.equal(mobile.card.nested['border-top-width'].px, 1);
  assert.equal(mobile.card.joined['padding-top'].px, 0);
  assert.equal(mobile.badge['border-radius'].px, 16);
  assert.equal(mobile.badge.heightPx, 20);
  assert.deepEqual(g.unbound.map((u) => u.name), ['--nivo-surface-radius']);
  assert.equal(g.font.binding.value, 'ui-sans-serif, system-ui, sans-serif');
  assert.ok(g.font.allowed.includes('open sans'), 'an app surface binding a font widens the family set');
  const prompt = geometryPrompt(g);
  assert.match(prompt, /radius 24px = `calc\(var\(--radius\) \* 3\)` <- --radius: var\(--nivo-control-radius\) <- --nivo-control-radius: 0\.5rem/);
  assert.match(prompt, /a pill/);
  assert.match(prompt, /height 40px at 390px, 36px at 1280px/);
  assert.match(prompt, /`secondary` variant: fill oklch\(94% 0\.0015 354\.13\)/);
  assert.match(prompt, /ANATOMY-2 case-1/);
  assert.match(prompt, /COLOR-3 case-6/);
  assert.match(prompt, /--nivo-surface-radius: 1\.5rem is declared by the family and read by no var\(\)/);
});

test('--check findings: an off-grammar button, input, card and badge are each named; a grammar render is clean', (t) => {
  const fx = buildGeometryRepo();
  t.after(fx.cleanup);
  const g = resolveGeometry({ repo: fx.repo, widths: [390] });
  const probes = {
    'button.primary.bg': { value: 'oklch(57% 0.24 25)', rgba: [227, 0, 31, 1] }, 'button.primary.fg': { rgba: [255, 255, 255, 1] },
    'button.secondary.bg': { value: 'oklch(94%)', rgba: [236, 235, 235, 1] }, 'button.outline.bg': { value: 'transparent', rgba: [0, 0, 0, 0] }, 'button.outline.border': { value: '#ddd', rgba: [221, 221, 221, 1] },
    'input.primary.bg': { value: '#fff', rgba: [255, 255, 255, 1] }, 'input.primary.shadow': { value: 'rgba(0, 0, 0, 0.04) 0px 2px 4px 0px' },
    'input.secondary.bg': { value: 'oklch(94%)', rgba: [236, 235, 235, 1] }, 'input.secondary.shadow': { value: 'none' },
    'card.top.shadow': { value: 'rgba(0, 0, 0, 0.04) 0px 2px 4px 0px, rgba(0, 0, 0, 0.06) 0px 1px 2px 0px' },
  };
  const shadow = probes['card.top.shadow'].value;
  const good = snapshotOf([
    { tag: 'main', x: 0, y: 0, w: 390, h: 900 },
    { parent: 0, x: 16, y: 16, w: 358, h: 300, style: { bg: [255, 255, 255, 1], radius: 16, shadow, padding: [16, 16, 16, 16] } },
    { parent: 1, tag: 'label', x: 32, y: 32, w: 200, h: 20, own: 'Email' },
    { parent: 1, tag: 'input', x: 32, y: 60, w: 326, h: 40, labelText: 'Email', style: { bg: [236, 235, 235, 1], radius: 12, fontSize: 16 } },
    { parent: 1, tag: 'span', x: 32, y: 110, w: 80, h: 20, own: 'Draft', style: { bg: [236, 235, 235, 1], radius: 16, fontSize: 12 } },
    { parent: 1, tag: 'button', x: 32, y: 140, w: 120, h: 40, own: 'Send', style: { bg: [227, 0, 31, 1], radius: 24, padding: [0, 16, 0, 16] } },
  ], { probes });
  assert.deepEqual(geometryFindings(good, g).findings, []);
  const bad = snapshotOf([
    { tag: 'main', x: 0, y: 0, w: 390, h: 900 },
    { parent: 0, x: 16, y: 16, w: 358, h: 300, style: { bg: [255, 255, 255, 1], radius: 24, shadow, padding: [16, 16, 16, 16], border: { w: 1, style: 'solid', color: [200, 200, 200, 1] } } },
    { parent: 1, tag: 'input', x: 32, y: 60, w: 326, h: 40, labelText: 'Email', style: { bg: [255, 255, 255, 1], radius: 6, fontSize: 16, border: { w: 1, style: 'solid', color: [200, 200, 200, 1] } } },
    { parent: 1, tag: 'span', x: 32, y: 110, w: 80, h: 20, own: 'Draft', style: { bg: [236, 235, 235, 1], radius: 4, fontSize: 12 } },
    { parent: 1, tag: 'button', x: 32, y: 140, w: 120, h: 40, own: 'Send', style: { bg: [37, 99, 235, 1], radius: 8, padding: [0, 16, 0, 16] } },
  ], { probes });
  const found = geometryFindings(bad, g).findings;
  assert.ok(found.every((f) => f.code === 'GEOMETRY_OFF_GRAMMAR' && f.level === 'refuse'));
  const keys = found.map((f) => `${f.element} ${f.property}`);
  for (const k of ['button border-radius', 'button fill', 'input border-radius', 'input border', 'input fill (inside a surface: secondary variant)', 'card border-radius', 'card border', 'badge border-radius']) assert.ok(keys.includes(k), `${k} in ${keys.join(', ')}`);
});

test('the CLI fails closed: no repo, an unknown family, a repo with no HeroUI', async (t) => {
  assert.equal((await grammarGeometryMain(['--prompt'])).exitCode, 2);
  assert.equal((await grammarGeometryMain(['--prompt', '--repo', '.', '--family', 'heritage'])).exitCode, 2);
  const fx = buildGeometryRepo();
  t.after(fx.cleanup);
  fs.rmSync(path.join(fx.app, 'node_modules', '@heroui'), { recursive: true, force: true });
  const r = await grammarGeometryMain(['--prompt', '--repo', fx.repo]);
  assert.equal(r.exitCode, 2);
  assert.match(r.text, /@heroui\/styles/);
  const ok = buildGeometryRepo();
  t.after(ok.cleanup);
  const text = await grammarGeometryMain(['--prompt', '--repo', ok.repo]);
  assert.equal(text.exitCode, 0);
  assert.match(text.text, /^GEOMETRY - mandatory/);
});

test('--check renders an html with the product Playwright when one is installed', async (t) => {
  const pw = await loadChromium(process.env.STARCI_PLAYWRIGHT_DIR ?? null);
  if (!pw) { t.skip('no Playwright resolvable from this runtime (STARCI_PLAYWRIGHT_DIR)'); return; }
  const fx = buildGeometryRepo();
  t.after(fx.cleanup);
  const html = path.join(fx.repo, 'draw.html');
  fs.writeFileSync(html, '<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:ui-sans-serif"><main style="padding:16px"><section style="background:#fff;border-radius:6px;padding:16px;border:1px solid #ccc"><button style="height:40px;border-radius:4px;padding:0 16px;background:#2563eb;color:#fff;border:0;font-size:14px">Send</button></section></main></body></html>');
  const r = await grammarGeometryMain(['--check', html, '--repo', fx.repo, '--json']);
  assert.equal(r.exitCode, 1, r.text);
  const out = JSON.parse(r.text);
  assert.ok(out.findings.some((f) => f.element === 'button' && f.property === 'border-radius'));
  assert.ok(out.findings.some((f) => f.element === 'card' && f.property === 'border-radius'));
});
