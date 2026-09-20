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
// Regex markers (floor, not ceiling — agents catch every other phrasing):
//   prefer: "ưu tiên X", "prefer X", "uu tien X", "u-u tien X" ("<ưu tiên X>" too)
//   avoid:  "tránh X", "tranh X", "avoid X", "không dùng X", "khong dung X"
// where X is a pool alias:
//   codex|codex-agent -> codex-agent   claude|claude-agent -> claude-agent
//   fable|claude-fable -> claude-fable qwen|qwen-agent -> qwen-agent
//   devin|devin-agent -> devin-agent
//
// CLI: node scripts/agent/bias.mjs "<text>"            -> extracted JSON
//      node scripts/agent/bias.mjs --normalize '<json>' -> normalized JSON
import { pathToFileURL } from 'node:url';

const ALIASES = {
  'codex': 'codex-agent', 'codex-agent': 'codex-agent',
  'claude': 'claude-agent', 'claude-agent': 'claude-agent',
  'fable': 'claude-fable', 'claude-fable': 'claude-fable',
  'qwen': 'qwen-agent', 'qwen-agent': 'qwen-agent',
  'devin': 'devin-agent', 'devin-agent': 'devin-agent',
};

// Longest alias forms first so 'codex-agent' wins over 'codex' inside the token.
const PREFER_RE = /(?:ưu\s*tiên|uu\s*tien|u-u\s*tien|prefer)\s+([a-z][a-z-]*)/gi;
const AVOID_RE = /(?:không\s*dùng|khong\s*dung|tránh|tranh|avoid)\s+([a-z][a-z-]*)/gi;

const scan = (text, re) => {
  const out = [];
  for (const m of text.matchAll(re)) {
    const agent = ALIASES[m[1].toLowerCase()];
    if (agent && !out.includes(agent)) out.push(agent);
  }
  return out;
};

export function extractRoutingBias(text) {
  const t = String(text ?? '');
  const avoid = scan(t, AVOID_RE);
  const prefer = scan(t, PREFER_RE).filter((a) => !avoid.includes(a));
  return { prefer, avoid };
}

// Canonicalize any bias-shaped object: every entry resolves through the
// alias map (case-insensitive, unknowns dropped), avoid wins over prefer.
export function normalizeBias(obj) {
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

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const argv = process.argv.slice(2);
  const ni = argv.indexOf('--normalize');
  if (ni >= 0) {
    let parsed = null;
    try { parsed = JSON.parse(argv[ni + 1] ?? 'null'); } catch { /* falls through to null */ }
    console.log(JSON.stringify(normalizeBias(parsed ?? {}), null, 2));
  } else {
    console.log(JSON.stringify(extractRoutingBias(argv.join(' ')), null, 2));
  }
}
