// A qwen launch command never caps session turns: --max-session-turns overrides the host's unlimited
// ~/.qwen/settings.json and ended a nivo backend.implement worker mid-job (inc-f1d014518dc3). The wall-time
// and tool-call ceilings stay.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['modules/models/registry.yaml', ...fs.readdirSync(path.join(root, 'modules/models/profiles')).map((f) => `modules/models/profiles/${f}`)];

test('no qwen launch command carries --max-session-turns; its ceilings stay', () => {
  let commands = 0;
  for (const file of files) {
    for (const line of fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/)) {
      if (!/\b(?:command|reasoningCommand):\s*"?qwen\s/.test(line)) continue;
      commands += 1;
      assert.doesNotMatch(line, /--max-session-turns/, `${file}: ${line.trim()}`);
      assert.match(line, /--max-wall-time \S+/, `${file}: wall-time ceiling`);
      assert.match(line, /--max-tool-calls \d+/, `${file}: tool-call ceiling`);
    }
  }
  assert.ok(commands >= 4, `found ${commands} qwen commands`);
});
