// Actual disposable native form + published Core CSS. Every receipt uses current open/accept;

// screenshots and geometry are produced only by the runtime's declarative browser runner.

import assert from 'node:assert/strict';

import http from 'node:http';

import { execFileSync } from 'node:child_process';

import { readFileSync, copyFileSync, mkdirSync } from 'node:fs';

import path from 'node:path';

import { createSourceFixture, sha, read, put, git, commit, branch, current, actual, table, planCells, open, accept } from './workflow-source-fixture.mjs';



const q = value => '`' + value + '`';

const ref = step => `step-${step}/parallel-1`;

const UI_BINDINGS = ['@knowledge/ui/composition', '@knowledge/ui/presentation', '@knowledge/ui/proof', '@knowledge/grammars/<family>'];

export const INTERFACE_PAGE = 'src/modules/fixture/page.html';

export const INTERFACE_STYLE = 'src/modules/fixture/page.css';

const BASE_PAGE = `<!doctype html>

<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Transform text</title><meta name="starci-grammar-version" content="0.4.13"><link rel="stylesheet" href="/common.css"><link rel="stylesheet" href="/core.css"><link rel="stylesheet" href="/page.css"></head>

<body data-grammar-family="core"><main id="surface"><header id="intro"><h1>Transform text</h1><p>Convert text to uppercase. Your original input stays editable.</p></header><form id="transform-form"><div id="input-row"><label for="input">Input</label><input id="input" name="value" autocomplete="off" aria-describedby="input-help"><p id="input-help">Enter any text, then transform it. Empty input produces an empty result.</p></div><button type="submit">Run</button></form><section id="result-region" aria-labelledby="result-heading"><h2 id="result-heading">Result</h2><output role="status" aria-label="Result" aria-live="polite" id="result">Ready to transform.</output><a id="reload" href="/fixture">Reload</a></section></main>

<script type="module">

document.documentElement.dataset.fixtureLoad = String(performance.timeOrigin);

const form = document.getElementById('transform-form'), input = document.getElementById('input'), result = document.getElementById('result'), reload = document.getElementById('reload'); reload.href = location.href;

const query = new URL(location.href).searchParams; input.value = query.get('value') ?? ''; if (query.has('result')) result.textContent = query.get('result') || '(empty result)';

const button = form.querySelector('button'); let activation = null, submission = 0;
button.addEventListener('click', event => { activation = { at: event.timeStamp, receivedAt: performance.now(), trusted: event.isTrusted, type: event.type, input: input.value }; });
const visibleFeedback = frameTimestamp => {
  const box = result.getBoundingClientRect(), style = getComputedStyle(result);
  return { at: performance.now(), frameTimestamp, state: result.dataset.state, text: result.textContent,
    visible: document.visibilityState === 'visible' && result.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && style.display !== 'none' && box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth };
};
form.addEventListener('submit', async event => {
  event.preventDefault();
  const measure = { version: 1, sequence: ++submission, documentTimeOrigin: performance.timeOrigin, target: 'transform-form/button', input: input.value, activation, handlerAt: performance.now() };
  activation = null; delete document.documentElement.dataset.fixtureFeedback;
  button.disabled = true; button.setAttribute('aria-busy', 'true'); result.dataset.state = 'pending'; result.textContent = 'Transforming…';
  measure.stateChangedAt = performance.now(); measure.changedState = { state: result.dataset.state, text: result.textContent };
  requestAnimationFrame(frameTimestamp => {
    if (measure.sequence !== submission) return;
    measure.beforePaint = visibleFeedback(frameTimestamp);
    requestAnimationFrame(nextFrameTimestamp => {
      if (measure.sequence !== submission) return;
      measure.afterPaint = visibleFeedback(nextFrameTimestamp);
      document.documentElement.dataset.fixtureFeedback = encodeURIComponent(JSON.stringify(measure));
    });
  });
  try { const response = await fetch('/api?value=' + encodeURIComponent(input.value)); if (!response.ok) throw Error('Request failed'); const data = await response.json(); result.dataset.state = 'settled'; result.textContent = data.value || '(empty result)'; const url = new URL(location.href); url.searchParams.set('value', input.value); url.searchParams.set('result', data.value); history.replaceState(null, '', url); reload.href = url.href; } catch { result.dataset.state = 'error'; result.textContent = 'Could not transform. Edit the input or try again.'; } finally { button.disabled = false; button.removeAttribute('aria-busy'); }
});

</script></body></html>

`;

// These existing product layout values are frozen in the fixture base. The source operator only

// changes the existing action label; it neither clones a renderer nor claims to alter Core anatomy.

const BASE_STYLE = `*{box-sizing:border-box}body{margin:0;background:var(--starci-core-canvas,#fafafa);color:#222;font:16px/1.5 system-ui,sans-serif}main{max-width:640px;margin:32px auto;padding:24px;display:grid;gap:32px}header,section{display:grid;gap:8px}h1,h2,p{margin:0}h1{font-size:36px;line-height:1.2;font-weight:700}h2{font-size:22px;line-height:1.3;font-weight:600}form{display:grid;gap:24px}#input-row{display:grid;gap:8px}label{font-weight:600}input,button{min-height:48px;font:inherit;border-radius:6px}input{width:100%;padding:10px 12px;border:1px solid #666;background:#fff;color:#222}button{justify-self:start;padding:10px 24px;background:var(--starci-core-accent,#7547ff);border:1px solid transparent;color:#fff;font-weight:600;cursor:pointer}button:disabled{cursor:wait}input:focus-visible,button:focus-visible{outline:3px solid #222;outline-offset:3px}output{display:block;min-height:48px;padding:12px;border:1px solid #666;border-radius:6px;overflow-wrap:anywhere;background:#fff}a{display:inline-flex;align-items:center;min-height:44px;width:fit-content}#result[data-state=error]{border:3px solid #a00020;background:#fff5f5}#input-help{font-size:14px;color:#444}@media(max-width:480px){main{margin:0;padding:24px 20px 96px}h1{font-size:32px}button{position:fixed;bottom:24px;left:20px;width:calc(100% - 40px);z-index:1}}`;



function grammarFiles() {

  const retained = read(path.join(import.meta.dirname, 'workflow-interface-grammar.fixture.json'));

  assert.equal(retained.name, '@starci/grammar'); assert.equal(retained.version, '0.4.13');

  for (const [file, record] of Object.entries(retained.files)) assert.equal(sha(record.content), record.sha256, `retained public dependency ${file}`);

  const packageJson = JSON.parse(retained.files['package.json'].content); assert.equal(packageJson.version, retained.version);

  return { 'vendor/grammar/package.json': packageJson, 'vendor/grammar/common.css': retained.files['dist/common/styles.css'].content, 'vendor/grammar/core.css': retained.files['dist/core/styles.css'].content, 'vendor/grammar/LICENSE': retained.files.LICENSE.content,

    'vendor/grammar/provenance.json': { name: retained.name, version: retained.version, tarball: retained.tarball, integrity: retained.integrity, sourceRef: retained.sourceRef, extractedFiles: Object.fromEntries(Object.entries(retained.files).map(([file, record]) => [file, record.sha256])), offlineVerification: 'retained per-file hashes; original tarball was verified at extraction, not revalidated offline' } };

}



export async function interfaceBaseFiles() {

  return { ...await grammarFiles(), [INTERFACE_PAGE]: BASE_PAGE, [INTERFACE_STYLE]: BASE_STYLE,

    'README.md': 'Disposable anonymous stateless fixture. A native form consumes the local uppercase API. Core 0.4.13 Common/Core CSS is copied from the integrity-verified public package; this fixture does not reimplement a Grammar renderer. Existing page layout and URL-only continuity are frozen before opening. No credentials, datastore, product source or external runtime services are used.\n' };

}



export async function createInterfaceFixture(t, options = {}) {

  const { mission, feExisting, ...rest } = options;

  const baseFiles = await interfaceBaseFiles(); let frontend;

  const f = await createSourceFixture(t, { tags: ['backend', 'architecture', 'api', 'interface', 'browser'], ...rest, initialFiles: options.initialFiles, mission: context => {

    const { discovery, project, source, home, sessionId } = context;

    if (feExisting) frontend = { ...feExisting, head: git(feExisting.worktree, 'rev-parse', 'HEAD') };

    else {

      const repository = path.join(home, 'frontend'), worktree = path.join(home, sessionId + '-fe'); mkdirSync(repository); git(repository, 'init', '-q');

      for (const [file, bytes] of Object.entries(baseFiles)) put(path.join(repository, file), bytes);

      put(path.join(repository, '.gitignore'), '.worktrees/sessions/\n.worktrees/e2e/\n');

      put(path.join(repository, 'package.json'), { private: true, type: 'module', scripts: { build: 'node --check src/modules/fixture/verify.mjs' } });

      put(path.join(repository, 'src/modules/fixture/verify.mjs'), "import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs'; const html=readFileSync('src/modules/fixture/page.html','utf8'); assert.ok(html.includes('<label for=\"input\">Input</label>')); assert.ok(html.includes('aria-label=\"Result\"')); assert.ok(html.includes(\"fetch('/api?value='\")); console.log('Actual source bindings, labelled input and output verified.');\n");

      const head = commit(repository, 'Existing native fixture form with exact public Core dependency'); git(repository, 'remote', 'add', 'origin', repository); git(repository, 'worktree', 'add', '--quiet', '-b', `session/${sessionId}`, worktree, head); frontend = { repository, worktree, head };

    }

    const { repository, worktree, head } = frontend;

    const feRef = `.workspaces/local/routes/${project}/fe/config.json`;

    put(path.join(source, feRef), { project, role: 'fe', source: { path: source }, repository: { diskPath: worktree, gitRepository: repository } });

    discovery.repositories.push({ role: 'fe', project, repository, routeRef: feRef, head });

    discovery.impacts = [{ ...discovery.impacts[0], tags: ['backend', 'architecture', 'api'], routes: ['/api'] }, { id: 'interface', role: 'fe', routes: ['/fixture'], code: [INTERFACE_PAGE, INTERFACE_STYLE], behavior: 'An anonymous visitor edits text, invokes the existing API and reads its result; refine Run to Transform.', tags: ['interface', 'browser'], evidence: ['source:' + INTERFACE_PAGE] }];

    discovery.destinations.push({ role: 'fe', kind: 'artifact', target: 'Accepted interface source, audit and browser proof' });

    for (const lane of ['interface', 'audit', 'uat']) discovery.lanes[lane].owner = 'fe';

    return { goal: 'Implement and verify the stateless worker and refine its anonymous form action label.', includes: ['Actual backend and interface source, API, quality, interface audit and browser UAT'], doneWhen: [

      { evidence: 'The stateless worker source is implemented and tested.', producedBy: 'backend.generate' }, { evidence: 'The backend source passes actual quality.', producedBy: 'quality.verify' },

      { evidence: 'The existing form names its action Transform.', producedBy: 'interface.generate' }, { evidence: 'The actual served form is audited.', producedBy: 'interface.audit' }, { evidence: 'The exact frontend source passes its declared quality gate.', producedBy: 'quality.verify' },

      { evidence: 'The browser visits the form and observes the actual uppercase result.', producedBy: 'uat.verify' }, { evidence: 'The actual API verifies the stateless worker.', producedBy: 'api.verify' }, { evidence: 'The exact runtime is observed healthy.', producedBy: 'runtime.serve' }

    ], ...(typeof mission === 'function' ? mission(context) : mission) };

  } });

  return { ...f, feWorktree: frontend.worktree, feRepository: frontend.repository, feBase: frontend.head };

}



export async function startInterfaceRuntime(t, f, { worker = value => value.toUpperCase(), apiEndpoint = null } = {}) {

  const observed = [], control = { mode: 'normal' }, pending = [];

  const server = http.createServer(async (request, response) => {

    const url = new URL(request.url, 'http://127.0.0.1');

    const refs = { '/form.html': INTERFACE_PAGE, '/fixture': INTERFACE_PAGE, '/page.css': INTERFACE_STYLE, '/common.css': 'vendor/grammar/common.css', '/core.css': 'vendor/grammar/core.css', '/grammar.json': 'vendor/grammar/package.json' };

    if (url.pathname === '/api') {

      const value = url.searchParams.get('value') ?? '';

      if (control.mode === 'pending') { observed.push({ value, mode: 'pending', at: new Date().toISOString() }); pending.push(response); return; }

      if (control.mode === 'error') { observed.push({ value, mode: 'error', status: 503, at: new Date().toISOString() }); response.writeHead(503); response.end('Injected fixture service unavailability'); return; }

      if (apiEndpoint) { const target = new URL(apiEndpoint); target.search = url.search; const actualResponse = await fetch(target); const bytes = await actualResponse.text(); observed.push({ value, target: target.href, status: actualResponse.status, at: new Date().toISOString() }); response.writeHead(actualResponse.status, { 'content-type': 'application/json' }); response.end(bytes); }

      else { observed.push({ value, at: new Date().toISOString() }); response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ value: worker(value) })); }

      return;

    }

    if (url.pathname.startsWith('/calibration/')) { const name = path.posix.basename(url.pathname); if (/^anchor-(?:low|mid|high)\.html$/.test(name)) { response.writeHead(200, { 'content-type': 'text/html' }); response.end(readFileSync(path.join(f.root, 'knowledge/ui/proof/calibration', name))); return; } }

    const file = refs[url.pathname]; if (!file) { response.writeHead(404); response.end(); return; }

    response.writeHead(200, { 'content-type': file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html' }); response.end(readFileSync(path.join(f.feWorktree ?? f.worktree, file)));

  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));

  const origin = `http://127.0.0.1:${server.address().port}`;

  return { server, endpoint: origin + '/fixture', origin, observed, control, releasePending: () => { for (const response of pending.splice(0)) { response.writeHead(503); response.end('Fixture pending observation complete'); } } };

}



export async function acceptInterfaceRoute(f, { step = 10, goal = { prerequisite: '11/1' } } = {}) {

  const role = 'fe', worktree = f.feWorktree ?? f.worktree, state = f.state(), project = state.project, head = git(worktree, 'rev-parse', 'HEAD'), sessionBranch = git(worktree, 'branch', '--show-current');

  const hydratedRouteRef = state.mission.discovery.repositories.find(item => item.role === role).routeRef, portableRouteRef = `.workspaces/projects/${project}/fe.json`;

  const gitPolicy = { mutationBranch: sessionBranch, worktreeBranches: 'session-only' };

  const hydrated = read(path.join(f.source, hydratedRouteRef)); hydrated.gitPolicy = gitPolicy; put(path.join(f.source, hydratedRouteRef), hydrated);

  const repository = git(worktree, 'remote', 'get-url', 'origin');

  put(path.join(f.source, portableRouteRef), { project, role, repository: { gitRepository: repository }, gitPolicy });

  const disk = worktree.replaceAll('\\', '/');

  const route = { project, role, portableRouteRef, hydratedRouteRef, routeFingerprint: sha(readFileSync(path.join(f.source, hydratedRouteRef))), identityFingerprint: sha('anonymous fixture without credentials'), sourceHead: head, checkout: { diskPath: disk, gitRoot: disk, gitRepository: repository, branch: sessionBranch, repositoryKind: 'source', directory: null, sourceHead: head }, gitPolicy, mutationReadiness: 'ready', writeRoots: [], authorityRoots: { businesses: null }, runtime: null, provenanceHeadRef: null };

  planCells(f, [[step, 'workspace.bind'], ...(goal.prerequisite ? [[Number(goal.prerequisite.split('/')[0]), 'interface.generate']] : [])]);

  const request = current(f, { operatorId: 'workspace.bind', contexts: [{ alias: `@workspaces/projects/${project}/fe`, head: null }, { alias: `@workspaces/local/routes/${project}/fe`, head }, { alias: '@workspaces/device-state', head: null }], requirements: { project, role, gitPolicy, declaredWriteRoots: [], resume: null }, inputs: {} }, step, { goal, workspace: false, mode: 'inline' });

  const dir = await open(f, request); put(path.join(dir, 'response/data/route.json'), route);

  put(path.join(dir, 'response/response.md'), `# workspace-route-binding — ${project}/fe\n` + table('Binding', ['Field', 'Value'], [['Project', project], ['Role', role], ['Portable route', portableRouteRef], ['Hydrated route', hydratedRouteRef], ['Source head', head]]) + table('Checkout', ['Field', 'Value'], [['Disk path', disk], ['Git root', disk], ['Git repository', repository], ['Branch', sessionBranch], ['Repository kind', 'source'], ['Directory', '—'], ['Source head', head], ['Mutation readiness', 'ready'], ['Businesses root', '—'], ['Installed tree', 'absent']]) + table('Policy', ['Field', 'Value'], [['Worktree branches', 'session-only'], ['Mutation branch', sessionBranch]]) + table('Write roots', ['Path', 'Why']) + table('Runtime', ['Field', 'Value']) + table('Findings', ['Code', 'Subject', 'Statement'], [['`ROUTE_HYDRATED_FROM_PORTABLE`', hydratedRouteRef, 'The initial declared FE route names this real checkout.'], ['`IDENTITY_ROSTER_SEALED`', 'anonymous', 'The disposable fixture has no credentials.'], ['`WORKTREE_BRANCH_SESSION_ONLY`', sessionBranch, 'The fixture uses its actual session branch.']]));

  await accept(f, request, actual(request, { fields: { 'workspace-route-binding': 'response/response.md', route: 'response/data/route.json' }, fallbacks: [], commits: [], next: ['interface.generate'] }, 'done', ['response/response.md'], 'sol-fresh'));

  return { step, ref: `${ref(step)}/response/data/route.json`, head, route };

}



async function freezeKnowledge(f, dir, bindings, { before = 'request/before.html', after = 'response/artifacts/form.html' } = {}) {

  const { buildKnowledgeManifest } = await f.load('scripts/knowledge-manifest.mjs');

  const manifest = buildKnowledgeManifest(f.root, bindings, { family: 'starci' });

  const pkg = read(path.join(f.feWorktree ?? f.worktree, 'vendor/grammar/provenance.json'));

  const brief = { schemaVersion: 10, grammarId: 'starci', packageBinding: { name: pkg.name, version: pkg.version, sourceRef: pkg.sourceRef },

    authoritySplit: { common: 'Published Common CSS owns shared family foundations; native HTML owns its built-in semantics.', family: 'The exact published Core CSS owns scoped family tokens.', product: 'The existing disposable page owns routes, copy, URL continuity and API effects.' },

    visualPrinciples: [{ principle: 'Keep the existing single-column form, neutral canvas and one Core accent action.', source: 'knowledge/grammars/starci/family.md' }],

    businessShape: { shape: 'Existing anonymous native transformation form; copy-only refine.', fit: 'composed', source: 'request/before.html' },

    reuse: [{ concept: 'Reuse the unchanged existing form and the published Core CSS values.', owner: 'product', source: 'request/before.html' }], ownerSearch: { common: ['knowledge/grammars/starci/DNA.md'], family: ['knowledge/grammars/starci/family.md'], product: [INTERFACE_PAGE, INTERFACE_STYLE], gaps: [] }, decision: 'reuse', deltas: { props: [], anatomy: [], tokens: [], claims: [], classes: [] }, consumers: ['/fixture'], compatibility: 'Only Run becomes Transform; native form, routes, states, styles and API behavior stay byte-identical.', proof: { before, after }, knowledgeChallenges: [], rollback: 'Revert the one action-label source commit; no persisted records exist.' };

  put(path.join(dir, 'request/knowledge-manifest.json'), manifest); put(path.join(dir, 'request/family-understanding.json'), brief);

  return { manifest, brief };

}



async function finishKnowledge(f, dir, frozen, measurements, audit = null) {

  const { manifestEntities } = await f.load('scripts/knowledge-manifest.mjs');

  put(path.join(dir, 'response/data/family-understanding.json'), frozen.brief);

  // A copy-only source review establishes non-mutation, not a blanket canon pass. Each semantic

  // address has its own published heading and the actual operation evidence; visual closure is

  // produced separately by the audit's measured matrix.

  const items = manifestEntities(frozen.manifest).map(entity => {

    const ruleId = entity.key.replace(/^(?:rule|case):/, '').split('/')[0];

    const owner = frozen.manifest.files.find(file => file.path === entity.source);

    const heading = owner.rules?.find(rule => rule.id === ruleId)?.heading;

    const actual = audit
      ? `${heading ?? entity.source}: reviewed against the recorded primary form at ${audit.entries.map(entry => entry.matrixId).join(', ')}. The evidence inventories the native Input, Transform, Result and Reload, the real pending/503/uppercase response states, composed text contrast, target and region geometry, and static reduced-motion output. Published renderer-specific anatomy, nested navigation, selection, credentials and record-volume situations have no corresponding node or data in this native stateless fixture; the retained DOM records establish that boundary. This is evidence for the selected primary surface, not a certification of other Grammar consumers.`
      : entity.kind === 'file' ? `Read frozen ${owner.authority} ${entity.source}; this operation reuses its existing family and makes no presentation or anatomy change.` : `${heading ?? ruleId}: the actual source diff changes only the existing action label. The before/after HTML and browser measurements bound this review; this row asserts no new whole-surface conformance.`;
    return { key: entity.key, applicability: 'applicable', actual, evidence: entity.kind === 'file' ? [entity.source, ...(audit ? [measurements] : [])] : ['request/before.html', 'response/artifacts/form.html', measurements] };

  });

  put(path.join(dir, 'response/data/knowledge-coverage.json'), { schemaVersion: 10, manifestFingerprint: frozen.manifest.fingerprint, items });

}



export async function captureInterface(f, dir, runtime, { name, width = 1440, height = 900, button = 'Transform', value = null, state = 'loaded', endpoint = runtime.endpoint, browserHostRoot = process.env.STARCI_WALK_HOST_ROOT ?? f.source } = {}) {

  const { runWalk } = await f.load('scripts/browser-walk.mjs');

  runtime.control.mode = state === 'pending' || state === 'error' ? state : 'normal';

  const steps = [{ id: 'open', action: 'goto', target: null, value: endpoint }];

  if (value !== null) steps.push({ id: 'input', action: 'fill', target: { role: 'textbox', name: 'Input', exact: true }, value }, { id: 'transform', action: 'click', target: { role: 'button', name: button, exact: true } }, { id: 'settled', action: 'expect', target: { role: 'status', name: 'Result', exact: true }, expect: { text: state === 'pending' ? 'Transforming' : state === 'error' ? 'Could not transform' : value.toUpperCase() || '(empty result)' } });

  steps.push({ id: 'capture', action: 'capture', target: null, capture: { name } });

  const walk = { schemaVersion: 9, id: name, flow: 'fixture-form', entry: { route: endpoint, viewport: { width, height, deviceScaleFactor: 1 }, colorScheme: 'light', reducedMotion: 'reduce', locale: 'en' }, account: null, steps };

  const file = path.join(dir, `request/${name}.walk.json`); put(file, walk);

  const result = await runWalk(file, path.join(dir, 'response'), { root: f.root, hostRoot: browserHostRoot });

  runtime.control.mode = 'normal'; runtime.releasePending();

  assert.equal(result.code, 0, JSON.stringify(result));

  return { name, walk, ...result, measurements: read(path.join(dir, `response/artifacts/${name}.measurements.json`)) };

}



function tasteFrom(measurements) {

  const visible = measurements.elements.filter(element => element.bbox.width > 0 && element.bbox.height > 0), byTag = tag => visible.filter(element => element.tag === tag), title = byTag('h1')[0], subtitle = byTag('h2')[0], button = byTag('button')[0], input = byTag('input')[0];

  assert.ok(title && button && input); assert.ok(parseFloat(title.computed.fontSize) >= parseFloat(subtitle.computed.fontSize) * 1.3); assert.ok(button.bbox.height >= 44 && input.bbox.height >= 44); assert.ok(button.contrast >= 4.5); assert.ok(visible.every(element => element.bbox.x >= -1 && element.bbox.x + element.bbox.width <= measurements.viewport[0] + 1));
  const links = byTag('a'); assert.ok(links.every(element => element.bbox.height >= 44));
  assert.equal(title.bbox.x, input.bbox.x); assert.equal(button.computed.borderRadius, input.computed.borderRadius);

  const main = visible.find(element => element.tag === 'main'), paragraphs = byTag('p');

  const observations = [

    `The sole h1 is ${title.computed.fontSize}/${title.computed.fontWeight}; the result h2 is ${subtitle.computed.fontSize}/${subtitle.computed.fontWeight}.`,

    `The one content-sized main is ${main.bbox.height}px tall; its region gap is ${main.computed.gap.row}; there are no image or decorative band elements.`,

    `Heading x=${title.bbox.x}px; form input x=${input.bbox.x}px; paragraph left edges are ${paragraphs.map(item => item.bbox.x).join(', ')}px.`,

    `Main region gap ${main.computed.gap.row}; existing form gap 24px; field/heading gaps 8px, retained in frozen CSS.`,

    `There is one filled button, with ${button.computed.backgroundColor} background and contrast ${button.contrast}:1; the other controls use neutral surfaces.`,

    `Title ${title.computed.fontSize}, section ${subtitle.computed.fontSize}, body ${input.computed.fontSize}; help text ${paragraphs.at(-1)?.computed.fontSize}.`,

    `Button and input radii are ${button.computed.borderRadius} and ${input.computed.borderRadius}; there are no card nesting layers.`,

    `The captured DOM contains ${byTag('img').length} images; the form's action and title carry all visual meaning.`,

    `One bounded form occupies ${main.bbox.width}x${main.bbox.height}px; the page has no record list or seeded-volume dependency.`,

    `The input ${input.bbox.width}x${input.bbox.height}px and result region persist in the actual loaded/settled captures.`,

    `Input target ${input.bbox.width}x${input.bbox.height}px; button target ${button.bbox.width}x${button.bbox.height}px; Reload target ${links[0]?.bbox.width}x${links[0]?.bbox.height}px.`,

    'n/a: the source refinement changes no presentation value or surface class.'

  ];

  return { entries: observations.map((measured, i) => ({ rule: `TASTE-${i + 1}`, measured, score: i === 11 ? null : 4, verdict: 'pass', routeTo: 'none' })), mean: 4, verdict: 'ship' };

}



export async function acceptInterface(f, runtime, route, { step = 11, goal = { doneWhen: 2 }, browserHostRoot, coordination = null, beforeRequest = null, transform = source => source.replace('>Run</button>', '>Transform</button>'), description = 'Name the existing fixture action Transform', beforeButton = null } = {}) {

  const worktree = f.feWorktree ?? f.worktree, base = git(worktree, 'rev-parse', 'HEAD'), sessionBranch = git(worktree, 'branch', '--show-current'), before = readFileSync(path.join(worktree, INTERFACE_PAGE), 'utf8'), after = transform(before);

  assert.notEqual(before, after);

  planCells(f, [[step, 'interface.generate']]);

  const contexts = [{ alias: '@workspaces/fe', head: base }, { alias: '@grammar/core', head: null }, ...UI_BINDINGS.map(alias => ({ alias: alias.replace('<family>', 'starci'), head: null }))];

  const request = current(f, { operatorId: 'interface.generate', contexts, requirements: { target: '/fixture', intent: 'modify', changeLevel: 'refine', ownerCeiling: 'surface-only', candidates: 1, preview: 'no', references: [], selectionPolicy: 'automatic', approval: null, maxRounds: 2, contractEmission: 'off', mode: 'apply', resume: null }, inputs: {} }, step, { goal, coordination });

  request.environment.workspace = { alias: '@workspaces/fe', worktree, revision: base }; request.environment.writes = ['@workspaces/fe/' + INTERFACE_PAGE]; request.environment.exclusive = [path.join(worktree, INTERFACE_PAGE)];

  const dir = branch(f, step); put(path.join(dir, 'request/before.html'), before); const frozen = await freezeKnowledge(f, dir, UI_BINDINGS);

  request.frozenInputs = ['request/knowledge-manifest.json', 'request/family-understanding.json', 'request/before.html'].map(ref => ({ ref, sha256: sha(readFileSync(path.join(dir, ref))) }));
  if (beforeRequest) await beforeRequest({ request, dir });

  await open(f, request);

  const { acquireWorkerSlot } = await f.load('scripts/worker-slots.mjs'); await acquireWorkerSlot(dir, 'fixture-interface-author', { ranProfile: 'sol-fresh' });

  const reflog = () => `HEAD ${git(worktree, 'reflog', 'show', '--format=%H', 'HEAD').split('\n').length} ${git(worktree, 'rev-parse', 'HEAD')}; stash 0`;

  const preflight = `passed at ${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}`, beforeLog = reflog();

  await captureInterface(f, dir, runtime, { name: 'before', button: beforeButton ?? (before.includes('>Run</button>') ? 'Run' : 'Transform'), browserHostRoot });

  put(path.join(worktree, INTERFACE_PAGE), after); put(path.join(dir, 'response/artifacts/form.html'), after); const tree = 'export const resolvedDocument = ' + JSON.stringify(after) + ';\n'; put(path.join(dir, 'response/artifacts/form.resolved.tsx'), tree);

  const captures = [];

  for (const [name, width, height] of [['form-wide', 1440, 900], ['form-narrow', 390, 844]]) captures.push(await captureInterface(f, dir, runtime, { name, width, height, endpoint: runtime.origin + '/form.html?viewport=' + (name.endsWith('wide') ? 'wide' : 'narrow'), browserHostRoot }));

  for (const capture of captures) copyFileSync(path.join(dir, `response/artifacts/${capture.name}.png`), path.join(dir, `response/artifacts/form.${capture.name.endsWith('wide') ? 'wide' : 'narrow'}.png`));

  const scores = captures.map(capture => tasteFrom(capture.measurements));

  put(path.join(dir, 'response/data/write-set.txt'), INTERFACE_PAGE + '\n');

  const output = execFileSync(process.execPath, [path.join(f.root, 'scripts/sweep-presentation.mjs'), worktree, '--write-set', path.join(dir, 'response/data/write-set.txt'), '--json'], { encoding: 'utf8', windowsHide: true }); const sweep = JSON.parse(output); assert.deepEqual(sweep.findings, []);

  const head = commit(worktree, description, [INTERFACE_PAGE]), afterLog = reflog();

  const files = [{ path: INTERFACE_PAGE, change: 'modified', before: sha(before), after: sha(after), classes: [] }];

  put(path.join(dir, 'response/data/writes.json'), { mode: 'apply', base, branch: sessionBranch, commit: head, sweep: { command: `node scripts/sweep-presentation.mjs ${worktree} --write-set response/data/write-set.txt --json`, exitCode: 0, findings: sweep.findings, output }, files });

  put(path.join(dir, 'response/data/inventory.json'), { treeFingerprint: sha(tree), classNames: [], ruleIds: [], gaps: [] });

  put(path.join(dir, 'response/resolution.md'), '# frontend-presentation-resolution — fixture-form\n' + table('Owner map', ['Node', 'Property', 'Owner', 'Rule']) + table('Rules chosen', ['Node', 'Rule', 'Class', 'Condition']) + table('Removed', ['Node', 'Class', 'Because']) + table('Gaps', ['Node', 'Property', 'Missing path']) + table('Fallbacks taken', ['Code', 'Action']));

  put(path.join(dir, 'response/data/coverage.json'), { directionId: 'fixture-form', surfaceClass: 'form', actions: [{ action: 'Transform', pointerRoute: 'click Transform', keyboardRoute: 'Tab to Input, type, Tab to Transform, Enter', states: ['loaded', 'pending', 'error', 'settled'], pendingPaths: [{ path: 'local API success', settlement: 'result displays uppercase text' }, { path: 'local API failure', settlement: 'result reports failure and the action is enabled again' }] }, { action: 'Reload', pointerRoute: 'click Reload', keyboardRoute: 'Tab to Reload, Enter', states: ['loaded', 'settled'] }], regions: [{ region: 'input', idiomRef: 'idioms#sign-in', compositionRef: '@grammar/core#form' }, { region: 'result', idiomRef: 'idioms#feedback', compositionRef: '@grammar/core#output' }], states: [{ meaning: 'pending', carrier: 'named disabled busy button and pending result' }, { meaning: 'error', carrier: 'actual failure message and enabled retry' }, { meaning: 'loaded', carrier: 'native input and ready result' }, { meaning: 'settled', carrier: 'editable input and result output' }], responsive: [{ branch: 'narrow', owner: 'unchanged product page.css' }] });

  const scoreRows = captures.flatMap((capture, index) => scores[index].entries.map(row => [q('form'), index ? 'narrow' : 'wide', q(row.rule), row.score ?? 4, row.verdict]));

  put(path.join(dir, 'response/direction.md'), '# frontend-direction-decision — fixture-form\n' + table('Decision', ['Field', 'Value'], [['Direction id', q('fixture-form')], ['Target', q('/fixture')], ['Intent', q('modify')], ['Change level', q('refine')], ['Owner ceiling', q('surface-only')], ['Classification', q('locked-refine')], ['Presentation delta', q('none')], ['Selection policy', q('automatic')], ['Selected candidate', q('form')]]) + table('Surface class', ['Class', 'Why'], [[q('form'), 'One native input and action produce an editable result.']]) + table('Observed', ['Item', 'Evidence'], [['Existing source and styles', q(INTERFACE_PAGE + '@' + base)]]) + table('UI contract', ['Element', 'Kind', 'Responsibility'], [['input', 'region', 'Input and Transform action'], ['result', 'region', 'Actual API result'], ['Transform', 'action', 'Submit the editable input'], ['Reload', 'action', 'Navigate to the current URL and restore its input/result'], ['loaded', 'state', 'Ready input and result region'], ['pending', 'state', 'Busy disabled button and pending text'], ['error', 'state', 'Observed request failure and available retry'], ['settled', 'state', 'Output and editable input'], ['narrow', 'responsive', 'Single-column bounded page']]) + table('Coverage', ['Concern', 'Enumerated'], [['Actions', 'Transform and Reload with pointer and keyboard routes'], ['Regions', 'input and result'], ['States', 'loaded, pending, error and settled'], ['Responsive', 'narrow native form']]) + table('References', ['Standard', 'Class', 'URL', 'What is borrowed', 'Limitation']) + table('Images', ['Slot', 'Why', 'Claim', 'File']) + table('Falsification', ['Attack', 'Candidate', 'Verdict', 'Evidence'], [['narrow overflow', q('form'), 'holds', 'Actual 390px browser capture keeps every visible element inside its viewport.']]) + table('Candidate limits', ['Candidate', 'Criterion', 'Candidate says']) + table('Scores', ['Candidate', 'Viewport', 'Criterion', 'Score', 'Verdict'], scoreRows) + table('Why not the others', ['Candidate', 'Rejected because']) + table('Selected capture', ['Candidate', 'Source', 'Viewport', 'Screenshot'], [[q('form'), runtime.origin + '/form.html?viewport=wide', 'wide', q('response/artifacts/form.wide.png')]]) + table('Findings answered', ['Finding', 'How']) + table('Printed', ['Artifact', 'Why'], captures.flatMap(capture => [[runtime.origin + '/form.html?viewport=' + (capture.name.endsWith('wide') ? 'wide' : 'narrow'), 'Actual served fixture'], [q(`response/artifacts/form.${capture.name.endsWith('wide') ? 'wide' : 'narrow'}.png`), 'Actual runner capture']])) + table('Fallbacks taken', ['Code', 'Action']));

  put(path.join(dir, 'response/response.md'), '# frontend-source-application — fixture-form\n' + table('Binding', ['Field', 'Value'], [['Target', q('fixture-form')], ['Mode', q('apply')], ['Branch', q(sessionBranch)], ['Base', q(base)], ['Commit', q(head)]]) + table('Projection', ['Path', 'Change', 'Classes', 'Claims', 'Why'], [[q(INTERFACE_PAGE), 'modified', '—', '—', description]]) + table('Rejections', ['Path', 'Value', 'Because']) + table('Fallbacks taken', ['Code', 'Action']));

  put(path.join(dir, 'response/changes.md'), '# changes — interface.generate ' + ref(step) + '\n' + table('Binding', ['Field', 'Value'], [['Operator', q('interface.generate')], ['Step', q(ref(step))], ['Checkout', `${q('@workspaces/fe')} at ${q(base)} → ${q(head)} on ${q(sessionBranch)}`], ['Predecessor', q(route.ref)], ['Preflight', preflight], ['Reflog before', beforeLog], ['Reflog after', afterLog]]) + table('Files', ['Path', 'Change', 'Why', 'Claims'], [[q(INTERFACE_PAGE), 'modified', description, '—']]) + '\n## What the next step must know\n\nAudit the actual served source at wide and narrow viewports; verify the source change recorded above.\n');

  await finishKnowledge(f, dir, frozen, 'response/artifacts/form-wide.measurements.json');

  const response = actual(request, { fields: { 'frontend-direction-decision': 'response/direction.md', 'ui-coverage': 'response/data/coverage.json', candidates: ['response/artifacts/form.html'], 'selected-candidate-capture': 'response/artifacts/form.wide.png', 'frontend-presentation-resolution': 'response/resolution.md', inventory: 'response/data/inventory.json', 'resolved-tree': 'response/artifacts/form.resolved.tsx', 'frontend-source-application': 'response/response.md', changes: 'response/changes.md', writes: 'response/data/writes.json' }, fallbacks: [], commits: [head], next: ['interface.audit'] }, 'done', ['response/changes.md'], 'sol-fresh');

  response.outcome.primary = { kind: 'image', label: 'Actual refined fixture form', ref: 'response/artifacts/form.wide.png' };

  await accept(f, request, response);

  return { step, head, base, request, ref: `${ref(step)}/response/response.md`, changesRef: `${ref(step)}/response/changes.md`, resolutionRef: `${ref(step)}/response/resolution.md`, directionRef: `${ref(step)}/response/direction.md`, captures, scores };

}



export async function acceptAudit(f, runtime, source, route, { step = 12, goal = { doneWhen: 3 }, browserHostRoot, observation = null, coordination = null } = {}) {

  const worktree = f.feWorktree, head = git(worktree, 'rev-parse', 'HEAD'); assert.equal(head, source.head);

  const selected = ['loaded', 'pending', 'error', 'settled'].flatMap(state => [[`wide-light-${state}`, 1440, 900, state], [`narrow-light-${state}`, 390, 844, state]]);

  const scope = { mode: 'primary-surfaces', surfaces: [{ id: 'fixture-form', type: 'page', route: '/fixture', matrixIds: selected.map(([id]) => id) }], deferredStates: [], coverageClaim: 'selected-surfaces' };

  planCells(f, [[step, 'interface.audit']]);

  const contexts = [{ alias: '@workspaces/fe', head }, { alias: '@worktrees/sessions/central-runtime', head: null }, ...UI_BINDINGS.map(alias => ({ alias: alias.replace('<family>', 'starci'), head: null }))];

  const inputs = { 'frontend-source-application': source.ref, 'frontend-presentation-resolution': source.resolutionRef, 'frontend-direction-decision': source.directionRef, route: route.ref, ...(observation ? { 'platform-operation-receipt': observation.ref } : {}) };

  const request = current(f, { operatorId: 'interface.audit', contexts, requirements: { feature: 'fixture', auditScope: { mode: scope.mode, surfaces: scope.surfaces }, matrix: [], readinessProbe: 'route-served', env: 'dev', resume: null }, inputs }, step, { goal, coordination });

  request.environment.workspace = { alias: '@workspaces/fe', worktree, revision: head };

  const dir = branch(f, step); const html = readFileSync(path.join(worktree, INTERFACE_PAGE)); put(path.join(dir, 'request/before.html'), html);

  const frozen = await freezeKnowledge(f, dir, UI_BINDINGS); request.frozenInputs = ['request/knowledge-manifest.json', 'request/family-understanding.json', 'request/before.html'].map(ref => ({ ref, sha256: sha(readFileSync(path.join(dir, ref))) })); await open(f, request);

  put(path.join(dir, 'response/artifacts/form.html'), html);

  const { stepControl } = await f.load('scripts/validate-walk.mjs');

  const captures = [], entries = [];

  for (const [name, width, height, state] of selected) {

    const capture = await captureInterface(f, dir, runtime, { name, width, height, value: state === 'loaded' ? null : 'hello', state, browserHostRoot }); captures.push(capture);

    const elements = capture.measurements.elements, get = tag => elements.find(element => element.tag === tag), main = get('main'), input = get('input'), button = get('button'), heading = get('h1'), output = get('output');

    const dom = read(path.join(dir, `response/artifacts/${name}.dom.json`));

    assert.match(dom.html, /aria-describedby="input-help"/); assert.match(dom.html, /aria-label="Result"/); assert.equal(input.ref, 'textbox "Input"');

    assert.ok(elements.filter(element => element.text && element.bbox.height > 0).every(element => element.contrast === null || element.contrast >= (parseFloat(element.computed.fontSize) >= 24 ? 3 : 4.5)), 'every measured text pair clears its published ratio');

    assert.equal(button.text, 'Transform'); assert.equal(output.text, state === 'loaded' ? 'Ready to transform.' : state === 'pending' ? 'Transforming\u2026' : state === 'error' ? 'Could not transform. Edit the input or try again.' : 'HELLO');

    const results = [], nodes = new Map();

    const measure = (element, rule, property, statement) => { const value = property.split('.').reduce((value, key) => value[key], element); assert.ok(value !== undefined); return add(element, rule, `${statement}: ${value}`, { ref: element.ref, property, value }); };

    function add(element, rule, measured, measurement = null) {

      const key = element.ref; if (!nodes.has(key)) nodes.set(key, { path: key, owner: 'app', claims: [], measured: {} }); const node = nodes.get(key); node.claims.push(rule); node.measured[rule] = measured;

      results.push({ path: key, owner: 'app', rule, measured, ...(measurement ? { measurement } : {}), verdict: 'pass', routeTo: 'none' });

    }

    measure(main, 'GAP-5', 'computed.gap.row', 'Existing single-column region gap in the measured render');

    add(heading, 'HIERARCHY-2', `One h1 at ${heading.computed.fontSize}/${heading.computed.fontWeight}; the one subordinate result heading is ${get('h2').computed.fontSize}.`);

    measure(main, 'RESPONSIVE-1', 'bbox.width', `At viewport ${width}, required input/action/result remain within the measured page width`);

    add(output, 'MOTION-1', `Reduced-motion static frame retains the actual ${state} text: ${output.text}; no animation carries the result.`);

    measure(input, 'A11Y-1', 'bbox.height', 'Actual textbox "Input" exposes its visible label and related input-help description at measured height');

    measure(button, 'COLOR-5', 'contrast', 'Actual composed action text contrast ratio');

    add(output, 'TRUTH-3', state === 'settled' ? `The real loopback request for hello completed before the runner observed ${output.text}; the control remains available for retry.` : state === 'pending' ? 'An actual unanswered fixture request leaves the named action disabled and busy with pending copy, and claims no result.' : state === 'error' ? 'The actual injected 503 response produces failure copy and an enabled retry action.' : 'The initial result says Ready to transform and claims no completed API result.');

    const doc = { matrixId: name, viewport: [width, height], scheme: 'light', state, nodes: [...nodes.values()], driver: { mode: 'playwright', walkRef: capture.files.walk, resultRef: capture.files.result, stepId: 'capture', control: stepControl(capture.walk, 'capture'), measurementsRef: `response/artifacts/${name}.measurements.json` } };

    put(path.join(dir, `response/data/captures/${name}.json`), doc);

    entries.push({ matrixId: name, surfaceClass: 'form', results, taste: tasteFrom(capture.measurements) });

  }

  // The real retained calibration sheets are rendered in this same round. Their measured heading

  // separation supplies an ordered scale; the observations and screenshots remain in the receipt.

  const calibration = [], calibrationEvidence = [];

  for (const anchor of ['low', 'mid', 'high']) {

    const capture = await captureInterface(f, dir, runtime, { name: `calibration-${anchor}`, endpoint: runtime.origin + `/calibration/anchor-${anchor}.html`, browserHostRoot });

    const h1 = capture.measurements.elements.find(element => element.tag === 'h1'), h2 = capture.measurements.elements.find(element => element.tag === 'h2'); assert.ok(h1 && h2);

    const ratio = parseFloat(h1.computed.fontSize) / parseFloat(h2.computed.fontSize), score = ratio >= 1.5 ? 4 : ratio >= 1.1 ? 3 : 2;

    calibration.push({ anchor: `anchor-${anchor}`, lens: 'taste', score }); calibrationEvidence.push({ anchor, title: h1.computed.fontSize, section: h2.computed.fontSize, ratio, screenshotRef: `response/artifacts/calibration-${anchor}.png` });

  }

  put(path.join(dir, 'response/data/calibration-observations.json'), calibrationEvidence);

  const topics = ['presentation', 'composition', 'responsive', 'motion', 'accessibility', 'contrast', 'render-truth', 'taste'];

  const topicRows = topics.map(topic => [q(topic), topic === 'taste' ? 'ship' : 'pass', 'none']);

  const verdicts = { auditScope: scope, calibration, entries }; put(path.join(dir, 'response/data/verdicts.json'), verdicts);

  const observedPackage = await (await fetch(runtime.origin + '/grammar.json')).json(); assert.equal(observedPackage.version, frozen.brief.packageBinding.version);

  const receipt = '# frontend-surface-audit — fixture-form\n' + table('Served surface', ['Field', 'Value'], [['Applied commit', q(source.head)], ['Served branch', q(git(worktree, 'branch', '--show-current'))], ['Served head', q(head)], ['Contains applied commit', 'yes'], ['Browser profile', q(`fresh-playwright-context-per-walk/${f.sessionId}/${step}`)], ['Family version observed', q(observedPackage.version)], ['Family version resolved against', q(frozen.brief.packageBinding.version)]])

    + table('Audit scope', ['Field', 'Value'], [['Mode', scope.mode], ['Selected surfaces', 'fixture-form'], ['Coverage claim', scope.coverageClaim], ['Deferred states', '—']])

    + table('Surface class', ['Class', 'Declared by'], [[q('form'), q('frontend-direction-decision')]])

    + table('Matrix', ['Matrix', 'Viewport', 'Scheme', 'State', 'Screenshot'], selected.map(([id, width, height, state]) => [q(id), `${width}x${height}`, 'light', state, q(`response/artifacts/${id}.png`)]))

    + table('Verdicts by owner', ['Matrix', 'Owner', 'Node', 'Rule', 'Measured', 'Verdict'], entries.flatMap(entry => entry.results.map(result => [q(entry.matrixId), result.owner, q(result.path), q(result.rule), result.measured, result.verdict])))

    + table('Taste', ['Rule', 'Measured', 'Score', 'Verdict'], entries[0].taste.entries.map(row => [q(row.rule), row.measured, row.score ?? '—', row.verdict])) + '\n- Mean: 4.00\n- Verdict: ship\n'

    + table('Calibration', ['Anchor', 'Expected', 'Scored'], calibration.map(item => [q(item.anchor), `taste ${{ 'anchor-low': '1–2', 'anchor-mid': '3–3', 'anchor-high': '4–5' }[item.anchor]}`, item.score]))

    + table('Ranked against', ['Sheet', 'Why']) + table('Verdict', ['Topic', 'Verdict', 'Route'], topicRows)

    + table('Coverage gaps', ['Topic', 'Missing state']) + table('Regressions', ['Matrix', 'Node', 'Rule', 'Measured', 'Routes to']) + table('Grammar gaps', ['Component', 'Rule', 'What the family lacks'])

    + table('Printed', ['Artifact', 'Why'], [[runtime.endpoint, 'Actual loopback served fixture'], [q('response/artifacts/narrow-light-loaded.png'), 'Measured narrow form and taste evidence']]) + table('Fallbacks taken', ['Code', 'Action']);

  put(path.join(dir, 'response/response.md'), receipt);

  await finishKnowledge(f, dir, frozen, 'response/data/verdicts.json', verdicts);

  const response = actual(request, { fields: { 'frontend-surface-audit': 'response/response.md', verdicts: 'response/data/verdicts.json', capture: selected.map(([id]) => `response/data/captures/${id}.json`), screenshot: selected.map(([id]) => `response/artifacts/${id}.png`), 'uat-walk': captures.map(item => item.files.walk), 'walk-result': captures.map(item => item.files.result) }, fallbacks: [], commits: [], next: ['quality.verify'] }, 'done', ['response/response.md']);

  response.outcome.primary = { kind: 'image', label: 'Actual audited narrow form', ref: 'response/artifacts/narrow-light-loaded.png' };

  await accept(f, request, response);

  return { step, head, ref: `${ref(step)}/response/response.md`, request, scope, captures, verdicts, topicRows };

}



export async function acceptInterfaceQuality(f, source, audit, { step = 13, goal = { doneWhen: 4 }, coordination = null, uat = null } = {}) {

  const worktree = f.feWorktree, head = git(worktree, 'rev-parse', 'HEAD'), sessionBranch = git(worktree, 'branch', '--show-current'); assert.equal(head, source.head);

  const planned = [{ gate: 'build', required: true, commandRef: 'node src/modules/fixture/verify.mjs', configRef: 'src/modules/fixture/verify.mjs' }, { gate: 'presentation-sweep', required: true, commandRef: 'node scripts/sweep-presentation.mjs . --write-set response/data/write-set.txt --json', configRef: INTERFACE_PAGE }];

  planCells(f, [[step, 'quality.verify']]);

  const inputs = { 'frontend-source-application': source.ref, changes: source.changesRef, 'frontend-surface-audit': audit.ref, ...(uat ? { 'uat-flow-verification': uat.ref } : {}) };

  const request = current(f, { operatorId: 'quality.verify', contexts: [{ alias: '@workspaces/fe', head }], requirements: { gates: planned, thresholds: [], explicitE2eRequest: false, sonarScope: 'new-code', declaredDebts: [], resume: null }, inputs }, step, { goal, mode: 'inline', coordination }); request.environment.workspace = { alias: '@workspaces/fe', worktree, revision: head };

  const dir = await open(f, request); put(path.join(dir, 'response/data/write-set.txt'), INTERFACE_PAGE + '\n');

  const commands = [[path.join(worktree, 'src/modules/fixture/verify.mjs')], [path.join(f.root, 'scripts/sweep-presentation.mjs'), worktree, '--write-set', path.join(dir, 'response/data/write-set.txt'), '--json']];

  const results = planned.map((gate, index) => {

    const output = execFileSync(process.execPath, commands[index], { cwd: worktree, encoding: 'utf8', windowsHide: true });

    if (gate.gate === 'presentation-sweep') assert.deepEqual(JSON.parse(output).findings, []);

    const evidenceRef = `response/artifacts/${gate.gate}.log`; put(path.join(dir, evidenceRef), output);

    const result = { ...gate, sourceHead: head, sessionBranch, predecessorCommit: source.head, observedAt: new Date().toISOString(), status: 'pass', exitCode: 0, evidenceRef, classification: null, sonarScope: null, debt: null, statement: 'The actual declared command completed at the unchanged source head.' }; put(path.join(dir, `response/data/gates/${gate.gate}.json`), result); return result;

  });

  assert.equal(git(worktree, 'rev-parse', 'HEAD'), head);

  const topics = [...audit.topicRows, [q('experience'), uat ? 'ship' : 'blocked', 'none']];

  put(path.join(dir, 'response/data/audit-scope.json'), audit.scope);

  put(path.join(dir, 'response/response.md'), '# quality-verification — ' + head + '\n' + table('Binding', ['Field', 'Value'], [['Operator', 'quality.verify'], ['Step', ref(step)], ['Checkout', '@workspaces/fe'], ['Head', head], ['Session branch', sessionBranch], ['Predecessors', Object.values(inputs).join(', ')]]) + table('Gate plan', ['Gate', 'Required', 'Command', 'Configuration'], planned.map(gate => [q(gate.gate), 'yes', gate.commandRef, gate.configRef])) + table('Results', ['Gate', 'Status', 'Exit code', 'Evidence', 'Classification', 'Statement'], results.map(gate => [q(gate.gate), gate.status, gate.exitCode, gate.evidenceRef, '—', gate.statement])) + table('Coverage', ['Metric', 'Measured', 'Threshold', 'Verdict']) + table('Sonar', ['Field', 'Value'], [['Scope', 'new-code'], ['Finding', '—']]) + table('Debts', ['Debt', 'Gate', 'Approval', 'Owner', 'Expires', 'Statement']) + table('Findings', ['Code', 'Gate', 'Statement'], [[q('PREDECESSOR_CONSUMED'), '—', 'The exact accepted source and audit receipts were consumed.']]) + table('Gate verdict', ['Field', 'Value'], [['Verdict', q('pass')]]) + table('Verdict', ['Topic', 'Verdict', 'Route'], topics) + `\nVerdict: ${uat ? 'ship' : 'blocked'}\n` + table('Audit scope', ['Field', 'Value'], [['Mode', audit.scope.mode], ['Coverage claim', audit.scope.coverageClaim], ['Deferred states', '—']]));

  await accept(f, request, actual(request, { fields: { 'quality-verification': 'response/response.md', 'gate-result': planned.map(gate => `response/data/gates/${gate.gate}.json`), 'audit-scope': 'response/data/audit-scope.json' }, fallbacks: [], commits: [], next: uat ? ['workflow.verify'] : ['uat.verify'] }, 'done', ['response/response.md']));

  return { step, head, ref: `${ref(step)}/response/response.md`, request, results };

}
