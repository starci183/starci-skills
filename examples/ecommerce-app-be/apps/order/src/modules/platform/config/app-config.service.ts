import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Env var naming this checkout's metadata.json; the fallback walk searches upward from the process cwd. */
export const METADATA_FILE_ENV = 'ECOMMERCE_APP_BE_METADATA';
/** Env vars that override a resolved value outright (deployment injects them; dev reads metadata). */
export const PORT_ENV = 'ORDER_PORT';
export const DATABASE_URL_ENV = 'ORDER_DATABASE_URL';
export const IDENTITY_API_URL_ENV = 'IDENTITY_API_URL';

interface PortsResult {
  identityApi: number;
  orderApi: number;
  postgres: number;
}

interface MetadataResult {
  project: string;
  ports: PortsResult;
}

function findMetadataFile(): string {
  const fromEnv = process.env[METADATA_FILE_ENV];
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      throw new Error(`${METADATA_FILE_ENV} points at ${fromEnv}, which does not exist.`);
    }
    return resolve(fromEnv);
  }
  let dir = resolve(process.cwd());
  for (;;) {
    const candidate = join(dir, 'metadata.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`no metadata.json found from ${process.cwd()} upward; set ${METADATA_FILE_ENV} to its path.`);
    }
    dir = parent;
  }
}

function readMetadata(): MetadataResult {
  const file = findMetadataFile();
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`${file} is not readable JSON.`);
  }
  const ports = (parsed as Partial<MetadataResult>)?.ports;
  if (!ports || typeof ports.identityApi !== 'number' || typeof ports.orderApi !== 'number' || typeof ports.postgres !== 'number') {
    throw new Error(`${file} does not carry the resolved ports this service reads (identityApi, orderApi, postgres).`);
  }
  return { project: String((parsed as { project?: unknown }).project ?? ''), ports };
}

/**
 * The order service's view of "where everything lives" - every number read from metadata.json,
 * the one runtime projection (see apps/identity's app-config.service.ts for the full bargain;
 * the loader is deliberately duplicated rather than shared, because apps/* is where the brief
 * draws the package line and two ~40-line readers beat a premature shared workspace).
 */
@Injectable()
export class AppConfigService {
  private readonly metadata: MetadataResult;

  constructor() {
    this.metadata = readMetadata();
  }

  getProject(): string {
    return this.metadata.project;
  }

  getPort(): number {
    const raw = process.env[PORT_ENV];
    return raw ? Number(raw) : this.metadata.ports.orderApi;
  }

  /** The shared dev Postgres (component `postgres`); the order tables carry the `order_` prefix. */
  getDatabaseUrl(): string {
    return process.env[DATABASE_URL_ENV] ?? `postgres://postgres@localhost:${this.metadata.ports.postgres}/ecommerce`;
  }

  /** Base URL of the identity service - the HTTP surface its session controller exposes. */
  getIdentityApiBaseUrl(): string {
    return process.env[IDENTITY_API_URL_ENV] ?? `http://localhost:${this.metadata.ports.identityApi}`;
  }
}
