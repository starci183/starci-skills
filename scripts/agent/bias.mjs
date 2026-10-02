// scripts/agent/bias.mjs — routing-bias normalization + deterministic
// extraction fallback. Two jobs, both machine work — NOT prompt understanding:
//
//   normalizeBias(obj)   — canonicalize a bias object (agent-supplied or
//                          regex-extracted): aliases → canonical pool ids,
//                          unknowns dropped, avoid always wins over prefer.
//   extractRoutingBias(text) -> { prefer: [], avoid: [] }
//                          — regex floor for callers with no agent in the
//                          loop (automation, programmatic define-goal). An
//                          agent reading the owner prompt extracts bias
//                          semantically itself and passes --routing-bias;
//                          this regex exists so the same code path still
//                          works when nobody is there to read intent.
//
// Regex markers (floor, not ceiling — agents catch every other phrasing): the prefer/avoid marker
// phrases an owner prompt types, in either language (the Vietnamese ones are lexicon data,
// modules/goal/source-phrases.yaml bias), each followed by a pool alias:
//   codex|codex-agent -> codex-agent   claude|claude-agent -> claude-agent
//   devin|devin-agent -> devin-agent
//
// CLI: node scripts/agent/bias.mjs "<text>"            -> extracted JSON
//      node scripts/agent/bias.mjs --normalize '<json>' -> normalized JSON
import { isMain } from '../lib/is-main.mjs';
import { parseJson } from '../lib/json.mjs';
import { altOf } from '../lib/source-phrases.mjs';

const ALIASES = {
  'codex': 'codex-agent', 'codex-agent': 'codex-agent',
  'claude': 'claude-agent', 'claude-agent': 'claude-agent',
  'devin': 'devin-agent', 'devin-agent': 'devin-agent',
};

// Longest alias forms first so 'codex-agent' wins over 'codex' inside the token.
const PREFER_RE = new RegExp(`(?:${altOf('bias.prefer')})\\s+([a-z][a-z-]*)`, 'gi');
const AVOID_RE = new RegExp(`(?:${altOf('bias.avoid')})\\s+([a-z][a-z-]*)`, 'gi');

const scan = (text, re) => {
  const out = [];
  for (const m of text.matchAll(re)) {
    const agent = ALIASES[m[1].toLowerCase()];
    if (agent && !out.includes(agent)) out.push(agent);
  }
  return out;
};

function extractRoutingBias(text) {
  const t = String(text ?? '');
  const avoid = scan(t, AVOID_RE);
  const prefer = scan(t, PREFER_RE).filter((a) => !avoid.includes(a));
  return { prefer, avoid };
}

// Canonicalize any bias-shaped object: every entry resolves through the
// alias map (case-insensitive, unknowns dropped), avoid wins over prefer.
function normalizeBias(obj) {
  const canon = (list) => {
    const out = [];
    for (const raw of Array.isArray(list) ? list : []) {
      const agent = ALIASES[String(raw ?? '').trim().toLowerCase()];
      if (agent && !out.includes(agent)) out.push(agent);
    }
    return out;
  };
  const avoid = canon(obj?.avoid);
  const prefer = canon(obj?.prefer).filter((a) => !avoid.includes(a));
  return { prefer, avoid };
}

const entry = isMain(import.meta.url);
if (entry) {
  const argv = process.argv.slice(2);
  const ni = argv.indexOf('--normalize');
  if (ni >= 0) {
    const parsed = parseJson(argv[ni + 1]);
    console.log(JSON.stringify(normalizeBias(parsed ?? {}), null, 2));
  } else {
    console.log(JSON.stringify(extractRoutingBias(argv.join(' ')), null, 2));
  }
}
