/** Bind one operation to its lock; its body receives the locked context and original arguments. */
export function lockOperation(lock, operation) {
  return (ctx, args) => lock(ctx, args, (locked) => operation(locked, args));
}
