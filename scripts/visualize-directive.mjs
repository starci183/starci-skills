import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;
const WINDOWS_ABSOLUTE = /^[A-Za-z]:\//u;

export function normalizeVisualizePath(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('visualize path must be a non-empty string');
  }
  if (CONTROL_CHARACTER.test(value)) {
    throw new TypeError('visualize path must not contain control characters');
  }

  const normalized = value.replaceAll('\\', '/');
  if (!(normalized.startsWith('/') || normalized.startsWith('//') || WINDOWS_ABSOLUTE.test(normalized))) {
    throw new TypeError('visualize path must be absolute');
  }
  return normalized;
}

export function createVisualizeDirective(value, options = {}) {
  const payload = { path: normalizeVisualizePath(value) };

  if (options.mode !== undefined) {
    if (options.mode !== 'wide') throw new TypeError('visualize mode must be wide when provided');
    payload.mode = options.mode;
  }
  if (options.title !== undefined) {
    if (typeof options.title !== 'string' || options.title.length === 0 || CONTROL_CHARACTER.test(options.title)) {
      throw new TypeError('visualize title must be a non-empty string without control characters');
    }
    payload.title = options.title;
  }

  const json = JSON.stringify(payload);
  const roundTrip = JSON.parse(json);
  if (roundTrip.path !== payload.path || /\\[nrt]/u.test(json)) {
    throw new Error('visualize directive failed JSON round-trip safety');
  }
  return `visualize${json}`;
}

function parseCli(argv) {
  const [visualPath, ...rest] = argv;
  if (!visualPath) throw new TypeError('usage: node visualize-directive.mjs <absolute-path> [--mode wide] [--title <title>]');

  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const next = rest[index + 1];
    if (flag === '--mode' && next) {
      options.mode = next;
      index += 1;
    } else if (flag === '--title' && next) {
      options.title = next;
      index += 1;
    } else {
      throw new TypeError(`unknown or incomplete option: ${flag}`);
    }
  }
  return { visualPath, options };
}

const entrypoint = process.argv[1] ? realpathSync(resolve(process.argv[1])) : undefined;
const modulePath = realpathSync(fileURLToPath(import.meta.url));
if (entrypoint === modulePath) {
  try {
    const { visualPath, options } = parseCli(process.argv.slice(2));
    process.stdout.write(`${createVisualizeDirective(visualPath, options)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
