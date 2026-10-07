// slot-path.mjs - normalize a slot-relative path for resolver comparisons.
import { posixPath } from '../lib/path-key.mjs';

const SLASH = '/';
const END = '$';
const TRAILING_SLASHES = new RegExp(`${SLASH}+${END}`);

export const cleanSlotPath = (value) => posixPath(value).replace(TRAILING_SLASHES, '');
