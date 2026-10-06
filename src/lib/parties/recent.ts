const TEST_PARTY_NAME = /^(?:P\d+[A-Z]?-IT-|STOCKFLOW-INTEGRATION-TEST)/i;

export function recentPartyIds(
  history: Array<{ partyId: string }>,
  parties: Array<{ id: string; name: string }>,
  limit = 5,
) {
  const partyById = new Map(parties.map((party) => [party.id, party]));
  const ids: string[] = [];
  for (const row of history) {
    const party = partyById.get(row.partyId);
    if (!party || TEST_PARTY_NAME.test(party.name) || ids.includes(party.id)) continue;
    ids.push(party.id);
    if (ids.length === limit) break;
  }
  return ids;
}
