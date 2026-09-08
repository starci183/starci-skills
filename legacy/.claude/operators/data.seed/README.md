# data.seed

Applies or rolls back one immutable fixture within an exact account or prefix namespace. The operator
observes before writing, journals exact affected identities, proves read-back and records a precise
rollback set. It never retries an uncertain store write before observing whether it already happened.
