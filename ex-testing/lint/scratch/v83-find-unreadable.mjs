// v8-3 scratch: find the committed revision(s) that did not parse, so the run's REVISION_UNREADABLE line can be
// named in the report.
import {spawnSync} from 'node:child_process';
import {parseYaml} from '../../../core/yaml.mjs';

const repoDir = 'D:/Repositories/starci-academy-backend/.claude';
const relTree = 'examples/todo-app-backend/.starciwork';
const git = (args, input) => {
  const run = spawnSync('git', args, {cwd: repoDir, encoding: 'utf8', maxBuffer: 1 << 28, input});
  return run.stdout ?? '';
};

const text = git(['log', '--first-parent', '--format=\x1f%H', '--name-only', '-z', '-n', '50', '--', relTree]);
const specs = new Set();
let commit = null;
for (const field of text.split('\0')) {
  const value = field.replace(/^[\s\x00-\x1f]+/, '');
  if (!value) continue;
  if (field.replace(/^\s+/, '').startsWith('\x1f')) { commit = field.slice(field.indexOf('\x1f') + 1).trim(); continue; }
  if (!value.endsWith('.yaml') || value.endsWith('evidence.yaml') || value.includes('/_derived/')) continue;
  specs.add(`${commit}:${value}`);
  specs.add(`HEAD:${value}`);
}
const [head, ...older] = [...specs];
const raw = spawnSync('git', ['cat-file', '--batch'], {cwd: repoDir,
  input: Buffer.from([...specs].map(s => `${s}\n`).join(''), 'utf8'), maxBuffer: 1 << 28}).stdout;
let cursor = 0;
const list = [...specs];
for (const spec of list) {
  const end = raw.indexOf(0x0a, cursor);
  if (end < 0) break;
  const header = raw.subarray(cursor, end).toString('utf8');
  cursor = end + 1;
  const parts = header.split(' ');
  if (parts.length !== 3 || parts[1] !== 'blob') continue;
  const size = Number(parts[2]);
  const body = raw.subarray(cursor, cursor + size).toString('utf8');
  cursor += size + 1;
  try {
    const data = parseYaml(body);
    if (!data || typeof data !== 'object') console.log(`NOT AN OBJECT: ${spec}`);
  } catch (error) {
    console.log(`UNPARSEABLE: ${spec}  ${error.message}`);
    console.log('   first 6 lines: ' + body.split('\n').slice(0, 6).join(' | ').slice(0, 400));
  }
}
void head;
void older;
