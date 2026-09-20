// scripts/api/quota/qwen.mjs — credential-presence probe; NO network call.
// The qwen agent card names BAILIAN_TOKEN_PLAN_API_KEY as the credential env
// key; DASHSCOPE_API_KEY / OPENAI_API_KEY are the provider's other accepted
// key variables. The card also documents that Qwen reads its own env file
// (~/.qwen/.env) — a running process may simply lack the variable while the
// file still holds a valid key, so the file is a second presence source and
// its absence is what makes the provider 'dead'.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ENV_KEYS = ['BAILIAN_TOKEN_PLAN_API_KEY', 'DASHSCOPE_API_KEY', 'OPENAI_API_KEY'];
const QWEN_ENV_FILE = path.join(os.homedir(), '.qwen', '.env');

export function probe() {
  const present = ENV_KEYS.filter((k) => typeof process.env[k] === 'string' && process.env[k].trim());
  if (present.length) {
    return { state: 'ok', usedPercent: null, detail: `credential env present: ${present.join(', ')}` };
  }
  try {
    const text = fs.readFileSync(QWEN_ENV_FILE, 'utf8');
    const fileKeys = ENV_KEYS.filter((k) => new RegExp(`^${k}=`, 'm').test(text));
    if (fileKeys.length) {
      return { state: 'ok', usedPercent: null, detail: `credential in ${QWEN_ENV_FILE}: ${fileKeys.join(', ')}` };
    }
  } catch { /* no env file — fall through to dead */ }
  return { state: 'dead', usedPercent: null, detail: `no qwen credential env (${ENV_KEYS.join(', ')}) and no ${QWEN_ENV_FILE} entry` };
}
