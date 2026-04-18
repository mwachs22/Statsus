/**
 * Validates that an account ID is present in the caller's JWT scope.
 * Throws a 403 if not — this is a fast, in-process check that avoids a DB round-trip
 * for every ownership verification on explicit account_id params.
 */
export function assertAccountScope(accountIds: string[], accountId: string): void {
  if (!accountIds.includes(accountId)) {
    const err = Object.assign(
      new Error('Account not in scope'),
      { statusCode: 403 }
    );
    throw err;
  }
}
