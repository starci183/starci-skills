// codegen.mjs - the app's generated code, the one step behind `npm run codegen` (lint, typecheck, dev and build run it first).
// The front end reads the back end's committed contracts in place (be/contracts/, hfs.json sides.fe.reads) and generates its
// client from them into a gitignored __generated__/ folder. A new app has no contract yet, so there is nothing to generate.
import fs from "node:fs"
import path from "node:path"

// {{> app/codegen-graphql.mjs.partial}}
