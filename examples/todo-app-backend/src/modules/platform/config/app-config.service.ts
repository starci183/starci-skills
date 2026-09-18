import { Injectable } from '@nestjs/common';

const DEFAULT_SESSION_TTL_DAYS = 30;
const DEFAULT_KEYCLOAK_TOKEN_URL = 'http://localhost:8089/realms/todo/protocol/openid-connect/token';
const DEFAULT_KEYCLOAK_CLIENT_ID = 'todo-api';
const DEFAULT_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/todo';
const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';
const DEFAULT_RECUR_TICK_CRON = '*/5 * * * *';

@Injectable()
export class AppConfigService {
  getSessionTtlDays(): number {
    const raw = process.env.TODO_SESSION_TTL_DAYS;
    return raw ? Number(raw) : DEFAULT_SESSION_TTL_DAYS;
  }

  getKeycloakTokenUrl(): string {
    return process.env.KEYCLOAK_TOKEN_URL ?? DEFAULT_KEYCLOAK_TOKEN_URL;
  }

  getKeycloakClientId(): string {
    return process.env.KEYCLOAK_CLIENT_ID ?? DEFAULT_KEYCLOAK_CLIENT_ID;
  }

  getDatabaseUrl(): string {
    return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  }

  getCorsOrigin(): string {
    return process.env.CORS_ORIGIN ?? DEFAULT_CORS_ORIGIN;
  }

  getPort(): number {
    const raw = process.env.PORT;
    return raw ? Number(raw) : 3001;
  }

  /** integration.recur.scheduler's tick interval - a standard cron expression, defaulting to that
   * integration record's own declared endpoint (`*\/5 * * * *`, every 5 minutes). Overridable only so a
   * live-proof run can observe a real tick without a 5-minute wait; production never sets this. */
  getRecurTickCron(): string {
    return process.env.RECUR_TICK_CRON ?? DEFAULT_RECUR_TICK_CRON;
  }
}
