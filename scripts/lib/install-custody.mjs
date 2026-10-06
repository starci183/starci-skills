// install-custody.mjs — the installer's existing descriptor and payload digest convention.
import { sha256 } from '../../engine/digest.mjs';
import { EXAMPLE_RUNTIMES_ROOT } from './example-refs.mjs';
export const INSTALL_MANIFEST_FILE = '.starci-skills.json';
export const INSTALL_PROTOCOL_SCHEMA = 'starci/install-protocol@1';
/**
 * Hash owned payload bytes: declared sample paths use raw custody; other paths normalize UTF-8/CRLF.
 * @param {Buffer} bytes Installer-owned payload bytes.
 * @param {string} [relative=''] Package-relative path; the selected sample namespace retains exact bytes.
 * @returns {string} Lowercase SHA-256 under the path's custody convention.
 */
export const installedPayloadDigest = (bytes, relative = '') => sha256(relative.startsWith(`${EXAMPLE_RUNTIMES_ROOT}/`)
  ? bytes : bytes.toString('utf8').replaceAll('\r\n','\n'));
