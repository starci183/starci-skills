// codegen.mjs - the app's generated code, the one step behind `npm run codegen` (lint, typecheck, dev and build run it first).
// The front end reads the back end's committed contracts in place (be/contracts/, hfs.json sides.fe.reads) and generates its
// client from them into a gitignored __generated__/ folder. A new app has no contract yet, so there is nothing to generate.
process.stdout.write("codegen: no contract under be/contracts yet\n")
