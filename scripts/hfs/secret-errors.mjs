// secret-errors.mjs - sanitized public errors shared by app secret operations.

export class SecretError extends Error {}

export const publicStorage = (action) => {
  try {
    return action();
  } catch (error) {
    throw new SecretError(
      error.code ? `private storage failed (${error.code})` : error.message,
    );
  }
};

export function secretErrorMessage(error) {
  if (error instanceof SecretError) return error.message;
  if (error instanceof SyntaxError) return "invalid secret document";
  const code = error.code ? ` (${error.code})` : "";
  return `operation failed${code}; no secret values were printed`;
}
