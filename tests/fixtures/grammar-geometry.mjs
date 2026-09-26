// A miniature product repo for grammar-geometry.mjs and ui-proof-brief.mjs: an app entry importing HeroUI,
// Grammar and a nivo family sheet, with each package installed under the app's node_modules. The CSS keeps
// the shapes the real sheets have (layers, var() chains, shorthands, media steps, a declared-but-unbound
// surface radius) so the resolver is exercised the way the product exercises it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HEROUI = `@layer properties{@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))){*,:before,:after{--tw-border-style:solid;--tw-shadow:0 0 #0000;--tw-inset-shadow:0 0 #0000;--tw-leading:initial}}}
@layer theme{:root,:host{--font-sans:ui-sans-serif,system-ui,sans-serif;--spacing:.25rem;--text-xs:.75rem;--text-xs--line-height:calc(1 / .75);--text-sm:.875rem;--text-sm--line-height:calc(1.25 / .875);--text-base:1rem;--text-base--line-height:calc(1.5 / 1);--text-xl:1.25rem;--text-xl--line-height:calc(1.75 / 1.25);--font-weight-normal:400;--font-weight-medium:500;--font-weight-semibold:600;--radius-xl:calc(var(--radius) * 1.5);--radius-2xl:calc(var(--radius) * 2);--radius-3xl:calc(var(--radius) * 3);--border-width-field:var(--field-border-width,var(--border-width))}}
@layer base{:root,.light,[data-theme=light]{--radius:.5rem;--field-radius:calc(var(--radius) * 1.5);--border-width:1px;--field-border-width:0px;--accent:oklch(53% .2 256);--accent-foreground:#fff;--default:oklch(94% .001 286);--default-foreground:#222;--border:#ddd;--field-background:#fff;--field-shadow:0 2px 4px 0 rgb(0 0 0 / 4%);--surface-shadow:0 1px 1px 0 #0000001a}.dark,[data-theme=dark]{--accent:#000}}
@layer components{.button{height:calc(var(--spacing) * 10);border-radius:calc(var(--radius) * 3);padding-inline:calc(var(--spacing) * 4);font-size:var(--text-sm);font-weight:var(--font-weight-medium);background-color:var(--button-bg);color:var(--button-fg);--button-bg:transparent}@media (min-width:48rem){.button{height:calc(var(--spacing) * 9)}}.button:hover{border-radius:0}.button--primary{--button-bg:var(--accent);--button-fg:var(--accent-foreground)}.button--secondary{--button-bg:var(--default);--button-fg:var(--accent)}.button--outline{--button-bg:transparent;--button-fg:var(--default-foreground)}.button--outline{border-style:var(--tw-border-style);border-width:1px;border-color:var(--border)}
.input{border-radius:var(--field-radius,calc(var(--radius) * 1.5));border-style:var(--tw-border-style);background-color:var(--field-background,var(--default));padding-inline:calc(var(--spacing) * 3);padding-block:calc(var(--spacing) * 2);font-size:var(--text-base);line-height:var(--tw-leading,var(--text-base--line-height));--tw-shadow:var(--field-shadow);box-shadow:var(--tw-inset-shadow),var(--tw-shadow)}@media (min-width:40rem){.input{font-size:var(--text-sm);line-height:var(--tw-leading,var(--text-sm--line-height))}}.input{border-width:var(--border-width-field);border-color:var(--field-border)}.input--secondary{--tw-shadow:0 0 #0000;box-shadow:var(--tw-inset-shadow),var(--tw-shadow);background-color:var(--input-bg);--input-bg:var(--default)}
.card{padding:calc(var(--spacing) * 4);--tw-shadow:var(--surface-shadow);box-shadow:var(--tw-shadow);border-radius:min(32px,var(--radius-3xl))}.card--transparent{--tw-shadow:0 0 #0000;background-color:#0000}
.chip{border-radius:calc(var(--radius) * 2);padding-inline:calc(var(--spacing) * 2);padding-block:calc(var(--spacing) * .5);font-size:var(--text-xs);--tw-leading:calc(var(--spacing) * 5);line-height:calc(var(--spacing) * 5);font-weight:var(--font-weight-medium);--chip-bg:var(--default);background-color:var(--chip-bg)}.chip--sm{padding-inline:calc(var(--spacing) * 1);padding-block:calc(var(--spacing) * 0);font-size:var(--text-xs);line-height:var(--tw-leading,var(--text-xs--line-height))}}
`;
const THEME = `@theme inline {
  --shadow-surface: var(--surface-shadow);
}
`;
const GRAMMAR = `@layer starci-grammar-common, starci-grammar-core;
@import "./components-forms.css";
@layer starci-grammar-common {
    .grammar-common-root {
        --grammar-inline-gap: 0.5rem;
        --grammar-section-gap: 1rem;
        --grammar-page-inset: clamp(1rem, 3vw, 2rem);
        --surface-shadow: 0 2px 4px 0 rgb(0 0 0 / 4%);
    }
    .starci-core-surface {
        border-radius: var(--starci-core-surface-radius, 1rem);
        background: var(--surface, Canvas);
    }
    .starci-core-surface[data-grammar-surface-depth="top"] {
        border: 0;
        box-shadow: var(--starci-core-surface-shadow, var(--shadow-surface, 0 1px 3px rgb(0 0 0 / 0.16)));
    }
    .starci-core-surface[data-grammar-surface-depth="nested"] {
        border: 1px solid var(--border, GrayText);
        box-shadow: none;
    }
    .starci-core-surface-content { padding: var(--starci-core-surface-inset, 1.25rem); }
    .starci-core-surface[data-grammar-surface-composition="joined"] > .starci-core-surface-content { gap: 0; padding: 0; }
    .starci-core-surface-card { gap: var(--starci-core-section-gap, 0.75rem) !important; padding: 0 !important; }
    .starci-core-surface-label { gap: var(--starci-core-inline-gap, 0.5rem); }
    .starci-core-input { gap: 0.5rem !important; }
}
`;
const FORMS = `@layer starci-grammar-common {
    .starci-core-button[data-width="fill"] {
        height: auto !important;
        min-height: var(--starci-core-control-min-size, 2.75rem);
    }
}
`;
const FAMILY = `@layer nivo-grammar {
    :root,
    .grammar-common-root[data-grammar-family="nivo"] {
        --nivo-font-interface: ui-sans-serif, system-ui, sans-serif;
        --nivo-accent: oklch(57% 0.24 25);
        --nivo-default: oklch(94% 0.0015 354.13);
        --nivo-surface-radius: 1.5rem;
        --nivo-control-radius: 0.5rem;
        --nivo-field-radius: 0.75rem;
        --nivo-surface-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    }
    :root,
    .grammar-common-root[data-grammar-family="nivo"] {
        --accent: var(--nivo-accent);
        --default: var(--nivo-default);
        --surface: oklch(100% 0 0);
        --surface-shadow: var(--nivo-surface-shadow);
        --field-border: transparent;
        --radius: var(--nivo-control-radius);
        --field-radius: var(--nivo-field-radius);
    }
    .grammar-common-root[data-grammar-family="nivo"] { font-family: var(--nivo-font-interface); }
    .grammar-common-root[data-grammar-family="nivo"][data-grammar-theme="dark"] { --nivo-accent: #111; }
}
`;
const ENTRY = `@import "tailwindcss";
@import "@heroui/styles/css";
@import "@starci/grammar/common.css";
@import "../../../../packages/ui/src/nivo.css";

.console { font-family: var(--font-open-sans), var(--nivo-font-console, "Open Sans"); }
`;

const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

/** Build the repo under a fresh temp dir; returns {repo, app, cleanup}. */
export function buildGeometryRepo() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-geometry-')));
  const app = path.join(repo, 'apps', 'app');
  write(path.join(repo, 'package.json'), JSON.stringify({ name: 'fixture', private: true }));
  write(path.join(app, 'package.json'), JSON.stringify({ name: 'app', private: true }));
  write(path.join(app, 'src', 'app', 'globals.css'), ENTRY);
  const hero = path.join(app, 'node_modules', '@heroui', 'styles');
  write(path.join(hero, 'package.json'), JSON.stringify({ name: '@heroui/styles', version: '3.2.6', exports: { './css': { style: './dist/index.css' } } }));
  write(path.join(hero, 'dist', 'heroui.min.css'), HEROUI);
  write(path.join(hero, 'dist', 'themes', 'shared', 'theme.css'), THEME);
  const grammar = path.join(app, 'node_modules', '@starci', 'grammar');
  write(path.join(grammar, 'package.json'), JSON.stringify({ name: '@starci/grammar', version: '0.5.0', exports: { './common.css': './dist/common/styles.css' } }));
  write(path.join(grammar, 'dist', 'common', 'styles.css'), GRAMMAR);
  write(path.join(grammar, 'dist', 'common', 'components-forms.css'), FORMS);
  write(path.join(repo, 'packages', 'ui', 'package.json'), JSON.stringify({ name: '@acme/ui', exports: { './family.css': './src/nivo.css' } }));
  write(path.join(repo, 'packages', 'ui', 'src', 'nivo.css'), FAMILY);
  write(path.join(repo, 'packages', 'ui', 'src', 'Motion.tsx'), 'export const x = "var(--nivo-control-radius)";\n');
  return { repo, app, cleanup: () => fs.rmSync(repo, { recursive: true, force: true }) };
}

const DEFAULT_STYLE = () => ({
  display: 'block', position: 'static', fontFamily: 'ui-sans-serif, system-ui', fontSize: 14, fontWeight: 400, lineHeight: 20,
  color: [30, 30, 30, 1], bg: [0, 0, 0, 0], bgImage: false,
  border: [0, 1, 2, 3].map(() => ({ w: 0, style: 'none', color: [0, 0, 0, 0] })),
  radius: 0, shadow: 'none', padding: [0, 0, 0, 0], margin: [0, 0, 0, 0], rowGap: null, columnGap: null,
  outline: { style: 'none', w: 0, color: null, offset: 0 }, overflowX: 'visible', overflowY: 'visible', textAlign: 'start',
});

/** A snapshot shaped like grammar-geometry.mjs collectPage output, from a compact element list. */
export function snapshotOf(elements, { width = 390, height = 844, probes = {}, focus = [], bodyBg = [245, 245, 245, 1] } = {}) {
  const els = elements.map((e, i) => {
    const style = { ...DEFAULT_STYLE(), ...(e.style ?? {}) };
    if (e.style?.border && !Array.isArray(e.style.border)) style.border = [0, 1, 2, 3].map(() => e.style.border);
    return {
      i, parent: e.parent ?? null, tag: e.tag ?? 'div', id: null, cls: e.cls ?? '', role: e.role ?? null, type: e.type ?? null, href: null,
      aria: { selected: null, current: null, hidden: null, required: null, invalid: null, ...(e.aria ?? {}) },
      required: false, disabled: false, labelText: e.labelText ?? null, described: e.described ?? [], placeholder: null, value: e.value ?? null,
      own: e.own ?? '', textLen: (e.own ?? '').length, rect: { x: e.x, y: e.y, w: e.w, h: e.h }, visible: true, style,
    };
  });
  return { file: 'fixture.html', viewport: { width, height }, root: { fontPx: 16, clientWidth: width, scrollWidth: width, scrollHeight: 1200, bodyBg, htmlBg: [0, 0, 0, 0] }, fonts: [], probes, elements: els, focus };
}
