import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * The resolved port projection reader, mirroring the backend lane's AppConfigService bargain:
 * there is one runtime projection - `examples/ecommerce-app-be/metadata.json` - and consumers
 * READ it instead of keeping a second copy that agrees only until somebody moves the offset.
 *
 * The projection lives in the sibling backend repository, so the upward walk from the process
 * cwd looks for `ecommerce-app-be/metadata.json` per ancestor - the sibling-repo form of the
 * BE's own `findMetadataFile`. `ECOMMERCE_APP_BE_METADATA` names the file outright when a
 * deployment or test injects it; a missing or malformed projection throws rather than guessing.
 */
export const METADATA_FILE_ENV = 'ECOMMERCE_APP_BE_METADATA';

const SIBLING_REPO_DIR = 'ecommerce-app-be';

/** The slice of metadata.json the frontend reads. Extra keys the BE adds are ignored. */
export interface ProjectedPorts {
  readonly identityApi: number;
  readonly orderApi: number;
  readonly landing: number;
  readonly shop: number;
}

const REQUIRED_PORT_KEYS: ReadonlyArray<keyof ProjectedPorts> = [
  'identityApi',
  'orderApi',
  'landing',
  'shop',
];

const findMetadataFile = (): string => {
  const fromEnv = process.env[METADATA_FILE_ENV];
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      throw new Error(`${METADATA_FILE_ENV} points at ${fromEnv}, which does not exist.`);
    }
    return resolve(fromEnv);
  }
  let dir = resolve(process.cwd());
  for (;;) {
    const candidate = join(dir, SIBLING_REPO_DIR, 'metadata.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `no ${SIBLING_REPO_DIR}/metadata.json found from ${process.cwd()} upward; set ${METADATA_FILE_ENV} to its path.`,
      );
    }
    dir = parent;
  }
};

let cached: ProjectedPorts | undefined;

/** Read the resolved `ports` map once per process; a partial projection is a broken projection. */
export const readProjectedPorts = (): ProjectedPorts => {
  if (cached) return cached;
  const file = findMetadataFile();
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`${file} is not readable JSON.`);
  }
  const ports = (parsed as { ports?: Partial<ProjectedPorts> })?.ports;
  const missing = REQUIRED_PORT_KEYS.filter((key) => typeof ports?.[key] !== 'number');
  if (missing.length > 0) {
    throw new Error(`${file} does not carry the resolved ports this app reads (${missing.join(', ')}).`);
  }
  cached = ports as ProjectedPorts;
  return cached;
};
