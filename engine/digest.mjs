// digest.mjs — the one SHA-256 the runtime hashes with. A leaf: every file's integrity digest,
// every ledger input ref and every stamped asset is this function, so a byte stream and a file
// never disagree about what their digest is.
import { createHash } from 'node:crypto';
import fs from 'node:fs';

/** The lowercase hex SHA-256 of `value` (string, Buffer or TypedArray). */
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
/** The SHA-256 of the file's exact bytes; throws when the file cannot be read. */
export function sha256File(file){
  // A numeric descriptor belongs to the caller; positional reads preserve its offset.
  const owned=typeof file!=='number',fd=owned?fs.openSync(file,'r'):file;
  const hash=createHash('sha256'),buffer=Buffer.alloc(1024*1024);
  try{let at=0,n;while((n=fs.readSync(fd,buffer,0,buffer.length,at))>0){hash.update(buffer.subarray(0,n));at+=n;}return hash.digest('hex');}
  finally{if(owned)fs.closeSync(fd);}
}
