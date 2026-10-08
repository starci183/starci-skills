// Pure identity shape and receipt schema shared by the process API and its domain consumers.
export const OWNED_PROCESS_SCHEMA = 'starci/owned-process@1';

/** A complete Windows process identity: positive PID, native birth and absolute executable; presence grants no launch authority. */
export const validProcessIdentity = (value) => Number.isInteger(value?.pid) && value.pid > 0
  && /^[1-9]\d{15,19}$/.test(String(value?.birth ?? '')) && typeof value?.exe === 'string' && /^(?:[a-z]:[\\/]|\\\\)/i.test(value.exe);

/** The creation instant (epoch ms) a native birth stamp (a Windows FILETIME) names, or null when it cannot be read. */
export const bornAt = (identity) => {
  try { return Number((BigInt(identity.birth) - 116444736000000000n) / 10000n); } catch { return null; }
};
