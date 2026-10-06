export function withSelectedParty<T extends object, K extends keyof T>(
  current: T,
  key: K,
  id: T[K],
): T {
  return { ...current, [key]: id };
}

export function appendParty<T extends { id: string }>(parties: T[], party: T) {
  return [...parties.filter((item) => item.id !== party.id), party];
}
