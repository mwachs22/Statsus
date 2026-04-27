/**
 * Validates that a user-supplied regex pattern is unlikely to cause catastrophic
 * backtracking (ReDoS). Used at filter-save time — patterns that pass this check
 * are safe to persist and evaluate against email fields.
 *
 * Returns true if the pattern is safe, false if it should be rejected.
 */

// Patterns known to cause catastrophic backtracking
const DANGEROUS_QUANTIFIER = /\)[\+\*]/;     // (x+)+ or (x+)*
const DANGEROUS_CLOSE = /\}[\+\*]/;           // {1,5}+ or {1,5}*

function hasOverlappingAlternation(pattern: string): boolean {
  // Detect patterns like (a|aa)+ or (ab|abc)+ which cause polynomial/exponential backtracking
  // when combined with quantifiers on the group
  const altGroups = pattern.match(/\(([^)]+)\)[+*]/g);
  if (!altGroups) return false;

  for (const g of altGroups) {
    const inner = g.replace(/[)(+*]/g, '');
    const alts = inner.split('|');
    if (alts.length < 2) continue;
    // Check if any alternative is a prefix of another
    for (let i = 0; i < alts.length; i++) {
      for (let j = 0; j < alts.length; j++) {
        if (i !== j && alts[j].startsWith(alts[i])) return true;
      }
    }
  }
  return false;
}

export function validateRegexSafety(pattern: string): boolean {
  // Hard cap on length — obfuscated payloads tend to be long
  if (pattern.length > 500) return false;

  // Must be a valid regex first
  try {
    new RegExp(pattern);
  } catch {
    return false;
  }

  // Reject nested quantifiers — the classic ReDoS fingerprint using )+ or )*
  if (DANGEROUS_QUANTIFIER.test(pattern)) return false;

  // Reject }+ and }* patterns (like {1,5}+)
  if (DANGEROUS_CLOSE.test(pattern)) return false;

  // Reject overlapping alternation inside quantified groups
  if (hasOverlappingAlternation(pattern)) return false;

  // Reject patterns with multiple adjacent quantified groups that can cause
  // polynomial backtracking: (x+)+(y+)+ or (\d+)+(\s+)+, etc.
  // These are: quantified group, followed by quantified group
  const adjacentQuantified = /\(\\.\+\)\+\(/;
  if (adjacentQuantified.test(pattern)) return false;

  // Reject excessive alternation: (a|b|c|d|e|f|g|h|i|j|...)
  const altCount = (pattern.match(/\|/g) || []).length;
  if (altCount > 10) return false;

  return true;
}
