import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Env var naming this checkout's metadata.json; the fallback walk searches upward from the process cwd. */
export const METADATA_FILE_ENV = 'ECOMMERCE_APP_BE_METADATA';
/** Env vars that override a resolved value outright (deployment injects them; dev reads metadata). */
export const PORT_ENV = 'IDENTITY_PORT';
export const DATABASE_URL_ENV = 'IDENTITY_DATABASE_URL';
export const REDIS_URL_ENV = 'IDENTITY_REDIS_URL';
export const ORDER_API_URL_ENV = 'ORDER_API_URL';
/** Session lifetime override; the default is one hour. */
export const SESSION_TTL_SECONDS_ENV = 'IDENTITY_SESSION_TTL_SECONDS';

/** The slice of metadata.json this service reads. Extra keys the FE lane adds are ignored. */
interface PortsResult {
  identityApi: number;
  postgres: number;
  redis: number;
  orderApi: number;
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
  if (!ports || typeof ports.identityApi !== 'number' || typeof ports.orderApi !== 'number'
    || typeof ports.postgres !== 'number' || typeof ports.redis !== 'number') {
    throw new Error(`${file} does not carry the resolved ports this service reads (identityApi, orderApi, postgres, redis).`);
  }
  return { project: String((parsed as { project?: unknown }).project ?? ''), ports };
}

/**
 * The service's whole view of "where everything lives". NOTHING here is a source-level port
 * literal: every number is read from the repository's metadata.json - the same file the compose
 * fragments and (later) the FE lane resolve from - and each value may be overridden by its env var
 * for a deployment that injects one. This is the bargain nivo-fe/scripts/sync-ports.mjs states:
 * there is one runtime projection, and consumers READ it instead of keeping a second copy that
 * agrees only until somebody moves the offset.
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
    return raw ? Number(raw) : this.metadata.ports.identityApi;
  }

  /** The shared dev Postgres (component `postgres`); one database, one schema per service prefix. */
  getDatabaseUrl(): string {
    return process.env[DATABASE_URL_ENV] ?? `postgres://postgres@localhost:${this.metadata.ports.postgres}/ecommerce`;
  }

  /** The shared dev Redis (component `redis`); this service's session store. */
  getRedisUrl(): string {
    return process.env[REDIS_URL_ENV] ?? `redis://localhost:${this.metadata.ports.redis}/0`;
  }

  /** Base URL of the order service - the HTTP surface contract.checkout.order-for-identity names. */
  getOrderApiBaseUrl(): string {
    return process.env[ORDER_API_URL_ENV] ?? `http://localhost:${this.metadata.ports.orderApi}`;
  }

  /** Opaque session-token lifetime in the Redis store. */
  getSessionTtlSeconds(): number {
    const raw = process.env[SESSION_TTL_SECONDS_ENV];
    return raw ? Number(raw) : 60 * 60;
  }
}
