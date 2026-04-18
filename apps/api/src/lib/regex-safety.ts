/**
 * Validates that a user-supplied regex pattern is unlikely to cause catastrophic
 * backtracking (ReDoS). Used at filter-save time — patterns that pass this check
 * are safe to persist and evaluate against email fields.
 *
 * Returns true if the pattern is safe, false if it should be rejected.
 */
export function validateRegexSafety(pattern: string): boolean {
  // Hard cap on length — obfuscated payloads tend to be long
  if (pattern.length > 500) return false;

  // Must be a valid regex first
  try {
    new RegExp(pattern);
  } catch {
    return false;
  }

  // Reject nested quantifiers — the classic ReDoS fingerprint.
  // These substrings appear in known catastrophic patterns:
  //   (a+)+   → contains )+
  //   (.*)*   → contains )*
  //   (.{1,})+ → contains }+
  //   (.{1,})* → contains }*
  const dangerous = [')+', ')*', '}+', '}*'];
  for (const seq of dangerous) {
    if (pattern.includes(seq)) return false;
  }

  return true;
}
