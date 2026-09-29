// draw-critic.mjs — the independent critic of a draw-loop round (owner ruling 2026-09-27: draw -> shoot -> evaluate ->
// fix; the beauty and hierarchy judgement comes from a critic that did NOT draw it). The critic is a fresh session with
// no drawing context: `codex exec` (modules/models/runtimes.yaml allocation.drawLoop.critic: model, effort, timeoutMs)
// run in a clean temp directory that holds only the round's PNGs, its HTML and the rubric, the PNGs attached as
// images. It answers one JSON verdict (starci/draw-critique@1): every rubric check pass/fail with evidence and fix,
// a 1-10 beauty score with its anchor. The model, the exact prompt, the command and the verdict are recorded in the
// round's critique.json; the temp directory is removed.
//
// The critic is a DIFFERENT model from the drawer (owner ruling 2026-09-27 draw-devin-brand-claude: Devin draws,
// Codex critiques). criticFor picks it: allocation.drawLoop.critic, unless the drawer (draw-loop.mjs round --drawer,
// else the op launch's STARCI_OP_PROVIDER) is that critic's provider - Codex drawing as the draw order's fallback -
// then allocation.drawLoop.criticWhenDrawer.<drawer> (a `claude -p` session, read-only tools); with none configured
// the round has no independent critic (an error, no beauty), never the drawer judging itself.
//
// The rubric is the product's: `.starciwork/brand/index.yaml` brand.direction.rubric.checks (brand.decide's direction
// mode - lane ui-discipline-brand), with the archetype block of the record's ui.archetype when the direction has one.
// A product whose brand record carries no rubric yet is judged by DEFAULT_RUBRIC below (the r5 bake-off rubric,
// brand-neutral, in the work/brand@1 rubric shape; knowledge/ui/examples/brand-direction.nivo.yaml seeds a product's
// own).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';
import {sha256} from '../../engine/digest.mjs';
import { safeRemoveTree } from '../lib/safe-remove.mjs';
import { slash } from '../lib/path-key.mjs';
import { ownerRubricChecks } from './draw-feedback.mjs';

export const CRITIQUE_SCHEMA = 'starci/draw-critique@1';
export const RUBRIC_SCHEMA = 'starci/draw-rubric@1';

/** The built-in rubric: the r5 bake-off critic sheet (D:/starci-tmp/draw-bakeoff/r5/inputs/08-RUBRIC.md), brand-neutral. */
export const DEFAULT_RUBRIC = Object.freeze({
  schema: RUBRIC_SCHEMA,
  source: 'built-in default (scripts/work/draw-critic.mjs)',
  checks: [
    { id: 'H1', group: 'hierarchy', check: 'One focal point', gate: true, test: 'Squint at the desktop PNG for 3s: exactly one heaviest element, and it is the page title or the surface\'s named job (never art, never a KPI number on a non-dashboard page).' },
    { id: 'H2', group: 'hierarchy', check: 'Type ladder', test: 'Page title visibly larger than every section heading, which is larger than card titles; no weight above 600; at most 3 sizes inside any card.' },
    { id: 'H3', group: 'hierarchy', check: 'Region order', test: 'Top to bottom: header, summary, attention/result notices, collection; the same order in the mobile PNG.' },
    { id: 'H4', group: 'hierarchy', check: 'Rhythm and edges', test: 'Gaps read 24 (regions) > 16 (peer cards) > 12 (rows) > 8/4; left edges in each region align; no off-scale gaps.' },
    { id: 'B1', group: 'brand', check: 'Palette closed', test: 'Every colour is a brand/grammar token; no gradient beyond the brand band, no stray hue.' },
    { id: 'B2', group: 'brand', check: 'Cards and shape', test: 'Cards are the grammar surface (no border, soft shadow, grammar radius); no card in a card, no whole-card tint; buttons and badges are pills.' },
    { id: 'B3', group: 'brand', check: 'Icon language', test: 'One icon set, consistent stroke; identity tiles neutral; only a notice indicator carries a tone.' },
    { id: 'B4', group: 'brand', check: 'Art discipline', test: 'Brand art or mascot only where the brand allows it, once, never the heaviest element, never on error/loading/form; artwork sits in a declared asset slot (a placeholder until interface.asset fills it), never a reused file.' },
    { id: 'A1', gate: true, group: 'action', check: 'One primary fill', test: 'Exactly one filled primary control per view in each PNG.' },
    { id: 'A2', group: 'action', check: 'Every card acts', test: 'Every entity card ends in an action band with a labelled button; each notice carries its fix in its actions slot.' },
    { id: 'A3', group: 'action', check: 'Action anatomy', test: 'Buttons are grammar-height pills with a text label; command icons at start, destination arrows at end; no visible destructive button.' },
    { id: 'T1', group: 'tone', check: 'Toned outcomes', test: 'Every status badge has the grammar Badge dot (isDot, a 6px circle in the tone colour, no halo) and a word on its tone\'s soft fill; attention differs visibly from a neutral row.' },
    { id: 'T2', gate: true, group: 'tone', check: 'Neutral facts stay neutral', test: 'Version, region, owner, counts and capability names carry no badge, tick or colour; nothing repeats what the title says.' },
    { id: 'T3', group: 'tone', check: 'Ratios are meters', test: 'A ratio (n/m) is one Meter with label and value on the HeroUI h-2 (8px) track spanning the full width of its band - never a short stub; a segmented Meter (grammar Meter segments) is the h-1 (4px) track of that full width in equal segments with small gaps.' },
    { id: 'C1', gate: true, group: 'copy', check: 'No internal ids', test: 'No slug, id, route, enum or developer term visible.' },
    { id: 'C2', group: 'copy', check: 'Facts carry units and times', test: 'Every number has its noun or unit; every list or card shows a source time.' },
    { id: 'C3', group: 'copy', check: 'One name per thing', test: 'Each object keeps one name across the page; buttons are verbs; no "!" or emoji.' },
    { id: 'M1', group: 'mobile', check: 'Reflow without loss', test: 'No horizontal scroll, nothing clipped; summary reflows (e.g. 2x2); cards 1-up; 16px page inset.' },
    { id: 'M2', gate: true, group: 'mobile', check: 'Primary in reach', test: 'The one primary sits in the lower half of the mobile capture or a bottom bar that covers no content; card actions at least 40px tall.' },
    { id: 'K1', group: 'knowledge', check: 'Collection and surfaces', test: 'No card wraps the list of entity cards; bands inside a card are split by edge-to-edge hairlines.' },
    { id: 'K2', group: 'knowledge', check: 'No empty void', test: 'No area over 64px tall without content or function; no half-empty grid row.' },
    { id: 'G1', group: 'grammar', check: 'DNA only', test: 'Every visible element maps to a Grammar DNA component (data-grammar-component) or a proposal (data-grammar-proposal).' },
    { id: 'G2', group: 'grammar', check: 'Notices are Alert', test: 'Attention and result notices are the real HeroUI Alert: a white surface row with a soft shadow, a small indicator glyph left of the title, glyph and title in the tone colour, a muted description, the grammar Button as its action in the variant of its tone (accent primary, danger danger, else the secondary Button - a warning or success Alert keeps secondary). Never a tone-filled background, an IconTile indicator, a hand-built card or a tinted box.' },
    { id: 'G3', group: 'grammar', check: 'Ratios are Meter', test: 'Capability ratios are one Meter, never Progress, never a hand-made bar.' },
  ],
  gateCap: 5,
  beautyAnchors: [
    { score: '1-2', anchor: 'A text dump: no icons, no actions, grey badges, a grey box that reads like an error, ids on screen.' },
    { score: '3-4', anchor: 'Correct tokens but plain: no focal point, several primary fills or none, untoned status, attention buried below the list.' },
    { score: '5-6', anchor: 'Attention first and toned badges, but soft actions, slugs visible, uneven summary weights.' },
    { score: '7', anchor: 'Clear summary, notices, cards; good mobile; one or two anti-patterns (black meter, accent per card, ticks on facts, tinted cards).' },
    { score: '8', anchor: 'All checks pass; enterprise-console class; minor rhythm or copy nits only.' },
    { score: '9', anchor: 'Passes everything and feels designed: one accent moment, calm neutrals, numbers that read at a glance, notices that invite the fix, a native-feeling mobile.' },
    { score: '10', anchor: '9, plus a reviewer who knows neither product sorts it beside Linear/Stripe/Vercel consoles without hesitation.' },
  ],
});

/**
 * The rubric a round is judged by: the product brand record's brand.direction.rubric (work/brand@1: checks[{id, group,
 * test, cites, gate?}], gateCap, beautyAnchors - brand.decide direction mode), with the archetype block of
 * `archetype`, else DEFAULT_RUBRIC. {rubric, source, archetype|null}.
 */
export function rubricFor({ workRoot = null, archetype = null, record = null, shape = null } = {}) {
  let doc = null;
  const file = workRoot ? path.join(workRoot, 'brand', 'index.yaml') : null;
  try { doc = file ? parseYaml(fs.readFileSync(file, 'utf8')) : null; } catch { doc = null; }
  const direction = doc?.brand?.direction ?? doc?.direction ?? null;
  const checks = direction?.rubric?.checks;
  const block = archetype ? direction?.archetypes?.[archetype] ?? null : null;
  // The owner's own gate checks (draw-feedback.mjs): every open note on this shape's earlier drawing, and every
  // product ruling learned from draw feedback (brand.direction.learned). A redraw that fails one leaves the note
  // unaddressed (DRAW_FEEDBACK_UNADDRESSED).
  const owner = ownerRubricChecks({ record, workRoot, shape });
  const withOwner = (r) => (owner.length ? { ...r, checks: [...r.checks.filter((c) => !owner.some((o) => o.id === c.id)), ...owner], gateCap: r.gateCap ?? DEFAULT_RUBRIC.gateCap, ownerChecks: owner.map((o) => o.id) } : r);
  const withArchetype = (r) => withOwner(block ? { ...r, archetype: { name: archetype, ...block } } : r);
  if (Array.isArray(checks) && checks.length) {
    return { rubric: withArchetype({ schema: RUBRIC_SCHEMA, source: `${slash(file)} brand.direction.rubric (rev ${direction.rev ?? '?'})`, checks,
      gateCap: direction.rubric.gateCap ?? null, beautyAnchors: direction.rubric.beautyAnchors ?? DEFAULT_RUBRIC.beautyAnchors }), source: 'brand.direction.rubric', archetype: block ? archetype : null, ownerChecks: owner.map((o) => o.id) };
  }
  return { rubric: withArchetype(structuredClone(DEFAULT_RUBRIC)), source: 'default', archetype: block ? archetype : null, ownerChecks: owner.map((o) => o.id) };
}

/** The gate check ids of a rubric: every check marked gate (and a legacy rubric-level gate list). */
export const gateIdsOf = (rubric) => [...new Set([...(rubric.checks ?? []).filter((c) => c?.gate === true).map((c) => String(c.id)), ...(Array.isArray(rubric.gate) ? rubric.gate.map(String) : [])])];

/** The critic's instructions. It never sees the drawing brief, the worker's notes or any earlier round. */
export function criticPrompt({ images, html = 'screen.html', rubricFile = 'rubric.yaml' }) {
  return [
    'You are an independent senior product-design critic. You did NOT draw this screen and you have no other context.',
    `The attached images (image files in this directory) are the renders of ONE product surface: ${images.map((i) => `${i.file} (${i.label})`).join(', ')}. The HTML source is ${html} in this directory; the rubric is ${rubricFile}.`,
    'Judge strictly and only what you can observe in the images and the HTML. Do not edit, create or run anything except reading these files.',
    `For EVERY check in ${rubricFile}: pass true/false, one line of evidence (what you saw and where), and for a failure the concrete fix.`,
    'Then give the overall beauty score 1-10 by the rubric\'s beauty anchors (judge the desktop render first, then confirm on mobile); a failed gate check caps the score at the rubric\'s gateCap.',
    'Answer with ONE JSON object and nothing else, exactly this shape:',
    '{"schema":"starci/draw-critique@1","checks":[{"id":"H1","pass":true,"evidence":"...","fix":null}],"beauty":7,"anchor":"<the anchor you matched>","summary":"<two sentences: the biggest problem and the most valuable fix>"}',
  ].join('\n');
}

/** The verdict JSON out of the critic's last message (the last {...} block that parses). */
export function parseVerdict(text) {
  const s = String(text ?? '');
  for (let end = s.lastIndexOf('}'); end >= 0; end = s.lastIndexOf('}', end - 1)) {
    for (let start = s.lastIndexOf('{', end); start >= 0; start = s.lastIndexOf('{', start - 1)) {
      try {
        const v = JSON.parse(s.slice(start, end + 1));
        if (v && typeof v === 'object' && Array.isArray(v.checks) && v.beauty != null) return v;
      } catch { /* keep widening */ }
      if (end - start > 200000) break;
    }
  }
  return null;
}

/** Normalise a verdict against its rubric: every rubric check present, beauty a number capped by a failed gate. */
export function normaliseVerdict(v, rubric) {
  const byId = new Map((Array.isArray(v?.checks) ? v.checks : []).filter((c) => c?.id).map((c) => [String(c.id), c]));
  const checks = (rubric.checks ?? []).map((c) => {
    const got = byId.get(String(c.id));
    return { id: String(c.id), pass: got ? got.pass === true || got.pass === 'P' || got.pass === 'pass' : false, evidence: got?.evidence ?? (got ? '' : 'the critic did not judge this check'), fix: got?.fix ?? null };
  });
  let beauty = Number(v?.beauty);
  if (!Number.isFinite(beauty)) beauty = null;
  const gateFailed = gateIdsOf(rubric).filter((id) => checks.find((c) => c.id === id)?.pass === false);
  if (beauty != null && gateFailed.length && Number.isFinite(Number(rubric.gateCap))) beauty = Math.min(beauty, Number(rubric.gateCap));
  return { checks, failed: checks.filter((c) => !c.pass).map((c) => c.id), beauty, anchor: v?.anchor ?? null, summary: v?.summary ?? null, gateFailed };
}

/**
 * The critic for a round drawn by `drawer` (a provider: devin, codex ...; null when unknown): {critic} or {error}.
 * `settings` is allocation.drawLoop.
 */
export function criticFor(settings, drawer = null) {
  const main = settings?.critic ?? null;
  if (!main) return { error: 'modules/models/runtimes.yaml allocation.drawLoop.critic is not configured' };
  const providerOf = (c) => String(c?.provider ?? c?.command ?? '').toLowerCase();
  const d = drawer ? String(drawer).toLowerCase() : null;
  if (!d || providerOf(main) !== d) return { critic: main };
  const alt = settings?.criticWhenDrawer?.[d] ?? null;
  if (alt && providerOf(alt) !== d) return { critic: alt, replaced: main.provider ?? main.command };
  return { error: `the drawer (${d}) is the critic's model (${main.model}) and allocation.drawLoop.criticWhenDrawer.${d} names no other: the critic must be a different model from the drawer` };
}

/**
 * The argv of the configured critic for a clean dir: `codex exec` read-only, ephemeral, the images attached; a claude
 * critic runs `claude -p` in the clean dir with only its read tools, reading the images from it.
 */
export function criticArgv({ critic, dir, images, lastMessage }) {
  if (String(critic?.provider ?? critic?.command ?? '').toLowerCase() === 'claude') {
    return ['-p', '--model', String(critic.model), '--output-format', 'text', '--allowedTools', 'Read,Glob,LS', '--disallowedTools', 'Bash,Edit,Write,WebFetch,WebSearch'];
  }
  return ['exec', '--skip-git-repo-check', '--ephemeral', '-C', dir, '-s', 'read-only', '-m', String(critic.model),
    '-c', `model_reasoning_effort=${critic.effort}`, ...images.flatMap((i) => ['-i', path.join(dir, i.file)]), '-o', lastMessage, '-'];
}

const runProcess = (command, argv, { input, cwd, timeoutMs }) => new Promise((resolve) => {
  let child;
  // On Windows `codex` is a .cmd shim that only a shell runs: hand the shell ONE quoted command line (never an args
  // array with shell: true, which concatenates unescaped); the prompt itself goes through stdin.
  const viaShell = process.platform === 'win32' && !/\.exe$/i.test(command);
  const quote = (a) => (/^[\w./:=\\-]+$/.test(a) ? a : `"${String(a).replace(/"/g, '""')}"`);
  try { child = viaShell ? spawn([command, ...argv].map(quote).join(' '), { cwd, shell: true, windowsHide: true }) : spawn(command, argv, { cwd, windowsHide: true }); }
  catch (error) { resolve({ code: null, error: String(error?.message ?? error), stdout: '', stderr: '' }); return; }
  let stdout = '', stderr = '', timedOut = false;
  const timer = setTimeout(() => { timedOut = true; try { child.kill(); } catch { /* gone */ } }, timeoutMs);
  child.stdout?.on('data', (d) => { stdout += d; if (stdout.length > 2e6) stdout = stdout.slice(-1e6); });
  child.stderr?.on('data', (d) => { stderr += d; if (stderr.length > 2e6) stderr = stderr.slice(-1e6); });
  child.on('error', (error) => { clearTimeout(timer); resolve({ code: null, error: String(error?.message ?? error), stdout, stderr }); });
  child.on('close', (code) => { clearTimeout(timer); resolve({ code, timedOut, stdout, stderr }); });
  child.stdin?.end(input);
});

/**
 * Run the independent critic over one round. `images` [{path, label}], `html` the round's source, `rubric` from
 * rubricFor. `runner` (tests) replaces the process: ({command, argv, dir, prompt}) => {code, lastMessage}.
 * Returns the critique.json body (never throws): {schema, critic, rubric, verdict|null, error|null}.
 */
export async function runCritic({ images, html, rubric, critic, runner = null, tmpRoot = os.tmpdir() }) {
  if (!critic || typeof critic !== 'object' || !critic.command || !critic.model) {
    return { schema: CRITIQUE_SCHEMA, critic: { independent: false }, rubric: { source: rubric?.source ?? null, checks: (rubric?.checks ?? []).length }, verdict: null,
      error: 'no critic is configured (modules/models/runtimes.yaml allocation.drawLoop.critic needs command and model)' };
  }
  const dir = fs.mkdtempSync(path.join(tmpRoot, 'starci-draw-critic-'));
  const files = images.map((img, i) => ({ file: `render-${i + 1}${path.extname(img.path) || '.png'}`, label: img.label, from: img.path }));
  const base = { schema: CRITIQUE_SCHEMA, critic: { provider: critic.provider ?? critic.command, command: critic.command, model: critic.model, effort: critic.effort, independent: !runner, cleanDir: true }, rubric: { source: rubric.source, checks: (rubric.checks ?? []).length } };
  try {
    for (const f of files) fs.copyFileSync(f.from, path.join(dir, f.file));
    fs.writeFileSync(path.join(dir, 'screen.html'), fs.readFileSync(html));
    fs.writeFileSync(path.join(dir, 'rubric.yaml'), stringifyYaml(rubric));
    const prompt = criticPrompt({ images: files });
    const lastMessage = path.join(dir, 'last-message.txt');
    const argv = criticArgv({ critic, dir, images: files, lastMessage });
    base.critic.argv = argv.map((a) => a.split(dir).join('<clean-dir>'));
    base.critic.prompt = prompt;
    base.critic.promptSha256 = sha256(prompt);
    const started = Date.now();
    const r = runner ? await runner({ command: critic.command, argv, dir, prompt }) : await runProcess(critic.command, argv, { input: prompt, cwd: dir, timeoutMs: Number(critic.timeoutMs) });
    base.critic.ms = Date.now() - started;
    base.critic.exit = r.code ?? null;
    if (r.timedOut) base.critic.timedOut = true;
    const text = r.lastMessage ?? (fs.existsSync(lastMessage) ? fs.readFileSync(lastMessage, 'utf8') : r.stdout ?? '');
    const raw = parseVerdict(text);
    if (!raw) return { ...base, verdict: null, error: `the critic returned no verdict JSON (exit ${r.code ?? r.error ?? '?'}${r.timedOut ? ', timed out' : ''}): ${String(text || r.stderr || r.error || '').slice(-400)}` };
    return { ...base, verdict: normaliseVerdict(raw, rubric), raw, error: null };
  } catch (error) {
    return { ...base, verdict: null, error: String(error?.message ?? error) };
  } finally {
    safeRemoveTree(dir);
  }
}
