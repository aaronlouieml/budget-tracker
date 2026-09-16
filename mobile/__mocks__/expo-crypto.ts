// Test-only stand-in so utils/money.ts (which needs expo-crypto only for
// generating IDs, unrelated to what's tested) can be imported under plain
// Jest/Node without pulling in the Expo native runtime.
export function randomUUID(): string {
  return 'test-uuid';
}
