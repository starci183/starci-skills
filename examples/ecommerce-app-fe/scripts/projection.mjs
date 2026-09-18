/**
 * The resolved port projection reader, mirroring the backend lane's AppConfigService bargain:
 * there is one runtime projection - `examples/ecommerce-app-be/metadata.json` - and consumers
 * READ it instead of keeping a second copy that agrees only until somebody moves the offset.
 *
 * The projection lives in the sibling backend repository (the BE repo owns the product's Work
 * tree, so its metadata.json is the whole product's resolved projection - its own README states
 * the FE lane's ports are "declared here, consumed there"). Resolution order, same shape as the
 * BE's `findMetadataFile`:
 *
 *   1. `ECOMMERCE_APP_BE_METADATA` names the file outright (deployment/tests inject it).
 *   2. Otherwise each ancestor of the FE repository root is searched for
 *      `ecommerce-app-be/metadata.json` - the sibling-repo form of the BE's upward walk.
 *
 * A missing or malformed projection throws naming the env var; nothing here invents a number.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const METADATA_FILE_ENV = 'ECOMMERCE_APP_BE_METADATA';
/** The sibling repository directory the projection is searched under. */
const SIBLING_REPO_DIR = 'ecommerce-app-be';
const REQUIRED_PORT_KEYS = ['identityApi', 'orderApi', 'landing', 'shop'];

const repoRoot = () => resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const findMetadataFile = (startDir = repoRoot()) => {
  const fromEnv = process.env[METADATA_FILE_ENV];
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      throw new Error(`${METADATA_FILE_ENV} points at ${fromEnv}, which does not exist.`);
    }
    return resolve(fromEnv);
  }
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, SIBLING_REPO_DIR, 'metadata.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `no ${SIBLING_REPO_DIR}/metadata.json found from ${startDir} upward; set ${METADATA_FILE_ENV} to its path.`,
      );
    }
    dir = parent;
  }
};

/**
 * Read the resolved `ports` map the frontend consumes. Throws unless every key this lane serves
 * or calls is a number - a partial projection is a broken projection, not a reason to guess.
 */
export const readPorts = (startDir) => {
  const file = findMetadataFile(startDir);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`${file} is not readable JSON.`);
  }
  const ports = parsed?.ports;
  const missing = REQUIRED_PORT_KEYS.filter((key) => typeof ports?.[key] !== 'number');
  if (missing.length > 0) {
    throw new Error(`${file} does not carry the resolved ports this app reads (${missing.join(', ')}).`);
  }
  return ports;
};
