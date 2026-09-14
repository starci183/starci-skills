#!/usr/bin/env node
import fs from 'node:fs';

/**
 * A `sops` that is real enough to drive `starci identity set` from outside: the CLI spawns whatever is on
 * PATH, so the only way to test the command as a person runs it is to put one there. It is deliberately not a
 * cipher - the point of the test is not that sops encrypts, it is that the CLI never writes a plaintext value,
 * never passes one as an argument and never prints one - so "encrypted" is a marker line the test can see, and
 * "decrypt" takes it off again.
 *
 * `FAKE_SOPS_ENCRYPT_STATUS=1` is the tree with no key for it: sops is installed and refuses, which is exactly
 * the refusal the owner has to be told apart from "sops is not installed".
 */
const MARKER='# sops-encrypted\n';
const args=process.argv.slice(2);
if(args[0]==='--version'){process.stdout.write('sops 3.9.0 (fake, for tests)\n');process.exit(0);}
const file=args.at(-1);
const mode=args.includes('--decrypt')?'decrypt':args.includes('--encrypt')||args[0]==='encrypt'?'encrypt':null;
if(!mode||!file||mode==='decrypt'&&!fs.existsSync(file)){process.stderr.write('fake sops: expected encrypt or decrypt\n');process.exit(2);}
if(mode==='encrypt'&&process.env.FAKE_SOPS_ENCRYPT_STATUS==='1'){
  process.stderr.write(`config file not found and no keys provided through command line options for ${file}\n`);
  process.exit(1);
}
const text=fs.readFileSync(args[0]==='encrypt'?0:file,'utf8');
if(mode==='encrypt'){process.stdout.write(`${MARKER}${text}`);process.exit(0);}
if(!text.startsWith(MARKER)){process.stderr.write('fake sops: cannot decrypt, no matching key\n');process.exit(1);}
process.stdout.write(text.slice(MARKER.length));
