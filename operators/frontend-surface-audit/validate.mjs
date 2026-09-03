// frontend.surface.audit's own law over one branch, on top of the shared step check: every matrix entry in
// the verdicts has both a capture and a screenshot; every judged node was measured in that entry's
// capture and judged on a rule it actually claimed; a Grammar-owned node never routes a failure into
// the resolve loop and an application-owned failure always does; the surface class is the one the
// direction decision's coverage declared, never one chosen here; and the receipt reads what the
// verdicts carry.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder, userRouted, choiceHandoffErrors } from '../../scripts/validate-response.mjs';
import { loadErrorsRegistry } from '../../scripts/errors-registry.mjs';
import { sessionRootOf, missingStack } from '../../scripts/validate-request.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const list = (v) => (Array.isArray(v) ? v : empty(v) ? [] : [v]);

// knowledge/ui/proof/taste.md: TASTE-1..TASTE-12 are the scored criteria and TASTE-13 is the
// arithmetic over them. `ship` needs no failure on the five criteria a reader registers before
// reading a word, and a mean of at least 4; anything else is `fix-first`.
export const TASTE_RULES = Array.from({ length: 12 }, (_, i) => `TASTE-${i + 1}`);
// Each proof topic closes itself. A rule identifier belongs to exactly one topic, and the topic's own
// closing rule turns its results into one verdict; nothing here recomputes a threshold.
export const TOPIC_OF_PREFIX = {
  GAP: 'presentation', PADDING: 'presentation', MARGIN: 'presentation', MEASURE: 'presentation',
  RADIUS: 'presentation', SURFACE: 'presentation', TONE: 'presentation', FONT: 'presentation',
  BOUNDARY: 'presentation', OVERFLOW: 'presentation', FLOW: 'presentation',
  HIERARCHY: 'composition', CTA: 'composition', ACCENT: 'composition', ACTION: 'composition',
  LAYOUT: 'composition', STATE: 'composition', FEEDBACK: 'composition', COVERAGE: 'composition',
  RESPONSIVE: 'responsive',
  MOTION: 'motion',
  A11Y: 'accessibility', FOCUS: 'accessibility',
  COLOR: 'contrast',
  TRUTH: 'render-truth',
  TASTE: 'taste',
};
export const AUDIT_TOPICS = ['presentation', 'composition', 'responsive', 'motion', 'accessibility', 'contrast', 'render-truth', 'taste'];
const topicOf = (rule) => TOPIC_OF_PREFIX[String(rule).replace(/-\d+$/, '')] ?? null;
const TASTE_GATES = new Set(['TASTE-1', 'TASTE-2', 'TASTE-5', 'TASTE-8', 'TASTE-12']);
export function tasteVerdict(rows) {
  const mean = rows.reduce((sum, r) => sum + Number(r.score), 0) / rows.length;
  const gated = rows.some((r) => r.verdict === 'fail' && TASTE_GATES.has(r.rule));
  return { mean, verdict: !gated && mean >= 4 ? 'ship' : 'fix-first' };
}
const sectionText = (text, heading) => {
  const lines = text.split(/\r?\n/);
  const from = lines.findIndex((l) => l.trimEnd() === heading);
  if (from === -1) return '';
  const rest = lines.slice(from + 1);
  const next = rest.findIndex((l) => l.startsWith('## '));
  return (next === -1 ? rest : rest.slice(0, next)).join('\n');
};

export async function validateAuditStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'frontend.surface.audit') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');

  // An env names a stack of this installation; the vocabulary is the folder, not a list kept here.
  const missing = missingStack(root, requirements.env);
  if (missing) errors.push(`request.json: env ${requirements.env} names ${missing}, which this installation does not have`);

  let verdicts = null;
  if (present.has('verdicts') && has('response/data/verdicts.json')) {
    try { verdicts = JSON.parse(await read('response/data/verdicts.json')); } catch { verdicts = null; }
  }
  if (!verdicts) {
    if (response.status === 'done') errors.push('response/data/verdicts.json: a done branch needs the verdicts');
    return { errors };
  }
  const at = 'response/data/verdicts.json';

  const captureRefs = new Set(list(response.fields?.capture));
  const shotRefs = new Set(list(response.fields?.screenshot));
  const narrowed = list(requirements.matrix);

  const captures = new Map();
  for (const ref of captureRefs) {
    if (!has(ref)) continue;
    let doc = null;
    try { doc = JSON.parse(await read(ref)); } catch { doc = null; }
    if (doc) captures.set(doc.matrixId, { doc, ref });
  }

  const ids = new Set();
  for (const entry of verdicts.entries) {
    if (ids.has(entry.matrixId)) errors.push(`${at}: matrix entry ${entry.matrixId} is judged twice`);
    ids.add(entry.matrixId);
    const capture = captures.get(entry.matrixId);
    if (!capture) { errors.push(`${at}: matrix entry ${entry.matrixId} has verdicts and no capture (EVIDENCE_MISSING)`); continue; }
    if (capture.ref !== `response/data/captures/${entry.matrixId}.json`) errors.push(`${capture.ref}: the capture of ${entry.matrixId} is not the file its id names`);
    if (!shotRefs.has(`response/artifacts/${entry.matrixId}.png`)) errors.push(`${at}: matrix entry ${entry.matrixId} has verdicts and no screenshot (EVIDENCE_MISSING)`);
    if (narrowed.length && !narrowed.some((m) => (typeof m === 'string' ? m : m.matrixId) === entry.matrixId)) {
      errors.push(`${at}: matrix entry ${entry.matrixId} was judged but the request narrowed the matrix without it`);
    }

    const nodes = new Map(capture.doc.nodes.map((n) => [n.path, n]));
    for (const result of entry.results) {
      const node = nodes.get(result.path);
      if (!node) { errors.push(`${at}: ${result.path} is judged under ${entry.matrixId} and was never measured there`); continue; }
      if (node.owner !== result.owner) errors.push(`${at}: ${result.path} is ${result.owner} here and ${node.owner} in the capture`);
      if (!node.claims.includes(result.rule)) errors.push(`${at}: ${result.path} is judged on ${result.rule}, which that node never claimed`);
      const measured = Object.values(node.measured);
      if (!measured.includes(result.measured)) errors.push(`${at}: ${result.path} is judged against ${result.measured}, which the capture did not measure`);
      if (result.verdict === 'pass' && result.routeTo !== 'none') errors.push(`${at}: ${result.path} passes and still routes to ${result.routeTo}`);
      if (result.verdict === 'fail') {
        if (result.owner === 'grammar' && result.routeTo === 'resolve') errors.push(`${at}: ${result.path} is a Grammar component's own render; a failure there is a grammar-gap, never a resolve loop`);
        if (result.owner === 'app' && result.routeTo !== 'resolve') errors.push(`${at}: ${result.path} is application-owned and its failure must route to resolve`);
        if (result.routeTo === 'none') errors.push(`${at}: ${result.path} fails and routes nowhere`);
      }
    }
    // Every claim a node carries is judged, or the claim is unaudited.
    for (const node of capture.doc.nodes) {
      for (const claim of node.claims) {
        if (!entry.results.some((r) => r.path === node.path && r.rule === claim)) errors.push(`${at}: ${node.path} claims ${claim} under ${entry.matrixId} and no verdict judges it`);
      }
    }
  }
  for (const [matrixId] of captures) if (!ids.has(matrixId)) errors.push(`${at}: ${matrixId} was captured and never judged`);

  // The taste lens. A done audit publishes it for every entry it judged: all twelve scored criteria,
  // each failure routed to direction because no value swap repairs a composition (TASTE-13 Case 4),
  // and the entry's own mean and verdict computed by TASTE-13 Case 2 rather than asserted.
  const rolled = new Map(); // rule -> { score, verdict, measured[] }
  for (const entry of verdicts.entries) {
    const lens = entry.taste;
    if (!lens) {
      if (response.status === 'done') errors.push(`${at}: ${entry.matrixId} carries no taste block; a done audit publishes both lenses, canon and taste`);
      continue;
    }
    const seen = new Map();
    for (const row of lens.entries) {
      if (seen.has(row.rule)) errors.push(`${at}: ${entry.matrixId} scores ${row.rule} twice`);
      seen.set(row.rule, row);
      if (!TASTE_RULES.includes(row.rule)) errors.push(`${at}: ${entry.matrixId} scores ${row.rule}, which is not one of the twelve scored criteria (TASTE-13 is the arithmetic and is not itself scored)`);
      if (row.verdict === 'fail' && row.routeTo !== 'direction') errors.push(`${at}: ${entry.matrixId} fails ${row.rule} and routes to ${row.routeTo}; a taste failure routes to direction, never to resolve`);
      if (row.verdict === 'pass' && row.routeTo !== 'none') errors.push(`${at}: ${entry.matrixId} passes ${row.rule} and still routes to ${row.routeTo}`);
    }
    for (const rule of TASTE_RULES) if (!seen.has(rule)) errors.push(`${at}: ${entry.matrixId} leaves ${rule} unscored; the lens is incomplete until every criterion carries a measurement`);
    const complete = TASTE_RULES.every((r) => seen.has(r)) && seen.size === TASTE_RULES.length;
    if (complete) {
      const rows = TASTE_RULES.map((r) => seen.get(r));
      const computed = tasteVerdict(rows);
      if (Math.abs(Number(lens.mean) - computed.mean) > 0.005) errors.push(`${at}: ${entry.matrixId} records a mean of ${lens.mean}; the twelve scores average ${computed.mean.toFixed(2)}`);
      if (lens.verdict !== computed.verdict) errors.push(`${at}: ${entry.matrixId} records ${lens.verdict}; TASTE-13 makes it ${computed.verdict}`);
      for (const row of rows) {
        const prior = rolled.get(row.rule);
        if (!prior) rolled.set(row.rule, { score: row.score, verdict: row.verdict, measured: [row.measured] });
        else rolled.set(row.rule, { score: Math.min(prior.score, row.score), verdict: prior.verdict === 'fail' || row.verdict === 'fail' ? 'fail' : 'pass', measured: [...prior.measured, row.measured] });
      }
    }
  }
  // The surface is only as good as its worst captured viewport, so the receipt publishes the lens
  // rolled up across the entries: the lowest score and the failing verdict win.
  const lensRows = TASTE_RULES.filter((r) => rolled.has(r)).map((r) => ({ rule: r, ...rolled.get(r) }));
  const surface = lensRows.length === TASTE_RULES.length ? tasteVerdict(lensRows) : null;
  // A blocked branch routes by its stop, not by next; the hand-offs below are read on a done one.
  if (surface && response.status === 'done') {
    const next = response.next ?? [];
    if (surface.verdict === 'fix-first') {
      if (!next.includes('frontend.direction.decide')) errors.push('response/response.json: the taste lens is fix-first, so next names frontend.direction.decide');
      if (next.includes('quality.verify')) errors.push('response/response.json: the taste lens is fix-first, so the checkout\'s own gates do not run yet; quality.verify follows a ship');
    }
  }

  // One surface, one class: every entry carries the class the coverage declared, and they agree.
  const classes = new Set(verdicts.entries.map((e) => e.surfaceClass));
  if (classes.size > 1) errors.push(`${at}: the entries declare ${[...classes].join(' and ')}; one surface has one class, and every banded rule reads its threshold from it`);

  // The class is not this operator's to choose: it is read from the direction decision this audit
  // was given, whose coverage declared it (COVERAGE-1 Case 7). A decision that carries none — an
  // older one, written before the coverage declared a class — is SURFACE_CLASS_MISSING, and the
  // audit stops rather than banding a surface by taste.
  const decisionRef = base.request?.inputs?.['frontend-direction-decision'];
  const sessionRoot = sessionRootOf(branchDir);
  if (decisionRef && sessionRoot && response.status === 'done') {
    const coverageFile = path.join(sessionRoot, path.dirname(String(decisionRef)), 'data', 'coverage.json');
    let declared = null;
    if (existsSync(coverageFile)) {
      try { declared = JSON.parse(await readFile(coverageFile, 'utf8')).surfaceClass ?? null; } catch { declared = null; }
    }
    if (empty(declared)) errors.push(`${at}: the frontend-direction-decision this audit reads declares no surface class, so every banded rule is left without a threshold (SURFACE_CLASS_MISSING)`);
    else for (const cls of classes) if (cls !== declared) errors.push(`${at}: the entries carry ${cls} and the direction's coverage declares ${declared}; the class is read from the decision, never chosen here`);
  }

  // Each topic's row is the verdict its own closing rule produced over the results of that topic.
  const topicRows = new Map();
  for (const entry of verdicts.entries) {
    for (const result of entry.results) {
      const topic = topicOf(result.rule);
      if (!topic) { errors.push(`${at}: ${result.rule} belongs to no published proof topic`); continue; }
      const prior = topicRows.get(topic) ?? { verdict: 'pass', routeTo: 'none' };
      if (result.verdict === 'fail') topicRows.set(topic, { verdict: 'fail', routeTo: prior.verdict === 'fail' ? prior.routeTo : result.routeTo });
      else if (!topicRows.has(topic)) topicRows.set(topic, prior);
    }
  }
  if (surface) topicRows.set('taste', { verdict: surface.verdict, routeTo: surface.verdict === 'ship' ? 'none' : 'direction' });
  const topicVerdict = (topic) => topicRows.get(topic) ?? { verdict: 'blocked', routeTo: 'none' };

  const failing = verdicts.entries.flatMap((e) => e.results.filter((r) => r.verdict === 'fail'));
  if (response.status === 'done' && failing.some((r) => r.routeTo === 'resolve') && !(response.next ?? []).includes('frontend.presentation.resolve')) {
    errors.push('response/response.json: a claim fails on an application-owned node, so next names frontend.presentation.resolve');
  }

  // When the verdict goes to a person while a composition or taste topic is still open — the same
  // wall reached again, so the audit reports it rather than advising — the hand-off is the
  // direction's rendered candidates, printed at every viewport of the matrix, never two sentences
  // the person is asked to choose between (@tools/print, decision-points).
  const openForPerson = ['composition', 'taste'].filter((topic) => ['fail', 'fix-first'].includes(topicVerdict(topic).verdict));
  const toPerson = openForPerson.length > 0 && await userRouted(root, await loadErrorsRegistry(root), 'frontend.surface.audit', response);
  if (toPerson) {
    if (!(present.has('frontend-surface-audit') && has('response/response.md'))) {
      errors.push(`response/response.md: the ${openForPerson.join(' and ')} verdict is handed to the person with no receipt, so nothing was printed; a design decision reaches a person as rendered candidates under ## Printed`);
    } else {
      const printedRows = tableUnder(await read('response/response.md'), '## Printed') ?? [];
      const viewports = new Set([...captures.values()].map(({ doc }) => doc.viewport.join('x')));
      errors.push(...choiceHandoffErrors({ at: 'response/response.md', printedRows, viewports: Math.max(1, viewports.size), reason: response.reason }));
    }
  }

  if (present.has('frontend-surface-audit') && has('response/response.md')) {
    const text = await read('response/response.md');
    const rel = 'response/response.md';
    // One integration branch carries several sessions' work, so the audit states which head it
    // measured and how its own commit is inside it. Ancestry a reader cannot see is a claim, and a
    // browser profile nobody recorded is how one session's sign-in becomes another session's evidence.
    const servedRows = Object.fromEntries((tableUnder(text, '## Served surface') ?? []).map(([k, v]) => [k, v]));
    const bare = (v) => String(v ?? '').replace(/^`|`$/g, '').trim();
    for (const field of ['Applied commit', 'Served head']) {
      if (!/^[0-9a-f]{40}$/.test(bare(servedRows[field]))) errors.push(`${rel}: Served surface must name the ${field.toLowerCase()} as a full commit, and it names ${servedRows[field] ?? '—'}`);
    }
    if (bare(servedRows['Contains applied commit']) !== 'yes') errors.push(`${rel}: the served head must contain the applied commit; a surface that does not is SOURCE_DRIFT with nothing captured`);
    if (empty(bare(servedRows['Browser profile']))) errors.push(`${rel}: Served surface names the browser profile this session drove, so a sign-in state from another session is visible rather than suspected`);
    // Clean source ancestry proves nothing about the family a served head renders: main can carry a
    // dependency the session never resolved against forward on its own, and a presentation verdict
    // that flips over that has nothing to do with the source this session wrote. Both versions are
    // always named here, and when they differ, named again wherever a verdict's own measured evidence
    // could have been the one the drift, rather than the source, actually flipped.
    const FAMILY_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.]+)?$/;
    for (const field of ['Family version observed', 'Family version resolved against']) {
      if (!FAMILY_VERSION.test(bare(servedRows[field]))) errors.push(`${rel}: Served surface must name the ${field.toLowerCase()} as a family version, and it names ${servedRows[field] ?? '—'}`);
    }
    const familyObserved = bare(servedRows['Family version observed']);
    const familyResolved = bare(servedRows['Family version resolved against']);
    if (FAMILY_VERSION.test(familyObserved) && FAMILY_VERSION.test(familyResolved) && familyObserved !== familyResolved) {
      const namesBoth = (measured) => String(measured ?? '').includes(familyObserved) && String(measured ?? '').includes(familyResolved);
      const ownerMeasured = (tableUnder(text, '## Verdicts by owner') ?? []).map((row) => row[4]);
      const regressionMeasured = (tableUnder(text, '## Regressions') ?? []).map((row) => row[3]);
      if (![...ownerMeasured, ...regressionMeasured].some(namesBoth)) errors.push(`${rel}: the served head renders family ${familyObserved} and this delivery resolved against ${familyResolved}; a version drift the receipt does not name in a verdict's own measured evidence is a presentation flip nobody can trace to its real cause`);
    }
    const matrixRows = tableUnder(text, '## Matrix') ?? [];
    if (matrixRows.length !== verdicts.entries.length) errors.push(`${rel}: Matrix has ${matrixRows.length} rows, the verdicts carry ${verdicts.entries.length} entries`);
    for (const [id, viewport, scheme, state] of matrixRows) {
      const capture = captures.get(id);
      if (!capture) { errors.push(`${rel}: Matrix names ${id}, which has no capture`); continue; }
      if (`${capture.doc.viewport[0]}x${capture.doc.viewport[1]}` !== viewport) errors.push(`${rel}: ${id} is ${viewport} here and ${capture.doc.viewport.join('x')} in the capture`);
      if (capture.doc.scheme !== scheme || capture.doc.state !== state) errors.push(`${rel}: ${id} scheme or state differs from the capture`);
    }
    const rows = tableUnder(text, '## Verdicts by owner') ?? [];
    const all = verdicts.entries.flatMap((e) => e.results);
    if (rows.length !== all.length) errors.push(`${rel}: Verdicts by owner has ${rows.length} rows, the verdicts carry ${all.length} results`);
    for (const [matrixId, owner, node, rule, , verdict] of rows) {
      const entry = verdicts.entries.find((e) => e.matrixId === matrixId);
      const result = entry?.results.find((r) => r.path === node && r.rule === rule);
      if (!result) { errors.push(`${rel}: Verdicts by owner names ${rule} on ${node} under ${matrixId}, which the verdicts do not carry`); continue; }
      if (result.owner !== owner) errors.push(`${rel}: ${node} is ${owner} here and ${result.owner} in the verdicts`);
      if (result.verdict !== verdict) errors.push(`${rel}: ${rule} on ${node} is ${verdict} here and ${result.verdict} in the verdicts`);
    }
    // ## Taste reads what the taste blocks carry, rolled up across the entries, and closes with the
    // mean and the verdict TASTE-13 computes from those very rows.
    if (surface) {
      const tasteRows = tableUnder(text, '## Taste') ?? [];
      if (tasteRows.length !== TASTE_RULES.length) errors.push(`${rel}: Taste has ${tasteRows.length} rows, the lens scores ${TASTE_RULES.length} criteria`);
      for (const [rule, measured, score, verdict] of tasteRows) {
        const row = rolled.get(rule);
        if (!row) { errors.push(`${rel}: Taste names ${rule}, which the verdicts do not score`); continue; }
        if (Number(score) !== row.score) errors.push(`${rel}: ${rule} scores ${score} here and ${row.score} in the verdicts`);
        if (verdict !== row.verdict) errors.push(`${rel}: ${rule} is ${verdict} here and ${row.verdict} in the verdicts`);
        if (!row.measured.includes(measured)) errors.push(`${rel}: ${rule} is scored on "${measured}", which no capture measured`);
      }
      const section = sectionText(text, '## Taste');
      const mean = /^- Mean: (\d+(?:\.\d+)?)$/m.exec(section);
      const verdictLine = /^- Verdict: (ship|fix-first)$/m.exec(section);
      if (!mean) errors.push(`${rel}: Taste closes with no "- Mean: <number>" line`);
      else if (Math.abs(Number(mean[1]) - surface.mean) > 0.005) errors.push(`${rel}: Taste records a mean of ${mean[1]}; the twelve rows average ${surface.mean.toFixed(2)}`);
      if (!verdictLine) errors.push(`${rel}: Taste closes with no "- Verdict: ship|fix-first" line`);
      else if (verdictLine[1] !== surface.verdict) errors.push(`${rel}: Taste records ${verdictLine[1]}; TASTE-13 makes the surface ${surface.verdict}`);
    }

    // ## Surface class carries the one the coverage declared, and ## Verdict carries one row per
    // topic, each copied from the topic that computed it rather than recomputed here.
    const classRows = tableUnder(text, '## Surface class') ?? [];
    const declared = classRows[0]?.[0]?.replaceAll('`', '');
    if (declared && classes.size === 1 && declared !== [...classes][0]) errors.push(`${rel}: Surface class reads ${declared} and the verdicts carry ${[...classes][0]}`);
    const verdictRows = tableUnder(text, '## Verdict') ?? [];
    if (verdictRows.length !== AUDIT_TOPICS.length) errors.push(`${rel}: Verdict has ${verdictRows.length} rows, this operator closes ${AUDIT_TOPICS.length} topics`);
    for (const [topicCell, verdict, route] of verdictRows) {
      const topic = topicCell.replaceAll('`', '');
      if (!AUDIT_TOPICS.includes(topic)) { errors.push(`${rel}: Verdict names ${topic}, which is not a topic this operator closes`); continue; }
      const computed = topicVerdict(topic);
      if (verdict !== computed.verdict) errors.push(`${rel}: Verdict records ${verdict} for ${topic}; its own rule made it ${computed.verdict}`);
      if (route !== computed.routeTo) errors.push(`${rel}: Verdict routes ${topic} to ${route}; its own rule routes it to ${computed.routeTo}`);
    }

    // Serving is not telling: the sheet reaches the person at the moment the verdict is recorded, and
    // ## Printed is where the receipt says what was handed over. An audit that filed its sheet and
    // said nothing leaves a verdict nobody read.
    const printed = (tableUnder(text, '## Printed') ?? []).map(([artifact]) => artifact);
    if (response.status === 'done' && !printed.some((p) => /host\.json$/.test(p) || /^https?:\/\//.test(p))) {
      errors.push(`${rel}: ## Printed names no served sheet; the audit hands the person the sheet's URL when the verdict is recorded and records here what it handed over`);
    }

    const regressions = tableUnder(text, '## Regressions') ?? [];
    if (regressions.length !== failing.length) errors.push(`${rel}: Regressions has ${regressions.length} rows, the verdicts carry ${failing.length} failures`);
    for (const [matrixId, node, rule, , routeTo] of regressions) {
      const entry = verdicts.entries.find((e) => e.matrixId === matrixId);
      const result = entry?.results.find((r) => r.path === node && r.rule === rule && r.verdict === 'fail');
      if (!result) { errors.push(`${rel}: Regressions names ${rule} on ${node}, which no verdict fails`); continue; }
      if (result.routeTo !== routeTo) errors.push(`${rel}: ${rule} on ${node} routes to ${routeTo} here and ${result.routeTo} in the verdicts`);
    }
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateAuditStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid frontend.surface.audit branch\n');
}
