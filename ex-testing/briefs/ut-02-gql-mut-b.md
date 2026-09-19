# Lane UT-02 — todo gql mutations B (plan, recur, notify, audit)

SCOPE (exclusive): `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend/src/features/todo/graphql/mutations/{plan,recur,notify,audit}/`

Same convention as UT-01. Resolvers: upgrade-plan, downgrade-plan, reconcile-payment, make-recurring, edit-recurrence, end-recurrence, unsubscribe, update-notification-preferences, request-erasure, complete-erasure. Cover happy path + plan/quota errors + recurrence-rule validation errors + authz.
