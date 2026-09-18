import { Injectable } from '@nestjs/common';

const DEFAULT_SESSION_TTL_DAYS = 30;
const DEFAULT_KEYCLOAK_TOKEN_URL = 'http://localhost:8089/realms/todo/protocol/openid-connect/token';
const DEFAULT_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/todo';

@Injectable()
export class AppConfigService {
  getSessionTtlDays(): number {
    const raw = process.env.TODO_SESSION_TTL_DAYS;
    return raw ? Number(raw) : DEFAULT_SESSION_TTL_DAYS;
  }

  getKeycloakTokenUrl(): string {
    return process.env.KEYCLOAK_TOKEN_URL ?? DEFAULT_KEYCLOAK_TOKEN_URL;
  }

  getDatabaseUrl(): string {
    return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  }
}
