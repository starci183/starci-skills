// slot-errors.mjs - the shared refusal type for HFS manifest and declaration loaders.
export class HfsSlotsError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'HfsSlotsError';
    this.code = code;
    this.details = details;
  }
}

export const fail = (code, message, details) => { throw new HfsSlotsError(code, message, details); };
