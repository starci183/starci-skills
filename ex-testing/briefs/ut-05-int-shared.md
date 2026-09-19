# Lane UT-05 — todo integrations + shared

SCOPE (exclusive): `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend/src/modules/integrations/`, `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend/src/modules/shared/`

Integration clients (sepay + others): request shaping, signature/webhook verification, error mapping, timeout/retry. Shared (36 files): pipes, interceptors, decorators, utils, guards — pure-function specs are fine via TestingModule providers or direct unit where the file is a pure function (judgment: TestingModule still preferred for providers).
