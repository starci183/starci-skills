import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { flagsOfUsage } from '../../scripts/checks/check-cli-parity.mjs';
import { main } from '../../scripts/cli/main.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const publicVerbs = {
  'asset-slot': [],
  'brand-direction': ['archetype', 'lang', 'receipt', 'work', 'write'],
  'brand-palette': ['brand', 'check', 'prompt', 'scan'],
  brand: ['grammar-root', 'source', 'stage'],
  'compose-direction': ['breakpoint', 'content', 'fit', 'host-state', 'out', 'presentation', 'prompt', 'scrim', 'state', 'theme', 'tool', 'ui'],
  'draw-feedback': ['as', 'by', 'class', 'note', 'shape', 'target', 'ui', 'write'],
  'draw-gates': ['checks-out', 'files', 'no-remeasure', 'repo', 'ui'],
  'draw-grammar': ['file', 'grammar', 'grammar-dist', 'product'],
  'draw-loop': ['base', 'css', 'drawer', 'family', 'fixture', 'force', 'grammar', 'grammar-dist', 'html', 'no-critic', 'no-full-page', 'out', 'parts', 'product', 'prompt', 'repo', 'source', 'state', 'ui', 'viewports'],
  'draw-render': ['base', 'component', 'css', 'export', 'full-page', 'grammar', 'grammar-dist', 'harness-out', 'html', 'name', 'out', 'product', 'props', 'rationale', 'state', 'theme', 'trace', 'viewports'],
  'draw-review': ['job', 'lang', 'owner-requested', 'receipt', 'ui', 'write'],
  'draw-acceptance': ['files', 'job', 'repo'],
  'draw-dna': ['family', 'proposals'],
  'draw-layer': ['playwright'],
  'draw-rationale': ['rationale', 'records', 'ui'],
  'draw-source': ['fixture', 'grammar', 'grammar-dist', 'product', 'rationale'],
  'draw-taste': ['html', 'png'],
  'grammar-proposal': [],
  'layout-tree': ['active-nav', 'app', 'app-dir', 'breakpoint', 'design', 'destination', 'file', 'files', 'from', 'key', 'locale', 'node', 'provenance', 'rect', 'repo-root', 'route', 'theme', 'tolerance', 'url', 'work', 'write'],
  'render-proof': ['record', 'work'],
  'grammar-geometry': ['check', 'family', 'prompt', 'repo', 'viewport'],
  'grammar-knowledge': ['write'],
  'grammar-registry-pin': ['repo'],
  'shell-conformance': [],
  'ui-proof-brief': ['elements', 'family', 'repo', 'score', 'surface', 'viewport'],
  'example-critique': ['work', 'write'],
  'example-derive': ['work', 'write'],
  'example-evidence': ['assert', 'cwd', 'record', 'work'],
  'example-verify': ['cwd', 'record', 'work'],
  graph: ['file', 'from', 'job', 'reason', 'repo', 'slice', 'to', 'version', 'workflow'],
};

test('work catalog resolves every public handler and its exact local flags', () => {
  for (const [verb, flags] of Object.entries(publicVerbs)) {
    const command = catalog.groups.work.verbs[verb];
    assert.ok(command, verb);
    assert.equal(fs.existsSync(path.join(root, command.impl.script)), true, command.impl.script);
    assert.deepEqual(command.flags.map((flag) => flag.name).sort(), flags);
    const source = fs.readFileSync(path.join(root, command.impl.script), 'utf8');
    const usageText = source.split('\n').filter((line) => /Usage:|use:/.test(line) || /^\s*(?:(?:\/\/|\*)\s{2,})?(?:starci work|\[--)/.test(line)).join('\n');
    const documented = flagsOfUsage(usageText);
    for (const flag of documented) assert.ok(flags.includes(flag), `${verb} parses or documents undeclared --${flag}`);
  }
});



test('work dispatcher rejects undeclared flags and unsupported machine output', () => {
  assert.equal(main(['work', 'draw-loop', 'status', '--out', 'loop', '--bogus'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
  assert.equal(main(['work', 'render-proof', '--work', '.starciwork', '--record', 'ui.home', '--json'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
});
