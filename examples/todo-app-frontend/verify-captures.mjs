import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../engine/yaml.mjs';
import {decodePng, checkPalette, checkEntityListInCard} from '../../scripts/checks/render.mjs';

/**
 * Replays the render evidence for the share invite screen's running-page captures. The generic
 * `starci render check` command cannot read this example tree's `work/brand@1` record (it expects the
 * newer `work/node@1` brand shape), so this script calls the same canon checks in scripts/checks/render.mjs
 * directly against the same brand block.
 *
 * Usage: node verify-captures.mjs <assets|palette|primary|entity-list>
 * Exits 0 when every capture passes the named check, 1 otherwise.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(here, '../todo-app-backend/.starciwork/features/share/impl/todo-app-frontend/invite-screen/assets');
const brandFile = path.resolve(here, '../todo-app-backend/.starciwork/brand/index.yaml');

const STATES = ['empty', 'inviting', 'pending-list', 'accepted', 'refused'];
const VIEWPORTS = ['desktop-1280', 'mobile-390'];
const NAMES = STATES.flatMap(state => VIEWPORTS.map(viewport => `running-page-${state}-${viewport}`));

const check = process.argv[2];
if (!['assets', 'palette', 'primary', 'entity-list'].includes(check)) {
  console.error('usage: node verify-captures.mjs <assets|palette|primary|entity-list>');
  process.exit(2);
}

const brand = parseYaml(fs.readFileSync(brandFile, 'utf8')).brand;
let failed = false;

if (check === 'assets') {
  for (const name of NAMES) {
    const png = path.join(assetsDir, `${name}.png`);
    const html = path.join(assetsDir, `${name}.html`);
    if (!fs.existsSync(png) || !fs.existsSync(html)) {
      console.log(`FAIL ${name}: missing png/html pair`);
      failed = true;
      continue;
    }
    try {
      decodePng(fs.readFileSync(png));
    } catch (error) {
      console.log(`FAIL ${name}: png does not decode (${error.message})`);
      failed = true;
      continue;
    }
    const state = name.replace('running-page-', '').replace(`-${VIEWPORTS.find(viewport => name.endsWith(viewport))}`, '');
    const markup = fs.readFileSync(html, 'utf8');
    if (!markup.includes(`data-state="${state}"`)) {
      console.log(`FAIL ${name}: markup carries no data-state="${state}" marker`);
      failed = true;
      continue;
    }
    console.log(`pass ${name}: png decodes, markup carries data-state="${state}"`);
  }
} else {
  for (const name of NAMES) {
    let result;
    if (check === 'entity-list') {
      const markup = fs.readFileSync(path.join(assetsDir, `${name}.html`), 'utf8');
      result = checkEntityListInCard(markup);
    } else {
      const png = decodePng(fs.readFileSync(path.join(assetsDir, `${name}.png`)));
      const id = check === 'palette' ? 'palette-off-brand' : 'primary-absent';
      result = checkPalette({png, brand}).find(entry => entry.id === id);
    }
    console.log(`${result.outcome.toUpperCase()} ${result.id} ${name}: ${result.detail}`);
    if (result.outcome === 'fail') failed = true;
  }
}

process.exit(failed ? 1 : 0);
