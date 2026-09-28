import { cpSync, mkdirSync } from 'node:fs'

mkdirSync(new URL('./dist/modules/theme/', import.meta.url), { recursive: true })
cpSync(new URL('./src/modules/theme/', import.meta.url), new URL('./dist/modules/theme/', import.meta.url), { recursive: true })
mkdirSync(new URL('./dist/messages/', import.meta.url), { recursive: true })
cpSync(new URL('./src/messages/', import.meta.url), new URL('./dist/messages/', import.meta.url), { recursive: true })
