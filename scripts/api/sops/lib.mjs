// scripts/api/sops/lib.mjs — what the sops call files beside it share: the input type a custody file's name states.
// Custody members are committed as `<name>.<fmt>.enc`; sops infers a format from the LAST extension, so `.enc` reads as
// binary and every read states the format (--input-type). The call files (decrypt.mjs, encrypt.mjs, exec-env.mjs) each
// name one sops use.

const FORMATS = { yaml: 'yaml', yml: 'yaml', json: 'json', env: 'dotenv', dotenv: 'dotenv' };

/** The sops input type `<name>.<format>.enc` states, or the explicit override. Throws when neither names one. */
export function custodyInputType(file, override) {
  if (override) {
    if (!Object.values(FORMATS).includes(override)) throw new Error(`unsupported --input-type ${override}`);
    return override;
  }
  const match = /\.([a-z]+)\.enc$/iu.exec(String(file));
  const type = match ? FORMATS[match[1].toLowerCase()] : undefined;
  if (!type) throw new Error(`${file}: name it <name>.<yaml|json|env>.enc or pass --input-type`);
  return type;
}
