import { ScaffoldError } from './service.mjs';

/** Enables the lazy SQL identifier guard's error family when a lite generator installs database.sql.ts. */
export function withSqlIdentifierError(text) {
  const code = '    IdentifierRejected = "DATABASE_IDENTIFIER_REJECTED",';
  if (text.includes(code)) return text;
  const enumMarker = 'export enum DatabaseErrorCode {';
  const kindsMarker = 'export const DATABASE_ERROR_KINDS: Record<DatabaseErrorCode, ErrorKind> = {';
  if (!text.includes(enumMarker) || !text.includes(kindsMarker)) {
    throw new ScaffoldError('HFS_ADD_DATABASE_ERROR', 'platform/database has an unknown error-family shape');
  }
  return text.replace(enumMarker, enumMarker + '\n    /** A dynamic SQL identifier was not on the names its caller allows. */\n' + code)
    .replace(kindsMarker, kindsMarker + '\n    [DatabaseErrorCode.IdentifierRejected]: "internal",');
}
