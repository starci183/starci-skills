// draw-critic.mjs — the independent critic of a draw-loop round (owner ruling 2026-09-27: draw -> shoot -> evaluate ->
// fix; the beauty and hierarchy judgement comes from a critic that did NOT draw it). The critic is a fresh Orca worker
// with no drawing context, launched like every other agent through orchestration worker-start
// (scripts/agent/lib.mjs startAgent; modules/host/orca/calls.yaml) with the provider,
// model and effort of the member the picker admits. Its placement (criticWorkspace) is a
// worktree Orca creates at a commit of the empty tree, so it holds only the round's PNGs, its HTML and the rubric; its Task spec names that directory, the images
// and the one file it may write, verdict.json (starci/draw-critique@1: every rubric check pass/fail with evidence and
// fix, a 1-10 beauty score with its anchor), and forbids every other write. The runtime waits for the worker's
// worker_done (or its escalation, or the worker ending) through the orchestration commands, bounded by the critic's
// timeoutMs, reads verdict.json, then stops and releases the worker and closes its Task. A launch failure, a timeout,
// a refusal or a missing verdict is a typed outcome with an error and no verdict - never a pass. The provider, model,
// exact prompt, dispatch and verdict are recorded in the round's critique.json; the placement worktree is removed.
//
// The critic is a member of ANOTHER PROVIDER than the drawer (owner ruling 2026-09-27: the maker never judges its own work).
// criticFor (critic-pick.mjs) takes it from the Critic tier through the tier picker; the drawer is draw-loop.mjs round --drawer,
// else the provider of the op running it (scripts/guards/op-context.mjs). A tier with no independent member refuses the critique
// with CRITIC_NO_INDEPENDENT_MEMBER, an error and no beauty - never the drawer judging itself. Its terminal is bound to a critic
// guard (critic-guard.mjs) that confines it to its directory and its verdict file; its answer is one typed verdict
// (critic-verdict.mjs, starci/critic-verdict@1) carrying the digests of the bytes it was handed.
//
// The rubric is the product's: `.starciwork/brand/index.yaml` brand.direction.rubric.checks (brand.decide's direction
// mode - lane ui-discipline-brand), with the archetype block of the record's ui.archetype when the direction has one.
// A product whose brand record carries no rubric yet is judged by DEFAULT_RUBRIC below (the r5 bake-off rubric,
// brand-neutral, in the work/brand@1 rubric shape; knowledge/ui/examples/brand-direction.example.yaml seeds a product's
// own).
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';
import {sha256} from '../../engine/digest.mjs';
import crypto from 'node:crypto';
import { hashObject } from '../api/git/hash-object.mjs';
import { commitTree } from '../api/git/commit-tree.mjs';
import { gitResultOf } from '../lib/git.mjs';
import { gitRootOf } from './git-root.mjs';
import { createOrcaWorktree, removeOrcaWorktree } from '../machine/worktree-orca.mjs';
import { opContextOf } from '../guards/op-context.mjs';
import { slash } from '../lib/path-key.mjs';
import { repeatInOrder } from '../lib/in-order.mjs';
import { ownerRubricChecks } from './draw-feedback.mjs';
import { startAgent } from '../agent/lib.mjs';
import { promptFileOf } from '../agent/prompt-file.mjs';
import { criticFor } from './critic-pick.mjs';
import { codeOfOutcome, handedDigests, touchedByCritic, typedVerdict } from './critic-verdict.mjs';
import { bindCriticTerminal, criticBound, unbindCriticTerminal, writeCriticGuard } from './critic-guard.mjs';
import { decisionKind } from '../agent/call-admission.mjs';
import { renderRoleLines } from '../machine/roles-contract.mjs';
import { releaseAgentAdmission } from '../agent/admission.mjs';
import { closeWorker, workerClosureProven } from '../machine/worker-close.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { workerStop } from '../api/orca/worker-stop.mjs';
import { check as orcaCheck } from '../api/orca/check.mjs';
import { taskUpdate } from '../api/orca/task-update.mjs';
import { readEnv } from '../lib/env.mjs';
import { bestEffortCall } from '../agent/best-effort-call.mjs';

const CRITIQUE_SCHEMA = 'starci/draw-critique@1';
const RUBRIC_SCHEMA = 'starci/draw-rubric@1';

/** The built-in rubric: the r5 bake-off critic sheet (<tmp>/draw-bakeoff/r5/inputs/08-RUBRIC.md), brand-neutral. */
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

/** The gate check ids of a rubric: every check marked gate. */
const gateIdsOf = (rubric) => [...new Set((rubric.checks ?? []).filter((c) => c?.gate === true).map((c) => String(c.id)))];

/** What the Critic worker is titled and tasked with for the drawing loop; a decision critique passes its own (decision-critic.mjs). */
const DRAW_SUBJECT = Object.freeze({ title: 'draw', objective: 'independent critique of one draw-loop round' });

/** The one file the critic writes, in its clean directory. */
export const VERDICT_FILE = 'verdict.json';

/**
 * The critic's Task spec. It never sees the drawing brief, the worker's notes or any earlier round: only the clean
 * directory `dir` with the images, the HTML and the rubric. Its one write is `dir`/verdict.json.
 */
// The critic's role (scope, never, reports to) is modules/kernel/roles.yaml#critic.
function criticPrompt({ dir, images, html = 'screen.html', rubricFile = 'rubric.yaml', verdictFile = VERDICT_FILE }) {
  const at = (f) => slash(path.join(dir, f));
  return [
    'You are an independent senior product-design critic. You did NOT draw this screen and you have no other context.',
    ...renderRoleLines('critic'),
    `Your directory is ${slash(dir)}. The images in it are the renders of ONE product surface - open and look at each: ${images.map((i) => at(i.file) + ' (' + i.label + ')').join(', ')}. The HTML source is ${at(html)}; the rubric is ${at(rubricFile)}.`,
    `Judge strictly and only what you can observe in the images and the HTML. Read only these files. Do not edit, create, delete or run anything; the one file you may write is ${at(verdictFile)}.`,
    `For EVERY check in ${rubricFile}: pass true/false, one line of evidence (what you saw and where), and for a failure the concrete fix.`,
    'Then give the overall beauty score 1-10 by the rubric\'s beauty anchors (judge the desktop render first, then confirm on mobile); a failed gate check caps the score at the rubric\'s gateCap.',
    `Write ONE JSON object to ${at(verdictFile)}, exactly this shape and nothing else:`,
    '{"schema":"starci/draw-critique@1","checks":[{"id":"H1","pass":true,"evidence":"...","fix":null}],"beauty":7,"anchor":"<the anchor you matched>","summary":"<two sentences: the biggest problem and the most valuable fix>"}',
    'Then report worker_done exactly once. If you cannot judge, report an escalation saying why instead of writing a verdict.',
  ].join('\n');
}

/** The verdict JSON out of the critic's verdict file (the last {...} block that parses). */
export function parseVerdict(text) {
  const s = String(text ?? '');
  for (let end = s.lastIndexOf('}'); end >= 0; end = s.lastIndexOf('}', end - 1)) {
    for (let start = s.lastIndexOf('{', end); start >= 0; start = s.lastIndexOf('{', start - 1)) {
      try {
        const v = JSON.parse(s.slice(start, end + 1));
        if (v && typeof v === 'object' && Array.isArray(v.checks) && (v.beauty ?? v.score) != null) return v;
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
  let beauty = Number(v?.beauty ?? v?.score);
  if (!Number.isFinite(beauty)) beauty = null;
  const gateFailed = gateIdsOf(rubric).filter((id) => checks.find((c) => c.id === id)?.pass === false);
  if (beauty != null && gateFailed.length && Number.isFinite(Number(rubric.gateCap))) beauty = Math.min(beauty, Number(rubric.gateCap));
  return { checks, failed: checks.filter((c) => !c.pass).map((c) => c.id), beauty, anchor: v?.anchor ?? null, summary: v?.summary ?? null, gateFailed };
}

/** The current Op supplies author identity only when the caller did not name the drawer. */
export function contextualCriticFor(settings, drawer = undefined) {
  const context = opContextOf();
  const author = drawer ?? (context?.provider ? { provider: context.provider, model: context.modelId ?? context.model ?? null } : null);
  return { drawer: author, ...criticFor(settings, author) };
}

// worker-show states after which the worker does nothing more.
const ENDED = new Set(['done', 'completed', 'failed', 'stopped', 'released', 'exited']);
// The Orca Task status a Task settled by worker_done reads.
const TASK_CLOSED = 'completed';
const DEFAULT_POLL_MS = 5000;
const payloadOf = (m) => { try { return typeof m?.payload === 'string' ? JSON.parse(m.payload) : m?.payload ?? null; } catch { return null; } };
const settle = bestEffortCall;

/**
 * The Orca client the critic runs through: the scripts/api/orca wrappers, each replaceable (tests pass a fake).
 * Launch calls go to scripts/agent/lib.mjs startAgent's io; the rest supervise the worker.
 */
function clientOf(orca) {
  const o = orca ?? {};
  return {
    launch: (opts) => startAgent({ ...opts, io: orca ? { runShow: o.runShow, runCreate: o.runCreate,
      admission: o.admission,
      workerList: o.workerList ?? (() => ({ ok: false, error: 'the fake client lists no workers' })),
      spawn: { trust: o.trust, start: o.workerStart, rename: o.terminalRename, show: o.workerShow, stop: o.workerStop, release: o.workerRelease } } : null }),
    show: o.workerShow ?? workerShow,
    stop: o.workerStop ?? workerStop,
    release: o.workerRelease ?? closeWorker,
    check: o.check ?? orcaCheck,
    taskUpdate: o.taskUpdate ?? taskUpdate,
  };
}

/**
 * The critic's placement: Orca places a worker only on a worktree it resolves (a git worktree of a known repository;
 * a bare temp directory is refused selector_not_found - launch smoke 2026-10-01). So the clean directory is an Orca
 * worktree (scripts/machine/worktree-orca.mjs createOrcaWorktree, kind critic, owned by the op job running the loop when there
 * is one) of the repository the loop runs in, at a commit of the EMPTY tree: it holds nothing but its `.git` file until
 * the round's images, HTML and rubric are copied in. Orca creates it, lists it and removes it; the registry keys it by
 * Orca's id. Never capped (the workflow's own worktree already counts). {ok, dir, repoRoot, orcaId} | {ok:false, error}.
 */
export function criticWorkspace({ repoRoot = gitRootOf(process.cwd()), context = opContextOf(), env = process.env, orca = undefined } = {}) {
  if (!repoRoot) return { ok: false, error: `no git repository at ${slash(process.cwd())} to place the critic worktree in` };
  const git = (call, args, input = undefined) => gitResultOf(call(args, { cwd: repoRoot, input, config: { 'user.name': 'StarCi runtime', 'user.email': 'runtime@starci.invalid' } }));
  const tree = git(hashObject, ['-t', 'tree', '-w', '--stdin'], '');
  if (!tree.ok) return { ok: false, error: `empty tree: ${tree.error}` };
  const commit = git(commitTree, [tree.stdout.trim(), '-m', 'draw critic placement (empty tree)']);
  if (!commit.ok) return { ok: false, error: `empty commit: ${commit.error}` };
  const made = createOrcaWorktree({ repoRoot, kind: 'critic', name: `draw-critic-${crypto.randomBytes(4).toString('hex')}`, base: commit.stdout.trim(), cap: null, env,
    owner: { workflowId: context?.workflowId ?? null, jobId: context?.jobId ?? null }, ...(orca ? { orca } : {}) });
  return made.ok ? { ok: true, dir: made.path, repoRoot: path.resolve(repoRoot), orcaId: made.id, branch: made.branch } : { ok: false, error: `${made.reason}: ${made.detail ?? ''}`.trim() };
}

/** Remove the critic's placement through Orca (scripts/machine/worktree-orca.mjs removeOrcaWorktree, its branch with it). {ok, ...}. */
export function removeCriticWorkspace({ dir, repoRoot, orcaId, branch = null, env = process.env, orca = undefined }) {
  return removeOrcaWorktree({ repoRoot, orcaId, dir, branch, deleteBranch: branch ? 'force' : null, env, ...(orca ? { orca } : {}) });
}


/**
 * Start the critic worker on its placement `dir` through worker-start (startAgent: run-create --from `entry`,
 * worker-start --spec --agent --model --effort, worker-show attestation). `orca` replaces the Orca client
 * (clientOf). The launch receipt of scripts/agent/lib.mjs startAgent.
 */
export function launchCriticWorker({ critic, dir, prompt, entry = null, parentDispatch = null, orca = null, context = null, subject = DRAW_SUBJECT }) {
  // The Critic directory holds only the product it judges. The Task file the runtime writes for a prompt too long to paste lives in the state root's dispatch-prompts and is the one
  // file outside the directory the guard lets the Critic read (reach.taskFile); cleanupCriticWorkspace removes it.
  const specFile = promptFileOf(`critic:${path.basename(dir)}`);
  const guardFile = writeCriticGuard({ dir, verdictFile: VERDICT_FILE, taskFile: specFile, context, id: path.basename(dir) });
  return { ...clientOf(orca).launch({ provider: critic.provider, model: critic.model, effort: critic.effort ?? null, worktree: dir, onCreated: bindCriticTerminal(guardFile),
    role: 'critic', tier: critic.tier ?? null, author: critic.author, allowGroup: critic.allowGroup ?? [{ provider: critic.provider, model: critic.model, effort: critic.effort }],
    title: `[Critic] ${subject.title} ${critic.model}`, prompt, objective: subject.objective, entry, parentDispatch,
    specFile,
    // Its clean directory is made once per round (criticWorkspace): the launch's ledger identity.
    request: { critic: dir } }), specFile };
}

/**
 * Wait for the critic worker through the orchestration commands: its worker_done or escalation (the consuming
 * orchestration check of the critic's own Run, named by its coordinator `entry`, each Delivery acknowledged once read;
 * matched by the worker's terminal, dispatch or Task), else the worker ending (worker-show), else the deadline.
 * {signal: 'worker_done'|'escalation'|'ended'|'timeout', message?, state?}.
 */
async function awaitCritic({ client, runId, entry, dispatchId, terminal, taskId, timeoutMs, pollMs, sleep, now }) {
  const deadline = now() + timeoutMs;
  const mine = [];
  return repeatInOrder(async () => {
    // Every Delivery of the Run is read whole, then acknowledged; the ack call answers the next one.
    for (let delivery = settle(() => client.check({ run: runId, ...(entry ? { terminal: entry } : {}) })); delivery?.ok && delivery.deliveryId;) {
      mine.push(...delivery.messages.filter((m) => {
        const p = payloadOf(m);
        return (terminal && m?.from_handle === terminal) || (dispatchId && p?.dispatchId === dispatchId) || (taskId && p?.taskId === taskId);
      }));
      const { deliveryId } = delivery;
      delivery = settle(() => client.check({ run: runId, ...(entry ? { terminal: entry } : {}), ack: deliveryId }));
    }
    const done = mine.find((m) => m?.type === 'worker_done');
    if (done) return { signal: 'worker_done', message: done };
    const escalation = mine.find((m) => m?.type === 'escalation');
    if (escalation) return { signal: 'escalation', message: escalation };
    const shown = settle(() => client.show({ dispatch: dispatchId }));
    if (shown?.ok && ENDED.has(String(shown.state))) return { signal: 'ended', state: shown.state };
    const left = deadline - now();
    if (left <= 0) return { signal: 'timeout' };
    await sleep(Math.min(pollMs, left));
    return undefined;
  });
}

/**
 * Run the independent critic over one round. `images` [{path, label}], `html` the round's source, `rubric` from
 * rubricFor, `critic` {provider, model, effort, timeoutMs} from criticFor. `orca` replaces the Orca client (tests: a
 * fake of the wrappers - runCreate, trust, workerStart, terminalRename, workerShow,
 * workerStop, workerRelease, inbox, taskUpdate, and criticWorkspace/removeCriticWorkspace for the placement); `entry` is the
 * coordinator terminal (the op's ORCA_TERMINAL_HANDLE); `placement` the criticWorkspace options (repoRoot, context);
 * `parentDispatch` the op's Dispatch the critic nests under (the depth preflight).
 * Returns the critique.json body (never throws): {schema, outcome, critic, rubric, verdict|null, error|null}.
 */
export async function runCritic({ images = [], html = null, rubric, critic, minimum = null, orca = null, spec = null, entry = readEnv('ORCA_TERMINAL_HANDLE') || null, placement = {},
  parentDispatch = placement?.context?.dispatchId ?? (orca ? null : opContextOf()?.dispatchId ?? null),
  pollMs = DEFAULT_POLL_MS, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = Date.now }) {
  const rubricInfo = { source: rubric?.source ?? null, checks: (rubric?.checks ?? []).length };
  const configurationFailure = criticConfigurationFailure(critic, rubricInfo);
  if (configurationFailure) return configurationFailure;
  const client = clientOf(orca);
  const place = orca?.criticWorkspace ?? criticWorkspace;
  const unplace = orca?.removeCriticWorkspace ?? removeCriticWorkspace;
  const files = images.map((img, i) => ({ file: `render-${i + 1}${path.extname(img.path) || '.png'}`, label: img.label, from: img.path }));
  const base = { schema: CRITIQUE_SCHEMA, critic: { provider: critic.provider, model: critic.model, effort: critic.effort ?? null, tier: critic.tier ?? null, timeoutMs: Number(critic.timeoutMs),
    launch: 'orchestration worker-start', independent: false, cleanDir: true, author: critic.author }, rubric: rubricInfo };
  const failed = (outcome, error) => ({ ...base, outcome, code: codeOfOutcome(outcome), verdict: null, error });
  let launched = null;
  const workspace = place(placement);
  if (!workspace?.ok) return failed('launch-failed', `the critic has no placement: ${workspace?.error ?? 'criticWorkspace returned nothing'}`);
  const { dir } = workspace;
  try {
    const { prompt, started, handed } = spec ? prepareSpecWorkspace({ spec, dir, rubric, base, now }) : prepareCriticWorkspace({ files, dir, html, rubric, base, now });
    launched = launchCriticWorker({ critic, dir, prompt, entry, parentDispatch, orca, context: placement?.context ?? opContextOf(), ...(spec ? { subject: spec.subject } : {}) });
    if (!launched?.ok) return launchRefusal(launched, failed);
    if (!criticBound(launched.terminal)) return failed('unguarded', 'the critic terminal is not bound to a critic guard, so its verdict is not trusted');
    Object.assign(base.critic, { provider: launched.provider, model: launched.admission?.selected?.model ?? launched.model,
      admission: launched.admission ?? null, independent: !orca && launched.effective?.agent !== critic.author.provider,
      dispatchId: launched.dispatchId, taskId: launched.taskId, runId: launched.runId, effective: launched.effective ?? null });
    return await criticVerdict({ client, launched, entry, critic, pollMs, sleep, now, started, dir, base, rubric, failed, handed, minimum });
  } catch (error) {
    return failed(launched?.ok ? 'refused' : 'launch-failed', String(error?.message ?? error));
  } finally {
    cleanupCriticWorkspace({ launched, client, entry, orca, base, unplace, workspace, dir });
  }
}

/** The failed critique of a launch that did not start: an admission refusal is a quota or an unavailable happy error, any other step a launch failure. */
function launchRefusal(launched, failed) {
  const kind = launched?.step === 'admission' ? decisionKind(launched.error, launched.decision?.rejected ?? []) : null;
  const where = `${launched?.step ?? 'worker-start'}${launched?.errorCode ? ' ' + launched.errorCode : ''}`;
  return failed(kind === 'quota' ? 'quota' : 'launch-failed', `the critic worker did not start (${where}): ${launched?.error ?? 'no receipt'}`);
}

function criticConfigurationFailure(critic, rubricInfo) {
  if (!critic || typeof critic !== 'object' || !critic.provider || !critic.model || (Number(critic.timeoutMs) || 0) <= 0) {
    return { schema: CRITIQUE_SCHEMA, outcome: 'not-configured', critic: { independent: false }, rubric: rubricInfo, verdict: null,
      error: 'no critic is configured (the Critic tier of modules/models/tiers.yaml and allocation.drawLoop.criticTimeoutMs must give a provider, a model and a timeout)' };
  }
  if (!critic.author?.provider) return { schema: CRITIQUE_SCHEMA, outcome: 'not-configured', critic: { independent: false }, rubric: rubricInfo,
    verdict: null, error: 'the drawer provider is unknown; independent critique cannot be verified' };
  return null;
}

function prepareCriticWorkspace({ files, dir, html, rubric, base, now }) {
  for (const f of files) fs.copyFileSync(f.from, path.join(dir, f.file));
  fs.writeFileSync(path.join(dir, 'screen.html'), fs.readFileSync(html));
  fs.writeFileSync(path.join(dir, 'rubric.yaml'), stringifyYaml(rubric));
  const prompt = criticPrompt({ dir, images: files });
  base.critic.prompt = prompt.split(slash(dir)).join('<clean-dir>');
  base.critic.promptSha256 = sha256(prompt);
  const handed = handedDigests(dir, [...files.map((f) => ({ file: f.file, label: f.label, role: 'product' })), { file: 'screen.html', label: 'html', role: 'product' }, { file: 'rubric.yaml', label: 'rubric', role: 'rubric' }]);
  const started = now();
  return { prompt, started, handed };
}

/**
 * The workspace of a critique whose product is not a drawing (`spec` from decision-critic.mjs): spec.files [{file, label, role, from|content}]
 * are copied or written into `dir`, the rubric beside them, and spec.prompt({dir, rubricFile, verdictFile}) is the Task. The same digests, the same
 * touched-by-critic refusal and the same typed verdict as a drawing round.
 */
function prepareSpecWorkspace({ spec, dir, rubric, base, now }) {
  for (const f of spec.files) {
    if (f.from) fs.copyFileSync(f.from, path.join(dir, f.file));
    else fs.writeFileSync(path.join(dir, f.file), f.content);
  }
  fs.writeFileSync(path.join(dir, 'rubric.yaml'), stringifyYaml(rubric));
  const prompt = spec.prompt({ dir, rubricFile: 'rubric.yaml', verdictFile: VERDICT_FILE });
  base.critic.prompt = prompt.split(slash(dir)).join('<clean-dir>');
  base.critic.promptSha256 = sha256(prompt);
  const handed = handedDigests(dir, [...spec.files.map(({ file, label, role }) => ({ file, label, role })), { file: 'rubric.yaml', label: 'rubric', role: 'rubric' }]);
  return { prompt, started: now(), handed };
}

async function criticVerdict({ client, launched, entry, critic, pollMs, sleep, now, started, dir, base, rubric, failed, handed, minimum }) {
  const waited = await awaitCritic({ client, runId: launched.runId, entry, dispatchId: launched.dispatchId, terminal: launched.terminal, taskId: launched.taskId,
    timeoutMs: Number(critic.timeoutMs), pollMs, sleep, now });
  base.critic.ms = now() - started;
  base.critic.signal = waited.signal;
  if (waited.signal === 'timeout') return failed('timeout', `the critic sent no worker_done within ${critic.timeoutMs}ms`);
  if (waited.signal === 'escalation') return failed('refused', `the critic escalated instead of judging: ${String(waited.message?.body ?? waited.message?.subject ?? '').slice(0, 400)}`);
  if (waited.signal === 'ended') return failed('refused', `the critic worker ended (${waited.state}) without worker_done`);
  const file = path.join(dir, VERDICT_FILE);
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const raw = parseVerdict(text);
  if (!raw) return failed('verdict-missing', `the critic reported worker_done without a verdict in ${VERDICT_FILE}${text ? ': ' + text.slice(-400) : ' (no file)'}`);
  const touched = touchedByCritic({ dir, handed, verdictFile: VERDICT_FILE });
  if (touched.length) return failed('product-modified', `the critic changed what it was handed: ${touched.join('; ')}`);
  return { ...base, outcome: 'judged', code: null, verdict: typedVerdict({ normalised: normaliseVerdict(raw, rubric), handed, rubric, minimum, critic: base.critic }), raw, error: null };
}

function cleanupCriticWorkspace({ launched, client, entry, orca, base, unplace, workspace, dir }) {
  if (launched?.specFile) fs.rmSync(launched.specFile, { force: true });
  let placementSafe = launched?.effectState === 'none' || !launched;
  if (launched?.ok) {
    // Stop is a no-op for a worker that already settled; release frees its seat; the Task closes.
    const stop = settle(() => client.stop({ dispatch: launched.dispatchId }));
    const release = settle(() => client.release({ dispatch: launched.dispatchId }));
    placementSafe = workerClosureProven(release, launched.terminal);
    if (placementSafe
      && launched.admission) base.critic.providerBudget = settle(() => releaseAgentAdmission(launched.admission,
      { kind: 'closed', confirmed: true, handle: launched.terminal, terminalProof: release.closed.proof,
        processVerdict: release.processes.verdict }, { io: orca?.admission }));
    const task = settle(() => client.taskUpdate({ id: launched.taskId, status: TASK_CLOSED, run: launched.runId, ...(entry ? { from: entry } : {}) }));
    base.critic.cleanup = { stopped: stop?.ok === true, released: release?.ok === true, taskClosed: task?.ok === true };
    if (placementSafe) settle(() => unbindCriticTerminal(launched.terminal));
  }
  if (placementSafe) {
    const removed = settle(() => unplace({ dir, repoRoot: workspace.repoRoot, orcaId: workspace.orcaId, branch: workspace.branch ?? null }));
    if (removed?.ok !== true) base.critic.placementRemoveError = removed?.reason ?? removed?.error ?? 'not removed';
  } else {
    base.critic.placementRetained = { reason: 'worker exit is unproven', dir, dispatchId: launched?.dispatchId ?? null };
  }
}
