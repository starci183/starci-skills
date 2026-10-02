#!/usr/bin/env node
import process from 'node:process';
import { main } from '../src/main.mjs';

process.exitCode = await main(process.argv.slice(2));
