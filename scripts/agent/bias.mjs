// scripts/agent/bias.mjs — deterministic routing-bias extraction from owner
// prompt text. No model, no network: a fixed regex over the pool aliases.
//
//   extractRoutingBias(text) -> { prefer: [], avoid: [] }
//
// Prefer markers: "ưu tiên X", "prefer X", "uu tien X", "u-u tien X"
//   (angle-bracketed forms like "<ưu tiên X>" match the same pattern)
// Avoid markers:  "tránh X", "tranh X", "avoid X", "không dùng X", "khong dung X"
// where X is a pool alias:
//   codex|codex-agent -> codex-agent   claude|claude-agent -> claude-agent
//   fable|claude-fable -> claude-fable qwen|qwen-agent -> qwen-agent
//   devin|devin-agent -> devin-agent
// An alias named by both a prefer and an avoid marker lands in avoid only —
// an avoid never loses to a prefer.
//
// CLI: node scripts/agent/bias.mjs "<text>" -> JSON
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

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const text = process.argv.slice(2).join(' ');
  console.log(JSON.stringify(extractRoutingBias(text), null, 2));
}
