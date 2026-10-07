import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';

/**
 * Inspect a built UI index and its directly referenced local module/style files.
 * A local module entry is required; external modules fail, external styles are ignored.
 * Referenced paths must resolve inside distDir; filesystem stat checks may follow links.
 * Returns {ok,assets,missing} or {ok:false,reason}; no asset fetch or HTTP health probe runs.
 */
function inspectUiTag(match, { attribute, file, missing, assets, modules }) {
  const tag = match[0], kind = match[1].toLowerCase();
  const module = kind === 'script' && attribute(tag, 'type') === 'module';
  const style = kind === 'link' && String(attribute(tag, 'rel')).split(/\s+/).includes('stylesheet');
  if (!module && !style) return;
  const value = attribute(tag, module ? 'src' : 'href');
  if (!value) { if (module) { missing.push('module-source'); } return; }
  const url = new URL(value, 'http://localhost/');
  if (url.origin !== 'http://localhost') { if (module) { missing.push('external-module'); } return; }
  const relative = decodeURIComponent(url.pathname).replace(/^\//, '');
  assets.push(relative);
  if (module) modules.push(relative);
  try { if (!file(relative)) missing.push(relative); } catch { missing.push(relative); }
}

export function uiDeliveryReadiness({ distDir = path.join(skillRoot, 'ui', 'dist'), fsImpl = fs } = {}) {
  const root = path.resolve(distDir);
  const file = (relative) => {
    const target = path.resolve(root, relative);
    return target.startsWith(root + path.sep) && fsImpl.statSync(target).isFile();
  };
  try {
    if (!file('index.html')) return { ok: false, reason: 'index unavailable' };
    const html = fsImpl.readFileSync(path.join(root, 'index.html'), 'utf8');
    const attribute = (tag, name) => new RegExp(String.raw`\b${name}\s*=\s*["']([^"']*)["']`, 'i').exec(tag)?.[1] ?? null;
    const missing = [], assets = [], modules = [];
    for (const match of html.matchAll(/<(script|link)\b[^>]*>/gi)) inspectUiTag(match, { attribute, file, missing, assets, modules });
    if (!modules.length) missing.push('module-entry');
    return { ok: missing.length === 0, assets, missing };
  } catch { return { ok: false, reason: 'delivery unavailable' }; }
}
