'use strict';

/**
 * The frozen assertion set, written before any effect was run.
 *
 * Every entry is one assertion, and one assertion is exactly one scenario. An assertion's `statement` is
 * quoted from the record that owns it (the `fr` record's own mainFlow / exceptionFlows / postconditions
 * line, or the `then` block of the `ac` record nested under a rule that `fr` record composes), so the
 * expectation is readable against the requirement rather than against how the code currently behaves.
 *
 * `request` is the client request the scenario sends through the public GraphQL door and `expect` is the
 * observable effect the stack must show. Where a statement declares no effect a client can observe at the
 * public surface, or declares one this schema does not expose at all, the entry carries `notRun` with the
 * reason and the scenario fails loudly instead of silently passing: an assertion with no proof surface is
 * a finding about the record, never a free green.
 *
 * Composed-rule acceptance criteria are included per record, so a criterion named by two records is
 * proven twice (once under each record's own check command) rather than merged.
 */

const GROUPS = {
  'auth/sign-in': {
    record: 'fr.login.sign-in',
    command: 'npm run test:e2e -- auth/sign-in',
    assertions: [
      {
        id: 'fr.login.sign-in.main-1',
        statement: 'The pair is checked.',
        request: 'signIn(input: {email: demo@todo.dev, password: <the seeded demo password>})',
        expect: 'A success envelope with a non-empty sessionToken and the personId this identity resolves to; signing in twice for the same email yields the same personId and a wrong pair yields no token at all.',
      },
      {
        id: 'fr.login.sign-in.main-2',
        statement: 'A session is created and the person lands on their list.',
        request: 'signIn, then createTask, then tasks - all with the token that sign-in returned',
        expect: 'The list is served by that session and contains the task created through it, while another person reading their own list never sees it.',
      },
      {
        id: 'fr.login.sign-in.exception-1',
        statement: 'A wrong pair is refused without naming which half was wrong.',
        request: 'signIn with demo@todo.dev and a wrong password',
        expect: 'Refused with INVALID_CREDENTIALS; the refusal names neither the email half nor the password half.',
      },
      {
        id: 'fr.login.sign-in.post-1',
        statement: 'Exactly one live session exists for that person.',
        request: 'signIn twice for the same person, then read the list with the first token',
        expect: 'Only the newest session is live: the first token is refused on its next request.',
      },
      {
        id: 'ac.login.password.sign-in.wrong-pair-is-refused',
        statement: "given: A known email / when: The password does not match / then: Sign-in is refused and no session is created.",
        request: 'signIn with demo@todo.dev and a password that is not its own',
        expect: 'Refused, and no session is created: the envelope carries no data.signIn at all, so no sessionToken exists to read back.',
      },
      {
        id: 'ac.login.password.sign-in.refusal-does-not-name-the-half',
        statement: "given: An unknown email and a known email with a wrong password / when: Each is submitted / then: Both refusals carry the same message and the same status. Their response times do not separate the two cases.",
        request: 'signIn(unknown email) and signIn(known email, wrong password)',
        expect: 'Both refusals carry the same message and the same status; neither leaks which half failed.',
        unproven: ['Their response times do not separate the two cases: a timing claim. Gating a functional scenario on wall-clock deltas measured over loopback on a developer machine is a flaky gate, not a proof, and this record\'s own requiresProof.perf.command (node scripts/load/sign-in-timing.mjs) is the line that owns it - that script does not exist in this checkout either, so the timing half has no command anywhere. This scenario proves the same-message-and-status bullet only.'],
      },
      {
        id: 'ac.login.session.restores.returning-within-the-window-stays-signed-in',
        statement: "given: A person signed in yesterday / when: They open the product again / then: They are signed in without typing a password.",
        request: '(no request can satisfy the given clause)',
        expect: 'A person who signed in yesterday is served without a password.',
        notRun: 'The given-clause precondition "signed in yesterday" cannot be created through any public operation - the session\'s age is set by the server clock and nothing ages or restores a session - and AppConfigService floors SESSION_TTL_MINUTES at 60, so the window cannot be shortened to a waitable one inside a scenario either. The reachable half (a stored token keeps working on a later request, no second password) is proven by fr.login.sign-in.main-2; this criterion as authored is not.',
      },
    ],
  },

  'auth/sign-out': {
    record: 'fr.login.sign-out',
    command: 'npm run test:e2e -- auth/sign-out',
    assertions: [
      {
        id: 'fr.login.sign-out.main-1',
        statement: 'The session ends and the next request is unauthenticated.',
        request: 'signIn, then signOut(input: {sessionToken}), then tasks with that same token',
        expect: 'signOut reports signedOut: true and the next request with the same token is refused SESSION_NOT_FOUND.',
      },
      {
        id: 'ac.login.session.restores.returning-within-the-window-stays-signed-in',
        statement: "given: A person signed in yesterday / when: They open the product again / then: They are signed in without typing a password.",
        request: '(no request can satisfy the given clause)',
        expect: 'A person who signed in yesterday is served without a password.',
        notRun: 'fr.login.sign-out composes br.login.session.restores, so this criterion is in its assertion set too, and it is not runnable for the same reason as under auth/sign-in: no public operation ages a session, so "signed in yesterday" cannot be created. What this record does prove at its own door is the inverse half - signOut ends a session and the next request with it is refused.',
      },
      {
        id: 'ac.login.session.single-device.second-sign-in-ends-the-first',
        statement: "given: A person signed in on one device / when: They sign in on another / then: The first session is refused on its next request.",
        request: 'signIn twice as the same person, then read the list with the first token',
        expect: 'The first session is refused on its next request.',
      },
    ],
  },

  'tasks/create': {
    record: 'fr.task.create',
    command: 'npm run test:e2e -- tasks/create',
    assertions: [
      {
        id: 'fr.task.create.main-1',
        statement: 'The owner submits a non-empty title.',
        request: 'createTask(input: {title: "<run-unique non-empty title>"}) as demo',
        expect: 'A success envelope carrying a taskId and that title.',
      },
      {
        id: 'fr.task.create.main-2',
        statement: 'The task is created, owned by the submitter, not complete.',
        request: 'createTask as demo, then tasks as demo and as demo2',
        expect: 'The new row reads back through the public list: present for the submitter, complete: false, and absent from another person\'s list.',
      },
      {
        id: 'fr.task.create.exception-1',
        statement: 'An empty title is refused and nothing is created.',
        request: 'createTask(input: {title: ""}) as demo',
        expect: 'Refused with TASK_TITLE_REQUIRED and the submitter\'s task count is unchanged.',
      },
      {
        id: 'fr.task.create.post-1',
        statement: 'Exactly one task exists for that submission.',
        request: 'createTask once with a run-unique title, then read the submitter\'s list',
        expect: 'Exactly one row in the submitter\'s list carries that title.',
      },
      {
        id: 'ac.task.single-owner.refuses-stranger',
        statement: "given: A task exists with an owner / when: Somebody who is neither the owner nor an accepted editor collaborator attempts to complete or delete it, or an accepted editor collaborator attempts to delete it / then: The attempt is refused. The task is unchanged, now and after a restart.",
        request: 'as demo: createTask; as demo2 (a stranger): completeTask, deleteTask; as demo2 (an accepted editor): invite + acceptInvitation, then deleteTask; then read the task back as demo',
        expect: 'All three attempts are refused with TASK_FORBIDDEN and the task still reads back owned and unchanged for its owner.',
        unproven: ['The then-bullet "unchanged, now and after a restart" needs a second boot of the same database inside one scenario; this suite disposes its run-owned stack at the end of every run and never reuses a volume, so the after-a restart half is out of a single run\'s reach. The unchanged-now half is proven; the restart half is not.'],
      },
      {
        id: 'ac.task.title.required.refuses-empty',
        statement: "given: A creation request / when: Its title is empty or only whitespace / then: Creation is refused. Nothing is written.",
        request: 'createTask(input: {title: ""}) and createTask(input: {title: "   "}) as demo',
        expect: 'Both are refused and nothing is written: neither appears in the submitter\'s list and the list length is unchanged.',
      },
    ],
  },

  'tasks/complete': {
    record: 'fr.task.complete',
    command: 'npm run test:e2e -- tasks/complete',
    assertions: [
      {
        id: 'fr.task.complete.main-1',
        statement: 'The actor names a task they own, or a task on which they hold an accepted editor invitation.',
        request: 'as demo: createTask + completeTask; separately invite demo2 as editor, accept, then completeTask as demo2',
        expect: 'Both actors can name a task at this door: the owner\'s completion succeeds and an accepted editor\'s completion succeeds.',
      },
      {
        id: 'fr.task.complete.main-2',
        statement: 'The task becomes complete.',
        request: 'completeTask, then read the task back through task(id) and tasks',
        expect: 'complete: true in both reads.',
      },
      {
        id: 'fr.task.complete.exception-1',
        statement: 'A task the actor neither owns nor holds an accepted editor invitation on is refused.',
        request: 'as demo2 (no invitation at all): completeTask(demo\'s task)',
        expect: 'Refused with TASK_FORBIDDEN and the task stays incomplete.',
      },
      {
        id: 'ac.task.complete.once.is-idempotent',
        statement: "given: A task already complete / when: It is completed again / then: The task is unchanged. The response is success, not an error.",
        request: 'completeTask twice as the owner',
        expect: 'The second response is a success envelope with the same body as the first, and the task still reads complete.',
      },
      {
        id: 'ac.task.complete.once.is-reversible',
        statement: "given: A task the owner completed / when: The owner reopens it / then: The task reads incomplete. Its completion timestamp is cleared.",
        request: 'completeTask, then reopenTask, then read the task back',
        expect: 'The task reads incomplete again.',
        unproven: ['The second then-bullet cannot be observed at this door: TaskResponse exposes only taskId, title and complete (src/features/todo/graphql/mutations/task/*/graphql-types/response.ts and queries/task/list-tasks), so no public operation returns a completion timestamp to check for clearing. The bullet needs a schema field that does not exist, which is a specification-side gap (SCOPE_OUTSIDE_ALLOWLIST for this op), not something the scenario may fake.'],
      },
      {
        id: 'ac.share.role.permissions.viewer-read-only',
        statement: "given: A task has an accepted viewer collaborator / when: That collaborator attempts to complete the task / then: The attempt is refused. The task is unchanged.",
        request: 'as demo: createTask + invite(viewer, demo2); as demo2: acceptInvitation, then completeTask; then read the task back as demo',
        expect: 'The viewer\'s completion is refused with TASK_FORBIDDEN and the task still reads complete: false for its owner.',
      },
      {
        id: 'ac.share.role.permissions.editor-can-complete',
        statement: "given: A task has an accepted editor collaborator / when: That collaborator completes the task / then: The attempt succeeds. The task reads complete for the owner too.",
        request: 'as demo: createTask + invite(editor, demo2); as demo2: acceptInvitation, then completeTask; then read the task back as demo',
        expect: 'The editor\'s completion succeeds and the owner reads the same task back complete: true.',
      },
    ],
  },

  'tasks/reopen': {
    record: 'fr.task.reopen',
    command: 'npm run test:e2e -- tasks/reopen',
    assertions: [
      {
        id: 'fr.task.reopen.main-1',
        statement: 'The owner names a task they own that is currently complete.',
        request: 'as demo: createTask, completeTask, then reopenTask',
        expect: 'The owner can name that completed task at the reopen door: a success envelope.',
      },
      {
        id: 'fr.task.reopen.main-2',
        statement: 'The task reads incomplete again and its completion timestamp is cleared.',
        request: 'reopenTask, then read the task back through task(id) and tasks',
        expect: 'complete: false in both reads.',
        unproven: ['The "completion timestamp is cleared" half of this mainFlow step has no public field to read: TaskResponse carries taskId, title and complete only. Same schema gap as ac.task.complete.once.is-reversible.'],
      },
      {
        id: 'fr.task.reopen.exception-1',
        statement: 'A task the actor does not own is refused.',
        request: 'as demo2: reopenTask(demo\'s completed task)',
        expect: 'Refused with TASK_FORBIDDEN and the task still reads complete: true for its owner.',
      },
      {
        id: 'ac.task.complete.once.is-idempotent',
        statement: "given: A task already complete / when: It is completed again / then: The task is unchanged. The response is success, not an error.",
        request: 'completeTask, reopenTask, then completeTask again as the owner',
        expect: 'Each completion is a success envelope and the task reads complete after the last one.',
      },
      {
        id: 'ac.task.complete.once.is-reversible',
        statement: "given: A task the owner completed / when: The owner reopens it / then: The task reads incomplete. Its completion timestamp is cleared.",
        request: 'completeTask then reopenTask as the owner, then read back',
        expect: 'The task reads incomplete.',
        unproven: ['Second then-bullet has no public field (completion timestamp is not in TaskResponse) - same gap as fr.task.reopen.main-2.'],
      },
    ],
  },

  'audit/log-append': {
    record: 'fr.audit.log.append',
    command: 'npm run test:e2e -- audit/log-append',
    assertions: [
      {
        id: 'fr.audit.log.append.main-1',
        statement: "The acting person's id and the action are handed to the log.",
        request: 'as demo, one tracked action per event this record subscribes to (event.login.signed-in, event.login.signed-out, event.task.created, event.task.completed, event.task.deleted), then auditLog',
        expect: "Each action's own line comes back through the caller's read, carrying that action name and the target it acted on.",
      },
      {
        id: 'fr.audit.log.append.main-2',
        statement: 'One line is appended, sealed and hashed onto the chain.',
        request: 'one tracked action, then auditLog',
        expect: 'Exactly one new line for that action.',
        unproven: ['The "sealed and hashed onto the chain" half is not observable at any public door: AuditLogLineResponse exposes at, action and target only, never keyId, actor, prevHash or hash, and there is no public operation that reports the chain state. Reading the sealed blob or the chain would need the entity row, which this suite may not touch. The count half is proven here; the sealing half is a specification-side gap (the record demands an observable effect its own contract does not expose).'],
      },
      {
        id: 'fr.audit.log.append.post-1',
        statement: 'The line count increases by exactly one.',
        request: 'auditLog, then exactly one tracked action (createTask), then auditLog again',
        expect: 'The caller\'s line count is exactly one greater.',
      },
      {
        id: 'fr.audit.log.append.post-2',
        statement: 'Recomputing the chain from the first line still reports valid.',
        request: '(none available)',
        expect: 'A public read that recomputes the chain reports it valid.',
        notRun: 'No public operation recomputes or reports the chain. AuditLogService.verifyChain is an in-process service call, and calling it from a spec is the in-process shortcut around the entry point that this op\'s e2ePolicy forbids. Proving this postcondition needs either a public chain-status field (schema does not have one) or a direct storage read (not the public API).',
      },
      {
        id: 'ac.audit.append-only.chain-detects-tamper',
        statement: "given: A log with several appended lines, each line's hash covering its own content and the previous line's hash / when: A test mutates one stored field on an already-appended line, or removes one line from the middle of the store, then asks the module to recompute the chain from the first line forward / then: The recomputation reports the exact index where the recomputed hash first stops matching the stored one, not merely \"invalid\" - a removed line must surface as a broken prevHash link at the line that followed it, and a changed field must surface as a content mismatch at that line. The same recomputation over an untouched log reports every line valid. \"The check that proves this: a node:test (or Nest e2e) suite that appends N lines, snapshots the chain, mutates the underlying storage directly (bypassing the module's own write path, the way a rogue admin or a compromised disk would), and asserts the recomputed break index equals the mutated line's index. A test that only calls the module's own append/verify pair without an out-of-band mutation does not prove tamper-evidence; it proves the happy path.\"",
        request: '(none available)',
        expect: 'An out-of-band mutation of the store surfaces as the exact break index.',
        notRun: 'The acceptance criterion\'s own when-clause requires mutating the underlying storage out of band, and its then-clause requires reading a break index. Neither is reachable through a public GraphQL door: there is no operation that mutates a stored line, and none that reports a chain position. This criterion is a unit-level proof obligation (audit-log.service.spec.ts already owns it); as a line under fr.audit.log.append\'s requiresProof.e2e it has no proof surface, which is precisely the kind of mismatch this report records.',
      },
      {
        id: 'ac.audit.retention.available-through-window',
        statement: "given: A line captured at time zero / when: 400 days pass with no erasure request against its subject / then: The line is still present, still chained, and still readable. Nothing in the storage layer evicts a line on a clock alone. \"The check that proves this: inject a fake clock into the retention sweep (never rely on real wall-clock delay in a test), advance it past 400 days, and assert the line count and chain validity are unchanged. A separate case must advance to well past the window with an active erasure against the line's subject and assert the line still exists but no longer decrypts - proving retention and erasure are independent axes, not one flag.\"",
        request: '(none available)',
        expect: 'A line remains readable past the retention window.',
        notRun: 'The when-clause needs 400 days to pass. There is no public operation that advances the server clock, and the criterion\'s own then-text prescribes an injected fake clock (an in-process seam). Out of reach of a run-owned black-box scenario.',
      },
    ],
  },

  'audit/log-read': {
    record: 'fr.audit.log.read',
    command: 'npm run test:e2e -- audit/log-read',
    assertions: [
      {
        id: 'fr.audit.log.read.main-1',
        statement: "The operator's authorization is checked.",
        request: '(none available)',
        expect: 'An operator caller is authorized to read activity beyond their own lines, and a non-operator is refused that wider read.',
        notRun: 'No such authorization exists at the public door, and the record is already blocked on gap.audit.operator-role for this reason: the auditLog query takes no arguments and resolves the caller\'s own personId from their session (src/modules/bussiness/audit/audit-log.query.ts says so in its own comment). There is no operator role, no filter, and no wider read to authorize, so the request this step describes cannot be sent.',
      },
      {
        id: 'fr.audit.log.read.main-2',
        statement: 'Matching lines are returned, each resolved through readLine so a tombstoned line reads as tombstoned rather than throwing.',
        request: 'auditLog after the caller\'s own key has been destroyed by a completed erasure',
        expect: 'The read answers without throwing.',
        unproven: ['Two halves are unreachable at this door. The optional "filtered by action or target" filter is not a query argument at all, and a tombstoned line is invisible rather than marked: findLinesForPerson filters on keyId, so once the key is destroyed the caller\'s read returns an empty list instead of a line carrying a tombstone flag - AuditLogLineResponse has no tombstone field. What is proven is only that the read answers.'],
      },
      {
        id: 'fr.audit.log.read.exception-1',
        statement: 'An unauthorized reader is refused before any line is touched.',
        request: 'auditLog with no Authorization header at all, and with a malformed one',
        expect: 'Both are refused with SESSION_NOT_FOUND and no line data at all in the response.',
      },
      {
        id: 'fr.audit.log.read.post-1',
        statement: 'No response ever includes a sealed actor blob or a keyId a reader could use to correlate lines across an erasure.',
        request: 'auditLog as demo and as demo2, and exportMyData as demo, after both have produced lines and after one of them has been erased',
        expect: 'No response field carries a sealed blob (the iv.tag.ciphertext shape), a UUID keyId, or an actor value that is not the reader\'s own - and the transport-level field names themselves are only at, action, target.',
      },
      {
        id: 'ac.audit.append-only.chain-detects-tamper',
        statement: "given: A log with several appended lines, each line's hash covering its own content and the previous line's hash / when: A test mutates one stored field on an already-appended line, or removes one line from the middle of the store, then asks the module to recompute the chain from the first line forward / then: The recomputation reports the exact index where the recomputed hash first stops matching the stored one, not merely \"invalid\" - a removed line must surface as a broken prevHash link at the line that followed it, and a changed field must surface as a content mismatch at that line. The same recomputation over an untouched log reports every line valid. \"The check that proves this: a node:test (or Nest e2e) suite that appends N lines, snapshots the chain, mutates the underlying storage directly (bypassing the module's own write path, the way a rogue admin or a compromised disk would), and asserts the recomputed break index equals the mutated line's index. A test that only calls the module's own append/verify pair without an out-of-band mutation does not prove tamper-evidence; it proves the happy path.\"",
        request: '(none available)',
        expect: 'An out-of-band mutation surfaces as the exact break index.',
        notRun: 'Same absent proof surface as under audit/log-append: no public door mutates a stored line or reports a chain position. fr.audit.log.read composes br.audit.append-only, so the criterion is in this record\'s assertion set too, and it is not runnable there either.',
      },
    ],
  },

  'audit/export': {
    record: 'fr.audit.export',
    command: 'npm run test:e2e -- audit/export',
    assertions: [
      {
        id: 'fr.audit.export.main-1',
        statement: 'Every line resolving to that person through their live key is decrypted and returned.',
        request: 'as demo: signIn, createTask, completeTask, then exportMyData',
        expect: 'The export carries exactly the lines this run\'s own actions produced, with their action names and targets readable in the clear.',
      },
      {
        id: 'fr.audit.export.exception-1',
        statement: 'Once the person\'s key has been destroyed by a completed erasure, export returns nothing - the same key an erasure destroys is the key export depends on, so the two agree by construction.',
        request: 'as demo2: produce lines, then requestErasure + completeErasure, then exportMyData again',
        expect: 'The export list is empty afterwards, while a different person\'s export still returns its own lines.',
      },
      {
        id: 'fr.audit.export.post-1',
        statement: "The export contains no other person's lines.",
        request: 'as demo2: createTask with a run-unique title; as demo: exportMyData',
        expect: "demo's export never names demo2's task id, and demo2's own export does.",
      },
      {
        id: 'ac.audit.append-only.chain-detects-tamper',
        statement: "given: A log with several appended lines, each line's hash covering its own content and the previous line's hash / when: A test mutates one stored field on an already-appended line, or removes one line from the middle of the store, then asks the module to recompute the chain from the first line forward / then: The recomputation reports the exact index where the recomputed hash first stops matching the stored one, not merely \"invalid\" - a removed line must surface as a broken prevHash link at the line that followed it, and a changed field must surface as a content mismatch at that line. The same recomputation over an untouched log reports every line valid. \"The check that proves this: a node:test (or Nest e2e) suite that appends N lines, snapshots the chain, mutates the underlying storage directly (bypassing the module's own write path, the way a rogue admin or a compromised disk would), and asserts the recomputed break index equals the mutated line's index. A test that only calls the module's own append/verify pair without an out-of-band mutation does not prove tamper-evidence; it proves the happy path.\"",
        request: '(none available)',
        expect: 'An out-of-band mutation surfaces as the exact break index.',
        notRun: 'fr.audit.export composes br.audit.append-only, whose only acceptance criterion needs out-of-band storage mutation and a chain-index read-out; neither exists at a public door.',
      },
    ],
  },

  'audit/erasure-request': {
    record: 'fr.audit.erasure.request',
    command: 'npm run test:e2e -- audit/erasure-request',
    assertions: [
      {
        id: 'fr.audit.erasure.request.main-1',
        statement: 'A fresh requestId is minted and an erasure-request row is created in state requested.',
        request: 'as demo2: requestErasure',
        expect: 'A requestId is returned that this run has never issued before.',
        unproven: ['"an erasure-request row is created in state requested" is not what the door reports: requestErasure chains tRequest and tVerify in one call (the caller is always the subject), so the state the response carries is the one tVerify left behind. This run records the observed state in the readback; the requested state the step names is never observable from outside, and there is no query that lists erasure requests.'],
      },
      {
        id: 'fr.audit.erasure.request.main-2',
        statement: 'An erasure-requested line is appended, naming the requestId, not the person.',
        request: '(none available)',
        expect: 'A log line naming the requestId becomes readable.',
        notRun: 'The line is appended under AuditKeystoreService.SYSTEM_ACTOR_ID (audit-erasure.service.ts tRequest), and every public read of the log resolves lines by the caller\'s own keyId - so no public operation can ever return that line to anyone. Its "names the requestId, not the person" half is therefore unobservable from outside, and reading the audit_log_lines table directly is not the public API. br.audit.erasure.logged is done on unit proof; as an e2e assertion it has no proof surface.',
      },
      {
        id: 'fr.audit.erasure.request.post-1',
        statement: 'Exactly one erasure-request row exists per submission, in state requested.',
        request: '(none available)',
        expect: 'One row per submission, in the state this step names.',
        notRun: 'Neither half of this postcondition has a public read: no query lists erasure requests, and the state the request response carries is the one tVerify left behind in the same call, never `requested`. What is observable at this door - that each submission returns a requestId, and that the two requests this run submitted carry different ids - is proven by fr.audit.erasure.request.main-1; "exactly one row" is not, because nothing reads the table back. A duplicate request row would be invisible from outside.',
      },
      {
        id: 'ac.audit.erasure.right.identifying-fields-unreadable',
        statement: "given: A person who has produced several log lines, and a completed erasure request against them / when: Any reader, including export, tries to resolve those lines back to the person / then: No reader recovers the person's identity from any line they produced. \"The lines themselves are unchanged: same bytes, same position, same hash chain.\"",
        request: 'as demo2: produce lines, requestErasure + completeErasure, then auditLog and exportMyData as demo2, and exportMyData as demo',
        expect: 'demo2\'s own reads come back empty and demo\'s export never carries demo2\'s targets.',
      },
      {
        id: 'ac.audit.erasure.logged.request-and-completion-are-lines',
        statement: "given: An erasure request that runs to completion / when: The log is read afterward / then: An erasure-requested line and an erasure-completed line both exist, in that order. Neither line's actor field resolves to the erased person; both name only the request.",
        request: '(none available)',
        expect: 'Both lines exist, in order, naming only the requestId.',
        notRun: 'Same absent proof surface as fr.audit.erasure.request.main-2: the two lines are sealed under the system actor\'s key and every public read is caller-scoped by keyId, so no reader can see them, and the response shape (at, action, target) carries no actor field to check against.',
      },
    ],
  },

  'audit/erasure-complete': {
    record: 'fr.audit.erasure.complete',
    command: 'npm run test:e2e -- audit/erasure-complete',
    assertions: [
      {
        id: 'fr.audit.erasure.complete.main-1',
        statement: "The subject's key and the keystore's personId-to-keyId mapping are destroyed.",
        request: 'as demo2: requestErasure then completeErasure',
        expect: 'The request reaches state complete.',
        unproven: ['The destruction itself is only observable through its consequence (every line the subject produced stops resolving), which fr.audit.erasure.complete.main-2 and post-1 do prove. No public operation reports a key or a mapping, so this step is proven by its effect and not directly.'],
      },
      {
        id: 'fr.audit.erasure.complete.main-2',
        statement: 'Every line the subject produced is confirmed unreadable.',
        request: 'as demo2: produce lines, complete the erasure, then auditLog and exportMyData',
        expect: 'Both reads come back with nothing readable for that subject after completion.',
      },
      {
        id: 'fr.audit.erasure.complete.main-3',
        statement: 'The request moves to complete and an erasure-completed line is appended, naming the requestId.',
        request: 'as demo2: completeErasure(requestId)',
        expect: 'state: complete for that requestId.',
        unproven: ['The appended line half is unobservable for the same reason as fr.audit.erasure.request.main-2 (sealed under the system actor, and every public read is caller-scoped). The state transition is proven.'],
      },
      {
        id: 'fr.audit.erasure.complete.exception-1',
        statement: 'If any of the subject\'s lines still decrypts after key destruction, completion is refused rather than reported as done.',
        request: '(none available)',
        expect: 'ERASURE_NOT_CONFIRMED when a line still decrypts.',
        notRun: 'Triggering it requires a store where the key survives destroyKey - i.e. an out-of-band storage mutation, which is not a public request. The refusal path is unit-owned (audit-erasure.service.spec.ts); as an e2e assertion it has no proof surface.',
      },
      {
        id: 'fr.audit.erasure.complete.post-1',
        statement: 'No reader, including export, can resolve the subject\'s identity from any line they produced.',
        request: 'as demo2: complete the erasure, then read own log and export; as demo: export',
        expect: 'Neither read resolves a line to demo2, and demo\'s own export is unaffected.',
      },
      {
        id: 'fr.audit.erasure.complete.post-2',
        statement: "Every line's bytes, position and hash are unchanged from before the request.",
        request: '(none available)',
        expect: 'The lines themselves are unchanged.',
        notRun: 'bytes/position/hash are storage facts and no public door exposes any of them (AuditLogLineResponse: at, action, target). Proving "unchanged" from outside would need a storage read, which this suite forbids itself.',
      },
      {
        id: 'ac.audit.erasure.right.identifying-fields-unreadable',
        statement: "given: A person who has produced several log lines, and a completed erasure request against them / when: Any reader, including export, tries to resolve those lines back to the person / then: No reader recovers the person's identity from any line they produced. \"The lines themselves are unchanged: same bytes, same position, same hash chain.\"",
        request: 'as demo2: produce lines, complete an erasure, then read both persons\' logs and exports',
        expect: 'No read resolves demo2.',
        unproven: ['The second then-bullet ("same bytes, same position, same hash chain") is unobservable at a public door, so the criterion as authored is only partially proven.'],
      },
      {
        id: 'ac.audit.erasure.logged.request-and-completion-are-lines',
        statement: "given: An erasure request that runs to completion / when: The log is read afterward / then: An erasure-requested line and an erasure-completed line both exist, in that order. Neither line's actor field resolves to the erased person; both name only the request.",
        request: '(none available)',
        expect: 'Both lines exist, in order, naming only the requestId.',
        notRun: 'No public read can return the two system-sealed lines.',
      },
    ],
  },

  'recur/make-recurring': {
    record: 'fr.recur.make-recurring',
    command: 'npm run test:e2e -- recur/make-recurring',
    assertions: [
      {
        id: 'fr.recur.make-recurring.main-1',
        statement: 'The owner picks a frequency (every weekday, every N days, or a day of the month), a time of day and a time zone, defaulting to their own.',
        request: 'as demo: three makeRecurring calls, one per frequency, each with an explicit IANA zone and local time',
        expect: 'Each call reports back the frequency, zone and local time it was given.',
        unproven: ['"defaulting to their own" is a default the client picks: MakeRecurringInput has no default and timeZone is a required argument, so no public operation carries an owner default zone to observe.'],
      },
      {
        id: 'fr.recur.make-recurring.main-2',
        statement: 'The rule is created, owned by the submitter, and its first occurrence is previewed.',
        request: 'as demo: makeRecurring (monthly-day on the first of next month), then upcomingOccurrences(ruleId); as demo2: upcomingOccurrences for that same ruleId',
        expect: 'The rule exists and is readable by its submitter, its first upcoming date appears in the preview, and another person is refused the read.',
      },
      {
        id: 'fr.recur.make-recurring.exception-1',
        statement: 'A day-of-month rule naming a day that does not exist every month (e.g. the 31st) is accepted; nothing is refused at creation, per decision.recur.impossible-date.',
        request: 'as demo: makeRecurring(monthly-day, dayOfMonth: 31)',
        expect: 'Created, not refused: a ruleId comes back.',
      },
      {
        id: 'fr.recur.make-recurring.post-1',
        statement: 'Exactly one recurrence rule exists for that submission, and it exists whether or not the day it names exists in the current month.',
        request: 'as demo: makeRecurring(monthly-day, dayOfMonth: 31) in a month without a 31st, then upcomingOccurrences(ruleId)',
        expect: 'The rule is readable through its own id.',
        unproven: ['"Exactly one rule exists for that submission" has no read: there is no query that enumerates a person\'s rules (the public surface exposes upcomingOccurrences(ruleId) only), so a duplicate rule would be invisible from outside. The exists-regardless-of-month half is proven.'],
      },
      {
        id: 'ac.recur.impossible-date.skips.skips-nonexistent-day',
        statement: "given: A monthly-day rule r3 (UTC, 09:00, dayOfMonth 31, startDate 2026-01-01) / when: The generator runs with now = 2026-03-31T10:00:00.000Z, covering January through March 2026 / then: Occurrences exist for windowKey r3:2026-01-31 and r3:2026-03-31. No occurrence exists whose windowKey starts with r3:2026-02, because 2026 is not a leap year and February 2026 has 28 days. No occurrence's localDate is 2026-02-28 or any other February date; the month is skipped entirely, not clamped to its last day.",
        request: 'as demo: makeRecurring(monthly-day, dayOfMonth: 31, UTC, 09:00, startDate 2026-01-01); wait for the in-process generator tick; upcomingOccurrences(ruleId)',
        expect: 'Materialised occurrences dated 2026-01-31 and 2026-03-31, and no February local date at all.',
      },
      {
        id: 'ac.recur.timezone.owner-local-time.dst-spring-forward-shifts-by-gap',
        statement: "given: A daily rule (Europe/Berlin, local time 02:30) whose next date is 2026-03-29, the night Europe/Berlin clocks jump 02:00 -> 03:00 so that 02:30 never happens / when: The generator materialises the 2026-03-29 occurrence / then: The occurrence's dueAtUtc is exactly 2026-03-29T01:30:00.000Z (03:30 CEST local: the nominal 02:30 shifted forward by the one-hour gap), not 2026-03-29T00:30:00.000Z (03:00 CEST, the transition instant itself) and not any instant that formats to 02:30 local, which does not exist.",
        request: 'as demo: makeRecurring(every-n-days, n large enough to fire on one date only, Europe/Berlin, 02:30, startDate 2026-03-29); wait for a tick; upcomingOccurrences(ruleId)',
        expect: 'The materialised occurrence for localDate 2026-03-29 has dueAtUtc exactly 2026-03-29T01:30:00.000Z.',
      },
      {
        id: 'ac.recur.timezone.owner-local-time.dst-fall-back-picks-earliest',
        statement: "given: A daily rule (America/New_York, local time 01:30) whose next date is 2024-11-03, the night America/New_York clocks fall 02:00 -> 01:00 so that 01:30 happens twice / when: The generator materialises the 2024-11-03 occurrence / then: The occurrence's dueAtUtc is exactly 2024-11-03T05:30:00.000Z (01:30 EDT, the earlier of the two real instants that both read 01:30 local), not 2024-11-03T06:30:00.000Z (01:30 EST, the later one). Exactly one occurrence exists for windowKey <rule>:2024-11-03; the fold never produces two.",
        request: 'as demo: makeRecurring(every-n-days, single fire date, America/New_York, 01:30, startDate 2024-11-03); wait for a tick; upcomingOccurrences(ruleId)',
        expect: 'dueAtUtc 2024-11-03T05:30:00.000Z and exactly one occurrence on that local date.',
      },
      {
        id: 'ac.recur.timezone.owner-local-time.distinct-zones-differ',
        statement: "given: Two identical daily 09:00 rules, one owned by a person in Asia/Ho_Chi_Minh (no DST) and one by a person in Europe/Berlin (observes DST) / when: The generator materialises both rules' occurrence for 2026-01-15 and again for 2026-07-15 / then: \"The Ho_Chi_Minh occurrence's dueAtUtc is 2026-01-15T02:00:00.000Z and 2026-07-15T02:00:00.000Z: the same UTC offset (+07:00) on both dates.\" \"The Berlin occurrence's dueAtUtc is 2026-01-15T08:00:00.000Z (CET, +01:00) and 2026-07-15T07:00:00.000Z (CEST, +02:00): a different UTC offset between the two dates, for the same rule.\" On both dates, the Ho_Chi_Minh and Berlin occurrences' dueAtUtc values differ from each other, even though both rules say \"09:00\" in their own owner's clock.",
        request: 'as demo: four makeRecurring calls (two zones x two dates, each firing on one date only); wait for a tick; upcomingOccurrences for each',
        expect: 'The four instants exactly as named, and the two zones differing on each date.',
      },
    ],
  },

  'recur/see-upcoming': {
    record: 'fr.recur.see-upcoming',
    command: 'npm run test:e2e -- recur/see-upcoming',
    assertions: [
      {
        id: 'fr.recur.see-upcoming.main-1',
        statement: 'The owner sees every occurrence already materialised (with its status) and a preview of the dates the rule will next fire on, computed live from the rule, not read from stored rows.',
        request: 'as demo: makeRecurring(weekly-ish rule whose next fire day is in the future), wait for a tick so past dates materialise, then upcomingOccurrences(ruleId)',
        expect: 'Both halves come back: past occurrences each with a status, and a future date in previewDates that has no materialised row of its own.',
      },
      {
        id: 'fr.recur.see-upcoming.exception-1',
        statement: 'An ended rule shows no upcoming preview, only its history.',
        request: 'as demo: create a rule, let it materialise, endRecurrence(endedAt: today), then upcomingOccurrences(ruleId)',
        expect: 'previewDates is empty and materialised still lists the history.',
      },
      {
        id: 'fr.recur.see-upcoming.post-1',
        statement: 'Nothing shown as "upcoming" implies a row exists yet; a preview is not a promise the generator has already kept.',
        request: 'as demo: a rule whose next fire date is in the future; upcomingOccurrences before any tick for that date; then after enough ticks',
        expect: 'A previewed date is absent from materialised while it is only a preview.',
      },
      {
        id: 'ac.recur.impossible-date.skips.skips-nonexistent-day',
        statement: "given: A monthly-day rule r3 (UTC, 09:00, dayOfMonth 31, startDate 2026-01-01) / when: The generator runs with now = 2026-03-31T10:00:00.000Z, covering January through March 2026 / then: Occurrences exist for windowKey r3:2026-01-31 and r3:2026-03-31. No occurrence exists whose windowKey starts with r3:2026-02, because 2026 is not a leap year and February 2026 has 28 days. No occurrence's localDate is 2026-02-28 or any other February date; the month is skipped entirely, not clamped to its last day.",
        request: 'as demo: monthly-day 31 rule from 2026-01-01, wait for a tick, upcomingOccurrences',
        expect: 'January and March occurrences, no February date.',
      },
    ],
  },

  'recur/end-rule': {
    record: 'fr.recur.end-rule',
    command: 'npm run test:e2e -- recur/end-rule',
    assertions: [
      {
        id: 'fr.recur.end-rule.main-1',
        statement: 'The owner ends the rule.',
        request: 'as demo: makeRecurring(daily, startDate today-2), wait for materialisation, then endRecurrence(ruleId, endedAt: today-1)',
        expect: 'The call reports the endedAt it was given and how many occurrences it orphaned.',
      },
      {
        id: 'fr.recur.end-rule.main-2',
        statement: 'No occurrence dated after the day it ended is generated.',
        request: 'end the rule, then let several generator ticks pass, then upcomingOccurrences',
        expect: 'No materialised local date is later than the endedAt day.',
      },
      {
        id: 'fr.recur.end-rule.main-3',
        statement: 'Every occurrence already materialised is kept; any of them not already completed or skipped becomes orphaned.',
        request: 'as demo: a daily rule whose occurrences the generator has materialised, then endRecurrence, then upcomingOccurrences',
        expect: 'Nothing disappears from the materialised list, and every occurrence of the rule dated on or after the ended day reads orphaned.',
        unproven: ['The "not already completed or skipped" exemption cannot be exercised: no public operation ever sets an occurrence\'s status to completed or skipped. The generator materialises an occurrence on top of a real task row (same id), so completeTask does mark that task complete, but OccurrenceService.complete - the only writer of status completed - has no resolver behind it. Every occurrence this run can produce is therefore materialised, and the exemption branch is unreachable from a client.'],
      },
      {
        id: 'fr.recur.end-rule.post-1',
        statement: 'The rule carries an endedAt local date, and nothing it already produced was deleted.',
        request: 'endRecurrence, then upcomingOccurrences',
        expect: 'The response carries the endedAt date and the previously materialised set is still there in full.',
      },
      {
        id: 'ac.recur.ending.preserves-history.ended-rule-keeps-past-occurrences',
        statement: "given: A weekday rule with one completed occurrence (2026-09-14) and one still-materialised occurrence (2026-09-15) / when: The owner ends the rule effective 2026-09-15 / then: The 2026-09-14 occurrence's status stays completed; it is not touched. The 2026-09-15 occurrence's status becomes orphaned. No row for either occurrence is deleted. The generator produces no occurrence dated after 2026-09-15 for this rule on any later run.",
        request: '(no request can create the given clause)',
        expect: 'A completed occurrence survives the ending untouched.',
        notRun: 'The given clause needs an occurrence whose status is already completed, and no public operation can produce one: RecurModule registers CompleteOccurrenceHandler and SkipOccurrenceHandler, but src/features/todo/graphql contains no resolver for either (its 19 mutations cover tasks, sessions, shares, audit, notify, plan and the three rule writes; its 7 queries cover reads). So status completed is unreachable from a client and this criterion cannot be proven end to end from outside. The two bullets that do not need a completed occurrence - nothing deleted, and no occurrence dated after the ended day on later runs - are proven under this same record by fr.recur.end-rule.main-2 and post-1.',
      },
    ],
  },

  'recur/edit-rule': {
    record: 'fr.recur.edit-rule',
    command: 'npm run test:e2e -- recur/edit-rule',
    assertions: [
      {
        id: 'fr.recur.edit-rule.main-1',
        statement: 'The owner submits the changed fields.',
        request: 'as demo: makeRecurring(monthly-day 1, 09:00, Asia/Ho_Chi_Minh), then editRecurrence(ruleId, time: "18:00")',
        expect: 'The rule comes back carrying the new local time and the fields that did not change unchanged.',
      },
      {
        id: 'fr.recur.edit-rule.main-2',
        statement: 'The rule is updated; every occurrence already materialised is left as it is.',
        request: 'as demo: let occurrences materialise, edit the rule, then upcomingOccurrences',
        expect: 'The already-materialised set is identical before and after the edit - same dates, same instants, same statuses.',
      },
      {
        id: 'fr.recur.edit-rule.main-3',
        statement: 'Occurrences not yet materialised are generated from the new rule the next time the generator runs.',
        request: 'as demo: a rule starting today-1 whose newest date is not materialised yet, edit its local time, let a tick pass, then upcomingOccurrences',
        expect: 'The occurrence generated after the edit carries the new local time in its dueAtUtc.',
      },
      {
        id: 'fr.recur.edit-rule.exception-1',
        statement: "Someone who is not the rule's owner may not edit it.",
        request: 'as demo2: editRecurrence(demo\'s ruleId), then read the rule back as demo',
        expect: 'Refused with RECUR_RULE_FORBIDDEN, and the owner still reads the original schedule.',
      },
      {
        id: 'fr.recur.edit-rule.post-1',
        statement: 'The rule reflects the new schedule, and no already-materialised occurrence is rewritten to match it.',
        request: 'as demo: edit a materialised rule, then upcomingOccurrences',
        expect: 'The rule reports the new schedule while the older rows keep their old instants.',
      },
      {
        id: 'ac.recur.occurrence.owned-by-rule-owner.refuses-non-owner',
        statement: "given: A materialised occurrence of a rule owned by p1 / when: p2 attempts to complete or skip it / then: The attempt is refused, naming \"not the owner\". The occurrence's status, complete and completedAt are unchanged.",
        request: '(no request can be sent: the public surface registers no operation that completes or skips an occurrence)',
        expect: 'The attempt is refused and the occurrence is unchanged.',
        notRun: 'br.recur.occurrence.owned-by-rule-owner is state: done and this is its only acceptance criterion, but the door it names does not exist for a client: src/features/todo/graphql registers 19 mutations and 7 queries, and neither completeOccurrence nor skipOccurrence is among them - CompleteOccurrenceCommand and SkipOccurrenceCommand have handlers (src/modules/bussiness/recur/complete-occurrence.handler.ts, skip-occurrence.handler.ts) that no resolver ever dispatches, so the RECUR_OCCURRENCE_FORBIDDEN refusal this criterion is about can only be reached in-process. The rule is therefore unprovable from outside and this scenario fails closed rather than pretending otherwise; fr.recur.edit-rule composes this rule, so its own e2e proof cannot be complete either.',
      },
    ],
  },
};

/**
 * Keyed by `<group>#<assertion id>`, because one acceptance criterion can sit in two records' assertion
 * sets (ac.task.complete.once.is-idempotent is proven under both tasks/complete and tasks/reopen) and each
 * occurrence is its own scenario under its own record's check command.
 */
function assertionIndex() {
  const index = new Map();
  for (const [group, spec] of Object.entries(GROUPS)) {
    const seen = new Set();
    for (const assertion of spec.assertions) {
      if (seen.has(assertion.id)) throw new Error(`duplicate assertion id ${assertion.id} in group ${group}`);
      seen.add(assertion.id);
      index.set(`${group}#${assertion.id}`, { ...assertion, group, record: spec.record, command: spec.command });
    }
  }
  return index;
}

function lookup(groupId, assertionId) {
  return assertionIndex().get(`${groupId}#${assertionId}`);
}

function groupNames() {
  return Object.keys(GROUPS);
}

function groupAssertions(group) {
  if (!GROUPS[group]) throw new Error(`unknown e2e group ${group}; known groups: ${groupNames().join(', ')}`);
  return GROUPS[group].assertions;
}

module.exports = { GROUPS, assertionIndex, lookup, groupNames, groupAssertions };
