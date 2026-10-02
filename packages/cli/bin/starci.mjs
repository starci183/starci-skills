#!/usr/bin/env node
import process from 'node:process';
import { main } from '../src/main.mjs';

// A reader that closes early (`starci help | head`) is not an error worth a stack trace.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (error) => {
    if (error?.code === 'EPIPE') process.exit(process.exitCode ?? 0);
    throw error;
  });
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`starci: ${error?.message ?? error}\n`);
  process.exitCode = 1;
}
